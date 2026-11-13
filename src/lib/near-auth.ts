import { createHash, randomBytes, randomUUID } from "node:crypto";
import { verifyMessage } from "near-api-js/nep413";
import { db } from "./orders";
import { isAccountId, provider, requireTestnet } from "./near-testnet";
import { ExtensionDemoError } from "./extension-errors";

export const nearSessionCookie = "glimpsea_near_session";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const secret = () => randomBytes(32).toString("base64url");
const isToken = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
const isPairId = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9-]{36}$/.test(value);

function database() {
  const connection = db();
  connection.exec(`
    CREATE TABLE IF NOT EXISTS near_extension_pairs (
      id TEXT PRIMARY KEY, proof TEXT NOT NULL, nonce TEXT NOT NULL, recipient TEXT NOT NULL,
      expires_at INTEGER NOT NULL, browser_session TEXT
    );
    CREATE TABLE IF NOT EXISTS near_extension_sessions (
      token_hash TEXT PRIMARY KEY, account TEXT NOT NULL, expires_at INTEGER NOT NULL
    );
  `);
  return connection;
}

export function createPair(origin: string) {
  const id = randomUUID();
  const pairSecret = secret();
  const recipient = new URL(origin).host;
  const connection = database();
  connection.prepare("DELETE FROM near_extension_pairs WHERE expires_at <= ?").run(Date.now());
  connection.prepare("DELETE FROM near_extension_sessions WHERE expires_at <= ?").run(Date.now());
  connection.prepare("INSERT INTO near_extension_pairs VALUES (?, ?, ?, ?, ?, NULL)")
    .run(id, digest(pairSecret), secret(), recipient, Date.now() + 5 * 60_000);
  return { id, pairSecret };
}

export function loginChallenge(id: unknown, origin: string) {
  if (!isPairId(id)) throw new ExtensionDemoError("Open sign-in from the Glimpsea side panel.", 404);
  const row = database().prepare(`
    SELECT nonce, recipient FROM near_extension_pairs
    WHERE id = ? AND recipient = ? AND expires_at > ? AND browser_session IS NULL
  `).get(id, new URL(origin).host, Date.now()) as { nonce: string; recipient: string } | undefined;
  if (!row) throw new ExtensionDemoError("This sign-in expired. Open a new sign-in from the side panel.", 404);
  return { ...row, message: `Sign in to Glimpsea on NEAR testnet. Request ${id}.` };
}

export async function verifyLogin(input: Record<string, unknown>, origin: string) {
  const { id, accountId, publicKey, signature } = input;
  if (!isAccountId(accountId) || typeof publicKey !== "string" || publicKey.length > 128
      || typeof signature !== "string" || signature.length > 128) {
    throw new ExtensionDemoError("The wallet did not return a valid NEAR signature.", 401);
  }
  const { nonce, recipient, message } = loginChallenge(id, origin);
  await requireTestnet();
  try {
    await verifyMessage({
      signerAccountId: accountId,
      signerPublicKey: publicKey,
      payload: { nonce: Buffer.from(nonce, "base64url"), recipient, message },
      signature: Buffer.from(signature, "base64"),
      provider,
    });
  } catch {
    throw new ExtensionDemoError("Could not verify this signature against a NEAR testnet access key.", 401);
  }
  const token = secret();
  const connection = database();
  connection.exec("BEGIN IMMEDIATE");
  try {
    const claimed = connection.prepare(`
      UPDATE near_extension_pairs SET browser_session = ?
      WHERE id = ? AND expires_at > ? AND browser_session IS NULL
    `).run(token, id as string, Date.now());
    if (!claimed.changes) throw new ExtensionDemoError("This sign-in request is expired or already used.", 409);
    connection.prepare("INSERT INTO near_extension_sessions VALUES (?, ?, ?)")
      .run(digest(token), accountId, Date.now() + 24 * 3_600_000);
    connection.exec("COMMIT");
  } catch (error) {
    connection.exec("ROLLBACK");
    throw error;
  }
  return { accountId, token };
}

export function redeemPair(id: unknown, pairSecret: unknown) {
  if (!isPairId(id) || !isToken(pairSecret)) throw new ExtensionDemoError("Invalid extension sign-in.", 401);
  const row = database().prepare(`
    DELETE FROM near_extension_pairs
    WHERE id = ? AND proof = ? AND expires_at > ? AND browser_session IS NOT NULL RETURNING browser_session
  `).get(id, digest(pairSecret), Date.now()) as { browser_session: string } | undefined;
  if (!row) {
    const pending = database().prepare("SELECT 1 FROM near_extension_pairs WHERE id = ? AND proof = ? AND expires_at > ?")
      .get(id, digest(pairSecret), Date.now());
    if (!pending) throw new ExtensionDemoError("This sign-in expired. Start again from the side panel.", 404);
    return { pending: true };
  }
  return { token: row.browser_session, accountId: sessionAccount(row.browser_session) };
}

export function sessionAccount(token: unknown) {
  if (!isToken(token)) throw new ExtensionDemoError("Connect a NEAR testnet wallet first.", 401);
  const row = database().prepare("SELECT account FROM near_extension_sessions WHERE token_hash = ? AND expires_at > ?")
    .get(digest(token), Date.now()) as { account: string } | undefined;
  if (!row) throw new ExtensionDemoError("Your wallet session expired. Connect again.", 401);
  return row.account;
}

export function revokeSession(token: unknown) {
  if (isToken(token)) database().prepare("DELETE FROM near_extension_sessions WHERE token_hash = ?").run(digest(token));
}

export function nearOwner(accountId: string) {
  return `near:testnet:${accountId}`;
}

export function requestNearToken(request: Request) {
  return request.headers.get("Authorization")?.match(/^Bearer (\S+)$/i)?.[1];
}
