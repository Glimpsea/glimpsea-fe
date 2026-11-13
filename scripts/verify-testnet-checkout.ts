import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Account } from "near-api-js";
import { signMessage } from "near-api-js/nep413";
import { provider } from "../src/lib/near-testnet";

const origin = process.env.GLIMPSEA_EXTENSION_URL || "http://127.0.0.1:3045";
const payerFile = process.env.GLIMPSEA_TEST_PAYER_FILE;
const otherFile = process.env.GLIMPSEA_TEST_OTHER_FILE;
assert.ok(payerFile && otherFile, "Set the paths to two funded, disposable NEAR testnet account files.");
assert.equal(await provider.getNetworkId(), "testnet");
function loadAccount(path: string) {
  const { id, secret } = JSON.parse(readFileSync(path, "utf8"));
  return new Account(id, provider, secret);
}
const payer = loadAccount(payerFile);
const other = loadAccount(otherFile);
assert.notEqual(payer.accountId, other.accountId);

function post(path: string, body: object, token?: string) {
  return fetch(origin + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
    body: JSON.stringify(body),
  });
}

async function ok(response: Response) {
  assert.ok(response.ok, await response.clone().text());
  return response.json();
}

async function login(account: Account) {
  const auth = (action: string, body: object = {}) => post("/api/near-auth", { action, ...body });
  const pair = await ok(await auth("pair"));
  assert.deepEqual(await ok(await auth("redeem", pair)), { pending: true });
  assert.equal((await auth("redeem", { ...pair, pairSecret: crypto.randomUUID() })).status, 401);
  const challenge = await ok(await auth("challenge", { id: pair.id }));
  const signed = await signMessage({
    signerAccount: account,
    payload: { ...challenge, nonce: Buffer.from(challenge.nonce, "base64url") },
  });
  const payload = {
    id: pair.id,
    accountId: signed.accountId,
    publicKey: signed.publicKey.toString(),
    signature: Buffer.from(signed.signature).toString("base64"),
  };
  assert.equal((await auth("verify", { ...payload, accountId: account === payer ? other.accountId : payer.accountId })).status, 401);
  const verified = await auth("verify", payload);
  assert.equal((await ok(verified)).accountId, account.accountId);
  const cookie = verified.headers.get("Set-Cookie")?.split(";")[0];
  assert.ok(cookie);
  assert.equal((await auth("verify", payload)).status, 404);
  const session = await ok(await auth("redeem", pair));
  assert.equal((await auth("redeem", pair)).status, 404);
  return { token: session.token as string, cookie };
}

const example = { keyword: "cafe owner supplies", audience: "US cafe owners", productionHours: 4, plan: "basic" };
const call = (action: string, data: object = {}, token?: string) => post("/api/extension-demo", { action, ...data }, token);

async function finish(id: string, token: string) {
  for (const page of [1, 2]) await ok(await call("page", { id, page }, token));
  assert.equal((await ok(await call("analyze", { id }, token))).state, "complete");
}

assert.equal((await call("trials")).status, 401);
const first = await login(payer);
assert.equal((await ok(await call("trials", {}, first.token))).remaining, 2);
const firstJob = await ok(await call("start", { ...example, access: "trial" }, first.token));
await finish(firstJob.id, first.token);
await ok(await post("/api/near-auth", { action: "logout" }, first.token));
assert.equal((await call("trials", {}, first.token)).status, 401);
assert.equal((await fetch(`${origin}/reports/${firstJob.id}`, { headers: { Cookie: first.cookie } })).status, 404);

const renewed = await login(payer);
assert.equal((await ok(await call("trials", {}, renewed.token))).remaining, 1);
const reportUrl = `${origin}/reports/${firstJob.id}`;
assert.equal((await fetch(reportUrl)).status, 404);
assert.equal((await fetch(reportUrl, { headers: { Cookie: renewed.cookie } })).status, 200);
const unrelated = await login(other);
assert.equal((await fetch(reportUrl, { headers: { Cookie: unrelated.cookie } })).status, 404);
assert.equal((await call("report", { id: firstJob.id }, unrelated.token)).status, 404);

const secondJob = await ok(await call("start", { ...example, access: "trial" }, renewed.token));
await finish(secondJob.id, renewed.token);
assert.equal((await ok(await call("trials", {}, renewed.token))).remaining, 0);
assert.equal((await call("start", { ...example, access: "trial" }, renewed.token)).status, 402);
assert.equal((await call("start", { ...example, access: "simulated-payment" }, renewed.token)).status, 400);
console.log("PASS Signed NEAR login, trial quota survives re-login, and reports stay private to their owner.");

const paid = await ok(await call("start", { ...example, access: "testnet-payment" }, renewed.token));
assert.equal(paid.state, "awaiting-payment");
assert.equal((await call("page", { id: paid.id, page: 1 }, renewed.token)).status, 402);
assert.equal((await call("analyze", { id: paid.id }, renewed.token)).status, 402);
assert.equal((await call("pay", { id: paid.id, txHash: null }, renewed.token)).status, 400);
assert.equal((await call("status", { id: paid.id }, unrelated.token)).status, 404);

assert.equal(paid.checkout.receiver, other.accountId, "Use the disposable test receiver.");
const transfer = await payer.transfer({ receiverId: paid.checkout.receiver, amount: BigInt(paid.checkout.amount) });
const hash = transfer.transaction.hash;
assert.equal(typeof hash, "string");
const confirmed = await ok(await call("pay", { id: paid.id, txHash: hash }, renewed.token));
assert.equal(confirmed.state, "browsing");
assert.equal((await ok(await call("pay", { id: paid.id, txHash: hash }, renewed.token))).checkout.txHash, hash);

const another = await ok(await call("start", { ...example, access: "testnet-payment" }, renewed.token));
assert.notEqual(another.checkout.amount, paid.checkout.amount);
assert.equal((await call("pay", { id: another.id, txHash: hash }, renewed.token)).status, 422);
assert.equal((await call("page", { id: another.id, page: 1 }, renewed.token)).status, 402);
await finish(paid.id, renewed.token);
assert.equal((await fetch(`${origin}/reports/${paid.id}`, { headers: { Cookie: renewed.cookie } })).status, 200);
console.log("PASS A real finalized testnet transfer unlocked the third research job. The same receipt could not unlock another order.");
console.log(`Receipt: https://testnet.nearblocks.io/txns/${hash}`);
console.log(`Paid report ID: ${paid.id}`);
