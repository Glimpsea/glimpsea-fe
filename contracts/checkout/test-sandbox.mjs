import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Account, actions, JsonRpcProvider, KeyPair } from "near-api-js";

const { Sandbox, GenesisAccount } = await import(process.env.NEAR_SANDBOX_MODULE ?? "near-sandbox");
const wasm = await readFile(new URL("./target/wasm32-unknown-unknown/release/glimpsea_checkout.wasm", import.meta.url));
const root = GenesisAccount.createDefault("checkout.testnet");
const sandbox = await Sandbox.start({ version: "2.13.3", config: { additionalAccounts: [root] } });
const provider = new JsonRpcProvider({ url: sandbox.rpcUrl });
const operator = new Account(root.accountId, provider, root.privateKey);
const yocto = 10n ** 24n;
const price = yocto / 100n;
const gas = 40n * 10n ** 12n;
const signingKey = KeyPair.fromRandom("ed25519");
const deploymentId = randomBytes(32);
const quoteKey = signingKey.getPublicKey().toString();

async function createAccount(label, contractArgs) {
  const key = KeyPair.fromRandom("ed25519");
  const id = `${label}.${operator.accountId}`;
  await operator.signAndSendTransaction({
    receiverId: id,
    actions: [
      actions.createAccount(),
      actions.transfer(2n * yocto),
      actions.addFullAccessKey(key.getPublicKey()),
    ],
    waitUntil: "FINAL",
  });
  const account = new Account(id, provider, key.toString());
  if (contractArgs) {
    await account.signAndSendTransaction({
      receiverId: id,
      actions: [actions.deployContract(wasm), actions.functionCall("new", contractArgs, gas)],
      waitUntil: "FINAL",
    });
  }
  return account;
}

function call(actor, contract, methodName, args, deposit = 0n) {
  return actor.callFunctionRaw({ contractId: contract.accountId, methodName, args, deposit, gas, waitUntil: "FINAL" });
}

