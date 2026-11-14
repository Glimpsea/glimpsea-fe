import { JsonRpcProvider } from "near-api-js";
import { ExtensionDemoError } from "./extension-errors";

export const testnetRpc = process.env.GLIMPSEA_NEAR_TESTNET_RPC || "https://rpc.testnet.fastnear.com";
export const provider = new JsonRpcProvider({ url: testnetRpc });
let confirmedNetwork: Promise<void> | undefined;

export function requireTestnet() {
  confirmedNetwork ??= provider.getNetworkId().then((network) => {
    if (network !== "testnet") throw new Error("Expected NEAR testnet.");
  }).catch(() => {
    confirmedNetwork = undefined;
    throw new ExtensionDemoError("Could not confirm the NEAR testnet RPC configuration.", 503);
  });
  return confirmedNetwork;
}

export function nearMode() {
  return process.env.GLIMPSEA_EXTENSION_NEAR_TESTNET === "1";
}

export function isAccountId(value: unknown): value is string {
  return typeof value === "string" && value.length >= 2 && value.length <= 64
    && /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value);
}

export function checkoutReceiver() {
  const receiver = process.env.GLIMPSEA_NEAR_TESTNET_RECEIVER;
  if (!isAccountId(receiver)) throw new ExtensionDemoError("Configure the NEAR testnet payment receiver.", 503);
  return receiver;
}

type TransferResult = {
  final_execution_status?: string;
  status?: { SuccessValue?: string };
  transaction?: {
    hash?: string;
    signer_id?: string;
    receiver_id?: string;
    actions?: { Transfer?: { deposit?: string } }[];
  };
};

export async function verifyTestnetTransfer(hash: unknown, payer: string, receiver: string, amount: string) {
  if (typeof hash !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{40,48}$/.test(hash)) {
    throw new ExtensionDemoError("Enter a valid NEAR transaction hash.");
  }
  await requireTestnet();
  let result: TransferResult;
  try {
    result = await provider.viewTransactionStatus({ txHash: hash, accountId: payer, waitUntil: "FINAL" }) as TransferResult;
  } catch {
    throw new ExtensionDemoError("The testnet transaction could not be confirmed yet. Retry verification with the same hash.", 409);
  }
  const tx = result.transaction;
  if (result.final_execution_status !== "FINAL" || typeof result.status?.SuccessValue !== "string") {
    throw new ExtensionDemoError("The testnet transaction is pending or failed.", 409);
  }
  if (tx?.hash !== hash || tx.signer_id !== payer || tx.receiver_id !== receiver
      || tx.actions?.length !== 1 || tx.actions[0].Transfer?.deposit !== amount) {
    throw new ExtensionDemoError("The transfer does not match the payer, receiver, or amount for this checkout.", 422);
  }
  return hash;
}

export function agentTestnetAccounts() {
  const payer = process.env.GLIMPSEA_A2A_TESTNET_BUYER_ACCOUNT?.trim() || "buyer.testnet";
  const receiver = process.env.GLIMPSEA_A2A_TESTNET_SELLER_ACCOUNT?.trim() || "seller.testnet";
  const isTestnetAccount = (value: string) => /^[a-f0-9]{64}$/.test(value) || (isAccountId(value) && value.endsWith(".testnet"));
  if (!isTestnetAccount(payer) || !isTestnetAccount(receiver) || payer === receiver) {
    throw new Error("Configure distinct NEAR testnet buyer and seller accounts.");
  }
  return { payer, receiver };
}
