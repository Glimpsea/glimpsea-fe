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

function post(path: string, body: object, token?: string, guest?: string) {
  return fetch(origin + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(guest && { "X-Glimpsea-Demo": guest }),
    },
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
const guest = crypto.randomUUID();
const call = (action: string, data: object = {}, token?: string) =>
  post("/api/extension-demo", { action, ...data }, token, guest);

async function finish(id: string, token?: string) {
  for (const page of [1, 2]) await ok(await call("page", { id, page }, token));
  assert.equal((await ok(await call("analyze", { id }, token))).state, "complete");
}

async function openReport(id: string, token?: string) {
  const { reportPath } = await ok(await post("/api/extension-demo/session", { id }, token, guest));
  const response = await fetch(origin + reportPath, { redirect: "manual" });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("Location"), `/reports/${id}`);
  const cookie = response.headers.get("Set-Cookie")?.split(";")[0];
  assert.ok(cookie);
  assert.equal((await fetch(origin + reportPath, { redirect: "manual" })).status, 404);
  return cookie;
}

assert.equal((await post("/api/extension-demo", { action: "trials" })).status, 401);
assert.equal((await ok(await call("trials"))).remaining, 2);
const firstJob = await ok(await call("start", { ...example, access: "trial" }));
await finish(firstJob.id);
const reportUrl = `${origin}/reports/${firstJob.id}`;
assert.equal((await fetch(reportUrl)).status, 404);
const trialCookie = await openReport(firstJob.id);
assert.equal((await fetch(reportUrl, { headers: { Cookie: trialCookie } })).status, 200);
assert.equal((await post("/api/extension-demo/session", { id: firstJob.id }, undefined, crypto.randomUUID())).status, 404);
assert.equal((await ok(await call("trials"))).remaining, 1);

const secondJob = await ok(await call("start", { ...example, access: "trial" }));
await finish(secondJob.id);
assert.equal((await ok(await call("trials"))).remaining, 0);
assert.equal((await call("start", { ...example, access: "trial" })).status, 402);
assert.equal((await call("start", { ...example, access: "testnet-payment" })).status, 401);
const renewed = await login(payer);
assert.equal((await ok(await call("trials", {}, renewed.token))).remaining, 0);
assert.equal((await call("start", { ...example, access: "simulated-payment" }, renewed.token)).status, 400);
const unrelated = await login(other);
assert.equal((await fetch(reportUrl, { headers: { Cookie: unrelated.cookie } })).status, 404);
assert.equal((await post("/api/extension-demo", { action: "report", id: firstJob.id }, unrelated.token)).status, 404);
console.log("PASS Two guest trials, account signing at checkout, private owner reports, and a trial quota that survives login.");

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
const paidUrl = `${origin}/reports/${paid.id}`;
const paidCookie = await openReport(paid.id, renewed.token);
assert.equal((await fetch(paidUrl, { headers: { Cookie: paidCookie } })).status, 200);
await ok(await post("/api/near-auth", { action: "logout" }, renewed.token));
assert.equal((await fetch(paidUrl, { headers: { Cookie: paidCookie } })).status, 404);
assert.equal((await fetch(reportUrl, { headers: { Cookie: trialCookie } })).status, 200);
console.log("PASS A real finalized testnet transfer unlocked the third research job. The same receipt could not unlock another order.");
console.log(`Receipt: https://testnet.nearblocks.io/txns/${hash}`);
console.log(`Paid report ID: ${paid.id}`);
