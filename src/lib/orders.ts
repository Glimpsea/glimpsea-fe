import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { OrderInput, SimulatedOffer, TestnetOffer, Task, TaskState } from "./a2a";
import { research, ResearchServiceError } from "./research";
import { marketReportsSchema, reportOrigin } from "./market-report-format";
import { agentTestnetAccounts, verifyTestnetTransfer } from "./near-testnet";
import { supportsResearchMarket } from "./research-order";

type Row = {
  message_id: string;
  request_hash: string;
  quote_id: string;
  expires_at: number;
  amount: string;
  order_json: string;
  task_id: string | null;
  state: TaskState | null;
  payment_state: Task["metadata"]["payment"]["state"] | null;
  note: string | null;
  markdown: string | null;
  research_json: string | null;
  payer: string | null;
  receiver: string | null;
  tx_hash: string | null;
};

let database: DatabaseSync | undefined;
export function db() {
  if (database) return database;
  const path = resolve(/* turbopackIgnore: true */ process.cwd(), process.env.GLIMPSEA_DB_PATH || ".data/glimpsea.sqlite");
  mkdirSync(dirname(path), { recursive: true });
  const connection = new DatabaseSync(path);
  connection.exec(`
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS orders (
      message_id TEXT PRIMARY KEY,
      request_hash TEXT NOT NULL,
      quote_id TEXT UNIQUE NOT NULL,
      expires_at INTEGER NOT NULL,
      amount TEXT NOT NULL,
      order_json TEXT NOT NULL,
      task_id TEXT UNIQUE,
      state TEXT,
      payment_state TEXT,
      note TEXT,
      markdown TEXT,
      research_json TEXT,
      attempt INTEGER NOT NULL DEFAULT 0,
      lease_until INTEGER
    );
    CREATE TABLE IF NOT EXISTS agent_testnet_payments (
      serial INTEGER PRIMARY KEY AUTOINCREMENT, message_id TEXT UNIQUE NOT NULL,
      payer TEXT NOT NULL, receiver TEXT NOT NULL, tx_hash TEXT UNIQUE
    );
    ${marketReportsSchema}
  `);
  database = connection;
  return database;
}

function messageHash(order: OrderInput) {
  return createHash("sha256").update(JSON.stringify(order)).digest("hex");
}

function findOrder(messageId: string) {
  return db().prepare("SELECT orders.*, payer, receiver, tx_hash FROM orders LEFT JOIN agent_testnet_payments USING (message_id) WHERE message_id = ?").get(messageId) as Row | undefined;
}

export function quote(messageId: string, order: OrderInput): SimulatedOffer | undefined {
  const now = Date.now();
  const hash = messageHash(order);
  db().prepare(`
    INSERT INTO orders (message_id, request_hash, quote_id, expires_at, amount, order_json)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(message_id) DO UPDATE SET
      quote_id = excluded.quote_id, expires_at = excluded.expires_at
    WHERE NOT EXISTS (SELECT 1 FROM agent_testnet_payments WHERE message_id = orders.message_id)
      AND orders.task_id IS NULL AND orders.expires_at <= ? AND orders.request_hash = excluded.request_hash
  `).run(messageId, hash, randomUUID(), now + 10 * 60_000, "2500000", JSON.stringify(order), now);
  const row = findOrder(messageId);
  if (!row || row.payer || row.request_hash !== hash || row.task_id) return;
  return {
    scheme: "glimpsea-simulation",
    network: "glimpsea:local",
    asset: "USDC",
    amount: row.amount,
    quoteId: row.quote_id,
    expiresAt: row.expires_at,
  };
}

export function authorize(messageId: string, order: OrderInput, offer: SimulatedOffer) {
  const row = findOrder(messageId);
  if (!row || row.payer || row.request_hash !== messageHash(order) || row.quote_id !== offer.quoteId
      || row.amount !== offer.amount || row.expires_at !== offer.expiresAt) return;
  if (row.task_id) return asTask(row);
  db().prepare(`
    UPDATE orders SET task_id = ?, state = 'TASK_STATE_SUBMITTED', payment_state = 'authorized'
    WHERE message_id = ? AND quote_id = ? AND task_id IS NULL AND expires_at > ?
  `).run(randomUUID(), messageId, offer.quoteId, Date.now());
  const updated = findOrder(messageId);
  if (updated?.task_id && updated.quote_id === offer.quoteId) return asTask(updated);
}

