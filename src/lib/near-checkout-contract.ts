import { createPrivateKey, createPublicKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { baseEncode } from "near-api-js";
import { ExtensionDemoError } from "./extension-errors";
import { isAccountId, provider, requireTestnet } from "./near-testnet";

export const basicContractPrice = "10000000000000000000000";
const domain = "glimpsea.checkout.quote.v1";
const quoteLifetimeMs = 10 * 60_000;
const final = { finality: "final" } as const;
let verifiedConfig: Promise<{ id: string; key: ReturnType<typeof createPrivateKey>; deployment: Buffer }> | undefined;

export function configuredCheckoutContract() {
  const id = process.env.GLIMPSEA_NEAR_CHECKOUT_CONTRACT;
  if (!isAccountId(id) || !id.endsWith(".testnet") || !process.env.GLIMPSEA_NEAR_QUOTE_KEY_FILE) {
    throw new ExtensionDemoError("Contract checkout is unavailable on this server.", 503);
  }
  return id;
}

async function quoteConfig() {
  verifiedConfig ??= (async () => {
    const id = configuredCheckoutContract();
    const key = createPrivateKey(readFileSync(process.env.GLIMPSEA_NEAR_QUOTE_KEY_FILE!));
    if (key.asymmetricKeyType !== "ed25519") throw new Error("Expected Ed25519");
    const { x } = createPublicKey(key).export({ format: "jwk" });
    if (!x) throw new Error("Missing public key");
    await requireTestnet();
    const config = await provider.callFunction<{ deployment_id: string; quote_key: string; basic_price: string }>({
      contractId: id, method: "get_config", args: {}, blockQuery: final,
    });
    const deployment = Buffer.from(config?.deployment_id ?? "", "base64");
    if (deployment.length !== 32 || config?.basic_price !== basicContractPrice
        || config.quote_key !== "ed25519:" + baseEncode(Buffer.from(x, "base64url"))) {
      throw new Error("Checkout configuration mismatch");
    }
    return { id, key, deployment };
  })().catch(() => {
    verifiedConfig = undefined;
    throw new ExtensionDemoError("Could not verify the testnet checkout configuration.", 503);
  });
  return verifiedConfig;
}

function borshString(value: string) {
  const bytes = Buffer.from(value);
  const length = Buffer.alloc(4);
  length.writeUInt32LE(bytes.length);
  return Buffer.concat([length, bytes]);
}

export async function createCheckoutQuote(receiver: string, orderId: string, payer: string) {
  const { id, key, deployment } = await quoteConfig();
  if (id !== receiver) throw new ExtensionDemoError("Quote signing is unavailable for this checkout.", 503);
  const issued = Date.now() - 5_000;
  const expires = issued + quoteLifetimeMs;
  const values = Buffer.alloc(32);
  const price = BigInt(basicContractPrice);
  values.writeBigUInt64LE(price & ((1n << 64n) - 1n));
  values.writeBigUInt64LE(price >> 64n, 8);
  values.writeBigUInt64LE(BigInt(issued), 16);
  values.writeBigUInt64LE(BigInt(expires), 24);
  const bytes = Buffer.concat([
    borshString(domain), borshString(id), deployment, Buffer.from(orderId.replaceAll("-", ""), "hex"),
    borshString(payer), values,
  ]);
  return { order_id: orderId, issued_at_ms: String(issued), expires_at_ms: String(expires),
    signature: sign(null, bytes, key).toString("base64") };
}

export async function verifyCheckoutReceipt(receiver: string, orderId: string, payer: string) {
  await requireTestnet();
  let payment;
  try {
    payment = await provider.callFunction<{ payer: string; amount: string; paid_at_ms: string }>({
      contractId: receiver, method: "get_payment", args: { order_id: orderId }, blockQuery: final,
    });
  } catch {
    throw new ExtensionDemoError("Could not check payment on NEAR testnet. Try verification again.", 503);
  }
  if (!payment) return false;
  if (payment.payer !== payer || payment.amount !== basicContractPrice || !/^\d{1,16}$/.test(payment.paid_at_ms)) {
    throw new ExtensionDemoError("The on-chain payment does not match this order.", 422);
  }
  return true;
}

export async function checkoutReceiptHash(hash: unknown, payer: string, contractId: string, orderId: string) {
  if (typeof hash !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{40,48}$/.test(hash)) return null;
  try {
    const tx = await provider.viewTransactionStatus({ txHash: hash, accountId: payer, waitUntil: "FINAL" });
    const action = tx.transaction.actions[0];
    if (tx.final_execution_status !== "FINAL" || typeof tx.status !== "object" || !("SuccessValue" in tx.status)
      || tx.transaction.hash !== hash || tx.transaction.signer_id !== payer || tx.transaction.receiver_id !== contractId
      || tx.transaction.actions.length !== 1 || typeof action === "string" || !("FunctionCall" in action)
      || action.FunctionCall.method_name !== "pay" || String(action.FunctionCall.deposit) !== basicContractPrice) return null;
    const args = JSON.parse(Buffer.from(action.FunctionCall.args, "base64").toString("utf8"));
    return args.order_id === orderId ? hash : null;
  } catch {
    return null;
  }
}
