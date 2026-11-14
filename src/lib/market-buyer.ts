import { Account, actions, encodeSignedDelegate, JsonRpcProvider, type KeyPairString } from "near-api-js";
import type { OrderInput } from "./a2a";
import { asObject, requireText } from "./product-research";
import { reportIdPattern, reportLine, reportOrigin } from "./market-report-format";
import { supportsResearchMarket } from "./research-order";

const market = "https://market.near.ai";
const accountId = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

type Task = {
  id: string;
  status: { state: string };
  artifacts?: { parts?: { text?: string }[] }[];
};

async function readJson(url: string | URL, init?: RequestInit) {
  const response = await fetch(url, { ...init, redirect: "error" });
  return { status: response.status, data: asObject(await response.json()) };
}

export async function runMarketBuyer({ handle, order, maxAmount, pay }: {
  handle: string;
  order: OrderInput;
  maxAmount: bigint;
  pay: boolean;
}) {
  if (!/^[a-z][a-z0-9-]{1,28}[a-z0-9]$/.test(handle)) throw new Error("Set a valid Agent Market handle.");
  if (!supportsResearchMarket(order.country)) throw new Error("Glimpsea supports the US and selected European markets.");
  const signal = AbortSignal.timeout(240_000);
  const catalog = await readJson(`${market}/v1/agents?q=${encodeURIComponent(handle)}`, { signal });
  const listing = Array.isArray(catalog.data.agents) && catalog.data.agents.map(asObject)
    .find((agent) => agent.handle === handle);
  if (catalog.status !== 200 || !listing) throw new Error(`Agent Market catalog did not return ${handle}.`);
  if (listing.available_now === false) throw new Error(`Agent Market reports ${handle} is unavailable.`);

  const origin = `https://${handle}.market.near.ai`;
  const card = await readJson(`${origin}/.well-known/agent-card.json`, { signal });
  const binding = Array.isArray(card.data.supportedInterfaces) && card.data.supportedInterfaces.map(asObject)
    .find((item) => item.protocolBinding === "JSONRPC" && item.protocolVersion === "1.0");
  if (card.status !== 200 || !binding || binding.url !== `${origin}/a2a/v1`) throw new Error("Invalid Agent Market A2A interface.");
  console.error(`Discovery → ${requireText(card.data.name, 100)} · ${binding.url}`);
  const send = (method: string, params: object, payment?: string) => readJson(binding.url as string, {
    method: "POST", signal,
    headers: { "Content-Type": "application/json", ...(payment && { "X-PAYMENT": payment }) },
    body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method, params }),
  });
  const payer = process.env.GLIMPSEA_MARKET_BUYER_ACCOUNT?.trim();
  const reports = pay ? reportOrigin() : undefined;
  const params = {
    message: { messageId: crypto.randomUUID(), role: "ROLE_USER", parts: [{ text: JSON.stringify(pay ? { ...order, reportBuyer: payer } : order) }] },
    configuration: { historyLength: 0 },
  };
  const challenge = await send("SendMessage", params);
  const offer = Array.isArray(challenge.data.accepts) && challenge.data.accepts.map(asObject)
    .find((item) => item.scheme === "exact" && item.network === "near:mainnet");
  if (challenge.status !== 402 || challenge.data.x402Version !== 2 || !offer ||
      typeof offer.amount !== "string" || !/^[1-9]\d{0,11}$/.test(offer.amount) ||
      typeof offer.asset !== "string" || !accountId.test(offer.asset) ||
      typeof offer.payTo !== "string" || !accountId.test(offer.payTo) ||
      typeof offer.maxTimeoutSeconds !== "number" || !Number.isSafeInteger(offer.maxTimeoutSeconds) ||
      offer.maxTimeoutSeconds <= 0) {
    throw new Error("Agent Market did not return a valid NEAR mainnet x402 quote.");
  }
  console.error(`Seller → ${Number(offer.amount) / 1_000_000} USDC · ${offer.network} · ${offer.payTo}`);
  if (BigInt(offer.amount) > maxAmount) throw new Error("The quote exceeds the buyer's budget.");
  if (!pay) return;

  const asset = process.env.GLIMPSEA_MARKET_USDC_CONTRACT?.trim();
  const treasury = process.env.GLIMPSEA_MARKET_TREASURY?.trim();
  const key = process.env.GLIMPSEA_MARKET_BUYER_KEY?.trim();
  if (!asset || !treasury || asset !== offer.asset || treasury !== offer.payTo) {
    throw new Error("The quote does not match the configured USDC contract and marketplace treasury.");
  }
  if (!payer || !accountId.test(payer) || payer.endsWith(".testnet") || !key?.startsWith("ed25519:")) {
    throw new Error("Set a dedicated NEAR mainnet buyer account and its Ed25519 key.");
  }
  const provider = new JsonRpcProvider({ url: "https://rpc.mainnet.fastnear.com" });
  if (await provider.getNetworkId() !== "mainnet") throw new Error("Expected NEAR mainnet RPC.");
  const buyer = new Account(payer, provider, key as KeyPairString);
  const { signedDelegate } = await buyer.createSignedMetaTransaction({
    receiverId: asset,
    actions: [actions.functionCall("ft_transfer", { receiver_id: treasury, amount: offer.amount }, 30_000_000_000_000n, 1n)],
    blockHeightTtl: offer.maxTimeoutSeconds,
  });
  const payment = Buffer.from(JSON.stringify({
    x402Version: 2, accepted: offer,
    payload: { signedDelegateAction: Buffer.from(encodeSignedDelegate(signedDelegate)).toString("base64") },
  })).toString("base64");

  let reply;
  try {
    reply = await send("SendMessage", params, payment);
  } catch {
    throw new Error("Payment submission status is unknown. Check Agent Market activity before placing another order.");
  }
  if (reply.status !== 200 || reply.data.error) throw new Error(`Agent Market did not accept the paid call (HTTP ${reply.status}).`);
  let task = asObject(asObject(reply.data.result).task) as Task;
  const taskId = requireText(task.id, 128);
  console.error("Buyer → x402 authorization sent.");
  const artifactText = () => task.artifacts?.flatMap((artifact) => artifact.parts ?? []).map((part) => part.text).filter(Boolean).join("\n\n");
  while (["TASK_STATE_SUBMITTED", "TASK_STATE_WORKING"].includes(task.status?.state) ||
         (task.status?.state === "TASK_STATE_COMPLETED" && !artifactText())) {
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    const poll = await send("GetTask", { id: taskId, historyLength: 0 });
    if (poll.status !== 200 || poll.data.error) throw new Error(`Could not read Agent Market task ${taskId}.`);
    task = asObject(poll.data.result) as Task;
  }
  if (task.status?.state !== "TASK_STATE_COMPLETED") throw new Error(`Agent Market task ${taskId} ended in ${task.status?.state ?? "an unknown state"}.`);
  const brief = artifactText();
  if (!brief) throw new Error(`Agent Market completed task ${taskId} without a brief.`);
  const firstLine = brief.split("\n", 1)[0];
  const id = firstLine.match(/\/reports\/([a-f0-9-]+)\)$/)?.[1];
  if (!reports || !id || !reportIdPattern.test(id) || firstLine !== reportLine(new URL(`/reports/${id}`, reports).href)) {
    throw new Error("Payment completed, but Glimpsea's report link is missing. Check the order before paying again.");
  }
  const url = new URL(`/reports/${id}`, reports);
  try {
    const activation = await fetch(new URL("/api/market-report", reports), {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(15_000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, taskId }),
    });
    if (!activation.ok || asObject(await activation.json()).ok !== true) throw new Error();
  } catch {
    throw new Error("Payment completed, but report access could not be activated. Recover it from the existing order before paying again.");
  }
  console.error("Seller → Brief delivered and x402 settlement verified.");
  return `${brief.slice(firstLine.length).trim()}\n\nOpen the Glimpsea report: ${url.href}`;
}