function asTask(row: Row): Task {
  if (!row.task_id || !row.state || !row.payment_state) throw new Error("Order is not authorized.");
  const report = row.research_json ? JSON.parse(row.research_json) as Task["metadata"]["research"] : undefined;
  return {
    id: row.task_id,
    status: {
      state: row.state,
      ...(row.note && { message: { parts: [{ text: row.note }] } }),
    },
    ...(row.markdown && { artifacts: [{ name: row.markdown.startsWith("# Glimpsea wall art brief")
      ? "Etsy wall art research brief" : "Etsy product research brief", parts: [{ text: row.markdown }] }] }),
    metadata: {
      payment: { mode: row.payer ? "near-testnet" : "simulated", state: row.payment_state, amount: row.amount,
        ...(row.tx_hash && { txHash: row.tx_hash }) },
      ...(report && { research: report }),
    },
  };
}

export function getTask(taskId: string) {
  const row = db().prepare("SELECT orders.*, payer, receiver, tx_hash FROM orders LEFT JOIN agent_testnet_payments USING (message_id) WHERE task_id = ?").get(taskId) as Row | undefined;
  if (row) return asTask(row);
}

function finishTestnet(taskId: string, attempt: number, order: OrderInput, result: Awaited<ReturnType<typeof research>>) {
  const connection = db();
  const buyer = connection.prepare("SELECT payer FROM agent_testnet_payments JOIN orders USING (message_id) WHERE task_id = ? AND tx_hash IS NOT NULL")
    .get(taskId) as { payer: string };
  const url = new URL(`/reports/${taskId}`, reportOrigin());
  connection.exec("BEGIN IMMEDIATE");
  try {
    const updated = connection.prepare(`
      UPDATE orders SET state = 'TASK_STATE_COMPLETED', markdown = ?, research_json = ?, lease_until = NULL
      WHERE task_id = ? AND state = 'TASK_STATE_WORKING' AND attempt = ?
    `).run(`${result.brief.recommendation}\n\nOpen the Glimpsea report: ${url.href}`, JSON.stringify({ provider: result.provider, usage: result.usage }), taskId, attempt);
    if (updated.changes) connection.prepare("INSERT INTO market_reports VALUES (?, ?, ?, ?, ?, ?)")
      .run(taskId, `testnet:${taskId}`, buyer.payer, JSON.stringify(order), JSON.stringify(result.brief), Date.now());
    connection.exec("COMMIT");
  } catch (error) {
    connection.exec("ROLLBACK");
    throw error;
  }
}

function finish(taskId: string, attempt: number, state: TaskState, note?: string, result?: Awaited<ReturnType<typeof research>>) {
  db().prepare(`
    UPDATE orders SET state = ?, payment_state = CASE WHEN payment_state = 'settled' THEN 'settled' ELSE ? END, note = ?, markdown = ?, research_json = ?, lease_until = NULL
    WHERE task_id = ? AND state = 'TASK_STATE_WORKING' AND attempt = ?
  `).run(state, result ? "settled" : "released", note ?? null, result?.markdown ?? null,
    result ? JSON.stringify({ provider: result.provider, usage: result.usage }) : null, taskId, attempt);
}

