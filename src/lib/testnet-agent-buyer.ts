import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Account, actions, baseEncode, encodeTransaction, type KeyPairString } from "near-api-js";
import { agentTestnetAccounts, provider, requireTestnet } from "./near-testnet";
import { reportOrigin } from "./market-report-format";
import type { OrderInput, Task, TestnetOffer } from "./a2a";

type Payment = { messageId: string; quoteId: string; order: OrderInput; endpoint: string; txHash: string };

export async function runTestnetAgentBuyer(input: { endpoint: string; order: OrderInput; maxAmount: bigint; pay: boolean } | { recover: string }) {
  const recovery = "recover" in input ? JSON.parse(readFileSync(input.recover, "utf8")) as Payment : undefined;
  const ticket = "endpoint" in input ? input : recovery;
  if (!ticket) throw new Error("Missing testnet order.");
  const { endpoint, order } = ticket;
  const messageId = recovery?.messageId ?? crypto.randomUUID();
  const signal = AbortSignal.timeout(240_000);
  const send = (method: string, params: object) => fetch(endpoint, {
    method: "POST", redirect: "error", signal, headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method, params }),
  });
  const request = { paymentMode: "near-testnet", message: { messageId, role: "ROLE_USER", parts: [{ data: order }] } };
  let payment = recovery;
  if ("endpoint" in input) {
    console.error(`Buyer → Requesting a quote for ${order.category ?? "Etsy product"} research for ${order.audience} (${order.country}), with up to ${order.productionHours} h to prototype.`);
    const response = await send("SendMessage", request);
    const { mode, accepts, error } = await response.json() as { mode?: string; accepts?: TestnetOffer[]; error?: { message: string } };
    const offer = accepts?.[0];
    const { payer, receiver } = agentTestnetAccounts();
    if (response.status !== 402 || mode !== "near-testnet" || offer?.scheme !== "glimpsea-near-transfer" ||
        offer.network !== "near:testnet" || offer.asset !== "NEAR" || offer.payer !== payer ||
        offer.receiver !== receiver || !/^[1-9]\d{0,29}$/.test(offer.amount) ||
        !/^[a-f0-9-]{36}$/.test(offer.quoteId) || !Number.isSafeInteger(offer.expiresAt) || offer.expiresAt <= Date.now()) {
      throw new Error(error?.message ?? "Glimpsea did not return a valid NEAR testnet quote.");
    }
    console.error(`Seller → ${nearAmount(BigInt(offer.amount))} NEAR testnet · ${offer.receiver}`);
    if (BigInt(offer.amount) > input.maxAmount) throw new Error("The quote exceeds the buyer's NEAR testnet budget.");
    if (!input.pay) return;
    const file = process.env.GLIMPSEA_A2A_TESTNET_BUYER_FILE;
    if (!file) throw new Error("Set GLIMPSEA_A2A_TESTNET_BUYER_FILE to the local testnet credential file.");
    const { id, account_id, secret, private_key } = JSON.parse(readFileSync(file, "utf8"));
    const key = secret ?? private_key;
    if ((id ?? account_id) !== offer.payer || typeof key !== "string" || !key.startsWith("ed25519:")) {
      throw new Error("Use the local Ed25519 credential for the configured buyer account.");
    }
    await requireTestnet();
    await provider.viewAccount({ accountId: offer.receiver });
    const buyer = new Account(offer.payer, provider, key as KeyPairString);
    mkdirSync(".data", { recursive: true, mode: 0o700 });
    const receipt = join(".data", `a2a-testnet-${messageId}.json`);
    const signed = await buyer.createSignedTransaction({ receiverId: offer.receiver,
      actions: [actions.transfer(BigInt(offer.amount))] });
    const txHash = baseEncode(createHash("sha256").update(encodeTransaction(signed.transaction)).digest());
    payment = { messageId, quoteId: offer.quoteId, txHash, order, endpoint };
    writeFileSync(receipt, JSON.stringify(payment), { mode: 0o600, flag: "wx" });
    console.error(`Buyer → https://testnet.nearblocks.io/txns/${txHash} · local receipt ${receipt}`);
    try {
      const sent = await provider.sendTransactionUntil(signed, "FINAL");
      if (sent.transaction.hash !== txHash) throw new Error("Unexpected transaction hash.");
    } catch {
      throw new Error(`Transaction status is uncertain. Check the explorer, then use --recover-testnet ${receipt} to verify the same payment again.`);
    }
  }
  if (!payment) throw new Error("Missing testnet payment proof.");
  let response = await send("SendMessage", { ...request, payment: { quoteId: payment.quoteId, txHash: payment.txHash } });
  async function readTask(response: Response) {
    const { result, error } = await response.json() as { result?: { task: Task }; error?: { message: string } };
    const task = result?.task;
    if (!response.ok || !task || task.metadata.payment.mode !== "near-testnet" ||
        task.metadata.payment.state !== "settled" || task.metadata.payment.txHash !== payment?.txHash) {
      throw new Error(error?.message ?? "Payment verification was not confirmed.");
    }
    return task;
  }
  let task = await readTask(response);
  console.error("Seller → NEAR testnet payment verified.");
  while (["TASK_STATE_SUBMITTED", "TASK_STATE_WORKING"].includes(task.status.state)) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    response = await send("GetTask", { id: task.id });
    task = await readTask(response);
  }
  const result = task.artifacts?.[0]?.parts[0]?.text;
  if (task.status.state !== "TASK_STATE_COMPLETED" || !result || !result.endsWith(new URL(`/reports/${task.id}`, reportOrigin()).href)) {
    throw new Error(task.status.message?.parts[0]?.text ?? "The report is pending. Keep the receipt and retry the same order.");
  }
  return result;
}

export function nearAmount(amount: bigint) {
  const value = amount.toString().padStart(25, "0");
  return `${value.slice(0, -24)}.${value.slice(-24).replace(/0+$/, "") || "0"}`;
}
