import { createHash, randomBytes } from "node:crypto";
import { JsonRpcProvider } from "near-api-js";
import { verifyMessage } from "near-api-js/nep413";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { db as orderDb } from "./orders";
import { provider as testnetProvider } from "./near-testnet";
import type { OrderInput } from "./a2a";
import type { Brief } from "./research";
import { marketReportsSchema, reportIdPattern, reportLine, reportOrigin } from "./market-report-format";

let database: DatabaseSync | undefined;

function db() {
  if (database) return database;
  const path = resolve(/* turbopackIgnore: true */ process.cwd(), process.env.GLIMPSEA_MARKET_DB_PATH || ".data/market-worker.sqlite");
  mkdirSync(dirname(path), { recursive: true });
  const connection = new DatabaseSync(path);
  connection.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;");
  connection.exec(marketReportsSchema);
  database = connection;
  return connection;
}

export type ReportNetwork = "mainnet" | "testnet";

export function agentReportOwner(id: string) {
  if (!reportIdPattern.test(id)) return;
  for (const network of ["testnet", "mainnet"] as const) {
    if (network === "testnet" && process.env.GLIMPSEA_A2A_NEAR_TESTNET !== "1") continue;
    if (network === "mainnet" && !process.env.GLIMPSEA_MARKET_AGENT_HANDLE) continue;
    const connection = network === "testnet" ? orderDb() : db();
    const row = connection.prepare("SELECT buyer FROM market_reports WHERE id = ? AND settled_at IS NOT NULL").get(id) as
      { buyer: string } | undefined;
    if (row) return { buyer: row.buyer, network, connection };
  }
}

export function readMarketReport(id: string, identity: { buyer: string; network: ReportNetwork }) {
  const owner = agentReportOwner(id);
  if (!owner || identity.buyer !== owner.buyer || identity.network !== owner.network) return;
  const row = owner.connection.prepare("SELECT order_json, brief_json FROM market_reports WHERE id = ?")
    .get(id) as { order_json: string; brief_json: string };
  return {
    order: JSON.parse(row.order_json) as OrderInput,
    brief: JSON.parse(row.brief_json) as Extract<Brief, { schemaVersion: 2 }>,
  };
}

export async function settleMarketReport(id: string, taskId: string) {
  const handle = process.env.GLIMPSEA_MARKET_AGENT_HANDLE;
  if (!handle || !/^[a-z][a-z0-9-]{1,28}[a-z0-9]$/.test(handle) || !reportIdPattern.test(id)) return false;
  if (!db().prepare("SELECT 1 FROM market_reports WHERE id = ?").get(id)) return false;
  const response = await fetch(`https://${handle}.market.near.ai/a2a/v1`, {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(10_000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "GetTask", params: { id: taskId, historyLength: 0 } }),
  });
  if (!response.ok) return false;
  const { result, error } = await response.json();
  const expectedLine = reportLine(new URL(`/reports/${id}`, reportOrigin()).href);
  if (error || result?.id !== taskId || result.status?.state !== "TASK_STATE_COMPLETED" ||
      !Array.isArray(result.artifacts) || !result.artifacts.some((artifact: { parts?: { text?: string }[] }) =>
        Array.isArray(artifact.parts) && artifact.parts.some((part) => typeof part.text === "string" && part.text.split("\n", 1)[0] === expectedLine))) return false;
  db().prepare("UPDATE market_reports SET settled_at = COALESCE(settled_at, ?) WHERE id = ?").run(Date.now(), id);
  return true;
}

const sessionSecret = () => randomBytes(32).toString("base64url");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const grantToken = /^[A-Za-z0-9_-]{43}$/;
const buyerProvider = new JsonRpcProvider({ url: process.env.GLIMPSEA_MARKET_NEAR_RPC || "https://rpc.mainnet.fastnear.com" });
export const marketReportCookie = (network: ReportNetwork) => network === "mainnet" ? "glimpsea_market_buyer" : "glimpsea_testnet_agent_buyer";

function authDb(network: ReportNetwork) {
  const database = network === "testnet" ? orderDb() : db();
  database.exec(`
    CREATE TABLE IF NOT EXISTS market_report_challenges (
      nonce TEXT PRIMARY KEY, report_id TEXT NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS market_report_sessions (
      token_hash TEXT PRIMARY KEY, buyer TEXT NOT NULL, expires_at INTEGER NOT NULL
    );
  `);
  return database;
}

function challengePayload(id: string, nonce: string, network: ReportNetwork) {
  return { nonce, recipient: new URL(reportOrigin()).host, message: `Sign in to read Glimpsea report ${id} on NEAR ${network}.` };
}

export function marketReportChallenge(id: string) {
  const owner = agentReportOwner(id);
  if (!owner) return;
  const nonce = sessionSecret();
  const database = authDb(owner.network);
  database.prepare("DELETE FROM market_report_challenges WHERE expires_at <= ?").run(Date.now());
  database.prepare("DELETE FROM market_report_sessions WHERE expires_at <= ?").run(Date.now());
  database.prepare("INSERT INTO market_report_challenges VALUES (?, ?, ?)").run(nonce, id, Date.now() + 300_000);
  return challengePayload(id, nonce, owner.network);
}

export async function verifyMarketReportLogin(id: string, input: Record<string, unknown>) {
  const owner = agentReportOwner(id);
  if (!owner) return;
  const { buyer, network } = owner;
  const provider = network === "testnet" ? testnetProvider : buyerProvider;
  const { accountId, publicKey, signature, nonce } = input;
  if (!buyer || accountId !== buyer || typeof nonce !== "string" || !grantToken.test(nonce) ||
      typeof publicKey !== "string" || publicKey.length > 128 || typeof signature !== "string" || signature.length > 128) return;
  const database = authDb(owner.network);
  if (!database.prepare("SELECT 1 FROM market_report_challenges WHERE nonce = ? AND report_id = ? AND expires_at > ?")
    .get(nonce, id, Date.now())) return;
  try {
    if (await provider.getNetworkId() !== network) return;
    await verifyMessage({
      signerAccountId: buyer, signerPublicKey: publicKey, signature: Buffer.from(signature, "base64"),
      payload: { ...challengePayload(id, nonce, network), nonce: Buffer.from(nonce, "base64url") }, provider,
    });
  } catch {
    return;
  }
  const token = sessionSecret();
  database.exec("BEGIN IMMEDIATE");
  try {
    const consumed = database.prepare("DELETE FROM market_report_challenges WHERE nonce = ? AND report_id = ? AND expires_at > ?")
      .run(nonce, id, Date.now());
    if (consumed.changes) database.prepare("INSERT INTO market_report_sessions VALUES (?, ?, ?)")
      .run(hash(token), buyer, Date.now() + 86_400_000);
    database.exec("COMMIT");
    if (consumed.changes) return { token, network };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function marketReportSession(token: string | undefined, network: ReportNetwork) {
  if (!token || !grantToken.test(token)) return;
  const buyer = (authDb(network).prepare("SELECT buyer FROM market_report_sessions WHERE token_hash = ? AND expires_at > ?")
    .get(hash(token), Date.now()) as { buyer: string } | undefined)?.buyer;
  if (buyer) return { buyer, network };
}