function toLittleEndian(value, width) {
  const buffer = Buffer.alloc(width);
  let remaining = BigInt(value);
  for (let index = 0; index < width; index++) {
    buffer[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  assert.equal(remaining, 0n);
  return buffer;
}

function borshString(value) {
  const bytes = Buffer.from(value);
  return Buffer.concat([toLittleEndian(bytes.length, 4), bytes]);
}

function quote(contract, payer, { order = randomUUID(), issued, expires, deployment = deploymentId } = {}) {
  const start = issued ?? Date.now() - 5_000;
  const end = expires ?? start + 5 * 60_000;
  const payload = Buffer.concat([
    borshString("glimpsea.checkout.quote.v1"),
    borshString(contract.accountId),
    deployment,
    Buffer.from(order.replaceAll("-", ""), "hex"),
    borshString(payer.accountId),
    toLittleEndian(price, 16),
    toLittleEndian(start, 8),
    toLittleEndian(end, 8),
  ]);
  return {
    order_id: order,
    issued_at_ms: String(start),
    expires_at_ms: String(end),
    signature: Buffer.from(signingKey.sign(payload).signature).toString("base64"),
  };
}

function payment(contract, orderId) {
  return provider.callFunction({ contractId: contract.accountId, method: "get_payment", args: { order_id: orderId } });
}

async function balance(account) {
  return BigInt((await provider.viewAccount({ accountId: account.accountId })).amount);
}

async function addSigner(account) {
  const key = KeyPair.fromRandom("ed25519");
  await account.signAndSendTransaction({
    receiverId: account.accountId,
    actions: [actions.addFullAccessKey(key.getPublicKey())],
    waitUntil: "FINAL",
  });
  return new Account(account.accountId, provider, key.toString());
}

try {
  const buyer = await createAccount("buyer");
  const other = await createAccount("other");
  const treasury = await createAccount("treasury");
  const args = { treasury: treasury.accountId, quote_key: quoteKey, deployment_id: deploymentId.toString("base64") };
  const checkout = await createAccount("pay", args);
  const secondCheckout = await createAccount("otherpay", args);
  const config = await provider.callFunction({ contractId: checkout.accountId, method: "get_config", args: {} });
  assert.equal(config.basic_price, String(price));
  assert.equal(config.quote_key, quoteKey);
  assert.equal(config.treasury, treasury.accountId);
  await assert.rejects(call(other, checkout, "new", args), /private|already initialized/i);

  const order = quote(checkout, buyer);
  for (const [actor, target, input, amount, error] of [
    [other, checkout, order, price, /Invalid quote signature/],
    [buyer, secondCheckout, order, price, /Invalid quote signature/],
    [buyer, checkout, quote(checkout, buyer, { deployment: randomBytes(32) }), price, /Invalid quote signature/],
    [buyer, checkout, { ...order, order_id: randomUUID() }, price, /Invalid quote signature/],
    [buyer, checkout, { ...order, order_id: order.order_id.toUpperCase() }, price, /canonical UUID/],
    [buyer, checkout, { ...order, signature: "AA==" }, price, /64 bytes/],
    [buyer, checkout, order, 0n, /exactly 0.01 NEAR/],
    [buyer, checkout, order, price + 1n, /exactly 0.01 NEAR/],
    [buyer, checkout, quote(checkout, buyer, { issued: 1, expires: 2000 }), price, /expired/],
    [buyer, checkout, quote(checkout, buyer, { issued: Date.now() + 60_000 }), price, /not active/],
    [buyer, checkout, quote(checkout, buyer, { expires: Date.now() + 18 * 60_000 }), price, /15 minutes/],
  ]) {
    const before = await balance(target);
    await assert.rejects(call(actor, target, "pay", input, amount), error);
    assert.equal(await payment(checkout, order.order_id), null);
    // Even a failed function call may credit its gas reward to the contract.
    const delta = await balance(target) - before;
    assert.ok(delta >= 0n && delta < price, "Rejected deposit must stay out of contract balance");
  }
  const balanceBefore = await balance(checkout);
  const paid = await call(buyer, checkout, "pay", order, price);
  const logs = paid.receipts_outcome.flatMap(({ outcome }) => outcome.logs);
  assert.ok(logs.some((log) => log.startsWith("EVENT_JSON:") && log.includes(order.order_id)));
  const record = await payment(checkout, order.order_id);
  assert.equal(record.payer, buyer.accountId);
  assert.equal(record.amount, String(price));
  assert.ok(BigInt(record.paid_at_ms) < BigInt(order.expires_at_ms));
  await assert.rejects(call(buyer, checkout, "pay", order, price), /already paid/);
  assert.deepEqual(await payment(checkout, order.order_id), record);
  const balanceAfterPay = await balance(checkout);
  assert.ok(balanceAfterPay >= balanceBefore + price);
  const buyerOtherSigner = await addSigner(buyer);
  const race = quote(checkout, buyer);
  const payments = await Promise.allSettled([
    call(buyer, checkout, "pay", race, price),
    call(buyerOtherSigner, checkout, "pay", race, price),
  ]);
  assert.equal(payments.filter(({ status }) => status === "fulfilled").length, 1);
  assert.match(String(payments.find(({ status }) => status === "rejected").reason), /already paid/);
  assert.equal((await payment(checkout, race.order_id)).payer, buyer.accountId);
  assert.ok(await balance(checkout) - balanceAfterPay < price * 2n);
  console.log("PASS fixed-price payment, payer and deployment binding, malformed inputs, expiry, concurrent replay, and refund on rejection");

  const amount = { amount: String(price) };
  await assert.rejects(call(other, checkout, "withdraw", amount, 1n), /Only the treasury/);
  await assert.rejects(call(treasury, checkout, "withdraw", amount), /attached deposit|1 yocto/i);
  await assert.rejects(call(treasury, checkout, "withdraw", { amount: "0" }, 1n), /positive amount/);
  const totalBalance = await balance(checkout);
  await assert.rejects(call(treasury, checkout, "withdraw", { amount: String(totalBalance) }, 1n), /liquid balance/);
  const beforeWithdrawal = await balance(checkout);
  await call(treasury, checkout, "withdraw", amount, 1n);
  const balanceAfterWithdrawal = await balance(checkout);
  assert.ok(balanceAfterWithdrawal >= beforeWithdrawal - price);
  assert.ok(balanceAfterWithdrawal < beforeWithdrawal);
  assert.deepEqual(await payment(checkout, order.order_id), record);

  const contractState = await provider.viewAccount({ accountId: checkout.accountId });
  const protocolConfig = await provider.experimental_protocolConfig({ finality: "final" });
  const storagePrice = BigInt(protocolConfig.runtime_config.storage_amount_per_byte);
  const liquid = BigInt(contractState.amount) - BigInt(contractState.storage_usage) * storagePrice;
  assert.ok(liquid > price);
  const withdrawal = { amount: String(liquid * 3n / 4n) };
  const treasuryOtherSigner = await addSigner(treasury);
  const concurrent = await Promise.allSettled([
    call(treasury, checkout, "withdraw", withdrawal, 1n),
    call(treasuryOtherSigner, checkout, "withdraw", withdrawal, 1n),
  ]);
  assert.equal(concurrent.filter(({ status }) => status === "fulfilled").length, 1, concurrent
    .filter(({ status }) => status === "rejected").map(({ reason }) => String(reason)).join("\n"));
  const rejected = concurrent.find(({ status }) => status === "rejected");
  assert.match(String(rejected.reason), /Insufficient liquid balance/);
  const balanceAfterConcurrent = await balance(checkout);
  assert.ok(balanceAfterConcurrent >= balanceAfterWithdrawal - BigInt(withdrawal.amount));
  assert.ok(balanceAfterConcurrent < balanceAfterWithdrawal);
  assert.deepEqual(await payment(checkout, order.order_id), record);
  console.log("PASS withdrawal authorization, storage reserve, and concurrent withdrawal accounting");
} finally {
  await sandbox.tearDown();
}
