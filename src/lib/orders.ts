import { createHash, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { OrderInput, SimulatedOffer, Task, TaskState } from "./a2a";
import { research, ResearchServiceError } from "./research";

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
  `);
  database = connection;
  return database;
}

function messageHash(order: OrderInput) {
  return createHash("sha256").update(JSON.stringify(order)).digest("hex");
}

function findOrder(messageId: string) {
  return db().prepare("SELECT * FROM orders WHERE message_id = ?").get(messageId) as Row | undefined;
}

export function quote(messageId: string, order: OrderInput): SimulatedOffer | undefined {
  const now = Date.now();
  const hash = messageHash(order);
  db().prepare(`
    INSERT INTO orders (message_id, request_hash, quote_id, expires_at, amount, order_json)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(message_id) DO UPDATE SET
      quote_id = excluded.quote_id, expires_at = excluded.expires_at
    WHERE orders.task_id IS NULL AND orders.expires_at <= ? AND orders.request_hash = excluded.request_hash
  `).run(messageId, hash, randomUUID(), now + 10 * 60_000, "2500000", JSON.stringify(order), now);
  const row = findOrder(messageId);
  if (!row || row.request_hash !== hash || row.task_id) return;
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
  if (!row || row.request_hash !== messageHash(order) || row.quote_id !== offer.quoteId
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
      payment: { mode: "simulated", state: row.payment_state, amount: row.amount },
      ...(report && { research: report }),
    },
  };
}

export function getTask(taskId: string) {
  const row = db().prepare("SELECT * FROM orders WHERE task_id = ?").get(taskId) as Row | undefined;
  if (row) return asTask(row);
}

const europeanMarkets = new Set([
  "AD", "AL", "AT", "BA", "BE", "BG", "BY", "CH", "CY", "CZ", "DE", "DK", "EE", "ES",
  "FI", "FR", "GB", "GR", "HR", "HU", "IE", "IS", "IT", "LI", "LT", "LU", "LV", "MC",
  "MD", "ME", "MK", "MT", "NL", "NO", "PL", "PT", "RO", "RS", "SE", "SI", "SK", "SM", "UA",
]);

function finish(taskId: string, attempt: number, state: TaskState, note?: string, result?: Awaited<ReturnType<typeof research>>) {
  db().prepare(`
    UPDATE orders SET state = ?, payment_state = ?, note = ?, markdown = ?, research_json = ?, lease_until = NULL
    WHERE task_id = ? AND state = 'TASK_STATE_WORKING' AND attempt = ?
  `).run(state, result ? "settled" : "released", note ?? null, result?.markdown ?? null,
    result ? JSON.stringify({ provider: result.provider, usage: result.usage }) : null, taskId, attempt);
}

export async function processTask(taskId: string) {
  const now = Date.now();
  db().prepare(`
    UPDATE orders SET state = 'TASK_STATE_FAILED', payment_state = 'released', lease_until = NULL,
      note = 'Research stopped after two attempts. Start a new order or give support this task ID.'
    WHERE task_id = ? AND state = 'TASK_STATE_WORKING' AND lease_until <= ? AND attempt >= 2
  `).run(taskId, now);
  const job = db().prepare(`
    UPDATE orders SET state = 'TASK_STATE_WORKING', lease_until = ?, attempt = attempt + 1
    WHERE task_id = ? AND (state = 'TASK_STATE_SUBMITTED' OR (state = 'TASK_STATE_WORKING' AND lease_until <= ?))
    RETURNING order_json, attempt
  `).get(now + 90_000, taskId, now) as { order_json: string; attempt: number } | undefined;
  if (!job) return;
  const order = JSON.parse(job.order_json) as OrderInput;
  if (order.country !== "US" && !europeanMarkets.has(order.country)) {
    finish(taskId, job.attempt, "TASK_STATE_REJECTED", "Choose the US or a supported European country and send a new order.");
    return;
  }
  try {
    const result = await research(order);
    finish(taskId, job.attempt, "TASK_STATE_COMPLETED", undefined, result);
  } catch (error) {
    const missingKey = !process.env.NEAR_AI_API_KEY && process.env.GLIMPSEA_RESEARCH_MODE !== "fixture";
    console.error("Glimpsea research failed for task", taskId,
      error instanceof ResearchServiceError ? error.message : "Internal research error.");
    finish(taskId, job.attempt, "TASK_STATE_FAILED", missingKey
      ? "NEAR AI Cloud needs an API key. Set NEAR_AI_API_KEY on the server and start a new order."
      : "Research failed. Start a new order or give support this task ID.");
  }
}