export async function processTask(taskId: string) {
  const now = Date.now();
  db().prepare(`
    UPDATE orders SET state = 'TASK_STATE_FAILED', payment_state = CASE WHEN payment_state = 'settled' THEN 'settled' ELSE 'released' END, lease_until = NULL,
      note = 'Research stopped after two attempts. Give support this task ID before paying again.'
    WHERE task_id = ? AND state = 'TASK_STATE_WORKING' AND lease_until <= ? AND attempt >= 2
  `).run(taskId, now);
  const job = db().prepare(`
    UPDATE orders SET state = 'TASK_STATE_WORKING', lease_until = ?, attempt = attempt + 1
    WHERE task_id = ? AND (state = 'TASK_STATE_SUBMITTED' OR (state = 'TASK_STATE_WORKING' AND lease_until <= ?))
    RETURNING order_json, attempt, payment_state
  `).get(now + 90_000, taskId, now) as { order_json: string; attempt: number; payment_state: string } | undefined;
  if (!job) return;
  const order = JSON.parse(job.order_json) as OrderInput;
  if (!supportsResearchMarket(order.country)) {
    finish(taskId, job.attempt, "TASK_STATE_REJECTED", "Choose the US or a supported European country and send a new order.");
    return;
  }
  const testnet = job.payment_state === "settled";
  const mode = testnet ? "gemini" : process.env.GLIMPSEA_A2A_RESEARCH_MODE?.trim() || process.env.GLIMPSEA_RESEARCH_MODE?.trim();
  try {
    const result = await research(order, undefined, mode);
    if (testnet) finishTestnet(taskId, job.attempt, order, result);
    else finish(taskId, job.attempt, "TASK_STATE_COMPLETED", undefined, result);
  } catch (error) {
    const missingKey = mode === "gemini"
      ? !process.env.GLIMPSEA_SELLER_GEMINI_API_KEY?.trim()
      : mode !== "fixture" && !process.env.NEAR_AI_API_KEY?.trim();
    console.error("Glimpsea research failed for task", taskId,
      error instanceof ResearchServiceError ? error.message : "Internal research error.");
    finish(taskId, job.attempt, "TASK_STATE_FAILED", testnet
      ? "Payment is final. Research failed. Keep the payment hash and contact Glimpsea before paying again."
      : missingKey
      ? `Set ${mode === "gemini" ? "GLIMPSEA_SELLER_GEMINI_API_KEY" : "NEAR_AI_API_KEY"} on the server and start a new order.`
      : "Research failed. Start a new order or give support this task ID.");
  }
}

export function quoteTestnet(messageId: string, order: OrderInput): TestnetOffer | undefined {
  const { payer, receiver } = agentTestnetAccounts();
  const connection = db();
  const hash = messageHash(order);
  connection.exec("BEGIN IMMEDIATE");
  try {
    const existing = findOrder(messageId);
    if (!existing) {
      connection.prepare("INSERT INTO agent_testnet_payments (message_id, payer, receiver) VALUES (?, ?, ?)")
        .run(messageId, payer, receiver);
      const amount = (10_000_000_000_000_000_000_000n + BigInt(`0x${randomBytes(6).toString("hex")}`) + 1n).toString();
      connection.prepare("INSERT INTO orders (message_id, request_hash, quote_id, expires_at, amount, order_json) VALUES (?, ?, ?, ?, ?, ?)")
        .run(messageId, hash, randomUUID(), Date.now() + 10 * 60_000, amount, JSON.stringify(order));
    } else if (existing.payer && !existing.task_id && existing.request_hash === hash && existing.expires_at <= Date.now()) {
      connection.prepare("UPDATE orders SET expires_at = ? WHERE message_id = ?").run(Date.now() + 10 * 60_000, messageId);
    }
    const row = findOrder(messageId);
    connection.exec("COMMIT");
    if (!row?.payer || !row.receiver || row.request_hash !== hash || row.task_id) return;
    return {
      scheme: "glimpsea-near-transfer", network: "near:testnet", asset: "NEAR",
      amount: row.amount, quoteId: row.quote_id, expiresAt: row.expires_at, payer: row.payer, receiver: row.receiver,
    };
  } catch (error) {
    connection.exec("ROLLBACK");
    throw error;
  }
}

export async function authorizeTestnet(messageId: string, order: OrderInput, quoteId: unknown, txHash: unknown) {
  const row = findOrder(messageId);
  if (!row?.payer || !row.receiver || row.request_hash !== messageHash(order) || row.quote_id !== quoteId) return;
  if (row.task_id) return row.tx_hash === txHash ? asTask(row) : undefined;
  const hash = await verifyTestnetTransfer(txHash, row.payer, row.receiver, row.amount);
  const connection = db();
  connection.exec("BEGIN IMMEDIATE");
  try {
    const assigned = connection.prepare("SELECT message_id FROM agent_testnet_payments WHERE tx_hash = ?").get(hash);
    if (!assigned) {
      const updated = connection.prepare(`
        UPDATE orders SET task_id = ?, state = 'TASK_STATE_SUBMITTED', payment_state = 'settled'
        WHERE message_id = ? AND task_id IS NULL
      `).run(randomUUID(), messageId);
      if (updated.changes) connection.prepare("UPDATE agent_testnet_payments SET tx_hash = ? WHERE message_id = ?").run(hash, messageId);
    }
    const verified = findOrder(messageId);
    connection.exec("COMMIT");
    if (verified?.task_id && verified.tx_hash === hash) return asTask(verified);
  } catch (error) {
    connection.exec("ROLLBACK");
    throw error;
  }
}
