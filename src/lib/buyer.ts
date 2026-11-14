import type { OrderInput, SimulatedOffer, Task } from "./a2a";

export const sampleOrder: OrderInput = {
  country: "US",
  audience: "US cafe owners",
  productionHours: 4,
};

export type BuyerEvent = {
  step: "quote" | "authorized" | "working" | "completed" | "rejected" | "failed";
  detail: string;
};

type BuyerOptions = {
  endpoint?: string;
  signal?: AbortSignal;
  onEvent?: (event: BuyerEvent) => void;
  order?: OrderInput;
  maxAmount?: bigint;
};

type TaskResponse = { result?: { task: Task }; error?: { message: string } };

async function readResponse<T extends object>(response: Response): Promise<T> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Glimpsea could not read the simulation response (HTTP ${response.status}).`);
  }
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Glimpsea returned an invalid simulation response.");
  }
  return payload as T;
}

async function readTask(response: Response) {
  const body = await readResponse<TaskResponse>(response);
  if (!response.ok || !body.result?.task) {
    throw new Error(body.error?.message ?? "The agent did not return a task. Start a new order.");
  }
  const task = body.result.task;
  if (task.metadata?.payment?.mode !== "simulated") throw new Error("Use a Glimpsea simulation endpoint.");
  return task;
}

async function waitForPoll(signal?: AbortSignal) {
  signal?.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    function abort() {
      clearTimeout(timer);
      reject(signal?.reason);
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, 1000);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

export async function runBuyer({
  endpoint = "/a2a/v1", signal: callerSignal, onEvent, order = sampleOrder, maxAmount = 2_500_000n,
}: BuyerOptions = {}): Promise<Task> {
  const timeout = AbortSignal.timeout(240_000);
  const signal = callerSignal ? AbortSignal.any([callerSignal, timeout]) : timeout;
  const send = (method: string, params: object, payment?: string) => fetch(endpoint, {
    method: "POST",
    redirect: "error",
    signal,
    headers: { "Content-Type": "application/json", ...(payment && { "X-PAYMENT": payment }) },
    body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method, params }),
  });
  const params = { message: { messageId: crypto.randomUUID(), role: "ROLE_USER", parts: [{ data: order }] } };
  const price = await send("SendMessage", params);
  const quote = await readResponse<{ x402Version?: number; accepts?: SimulatedOffer[]; error?: { message: string } }>(price);
  const offer = quote.accepts?.[0];
  if (price.status !== 402 || quote.x402Version !== 2 || offer?.scheme !== "glimpsea-simulation"
      || offer.network !== "glimpsea:local" || offer.asset !== "USDC" || !/^\d{1,12}$/.test(offer.amount)) {
    throw new Error(quote.error?.message ?? "Glimpsea did not return a simulated quote.");
  }
  const amount = (Number(offer.amount) / 1_000_000).toFixed(2);
  onEvent?.({ step: "quote", detail: `${amount} USDC quoted for this simulation.` });
  if (BigInt(offer.amount) > maxAmount) throw new Error("The quote exceeds the agent's budget.");
  const payment = btoa(JSON.stringify({ x402Version: 2, accepted: offer, payload: { mode: "simulation" } }));
  let task = await readTask(await send("SendMessage", params, payment));
  onEvent?.({ step: "authorized", detail: "The buyer agent authorized the simulated payment." });
  let working = false;
  while (task.status.state === "TASK_STATE_SUBMITTED" || task.status.state === "TASK_STATE_WORKING") {
    if (!working) {
      onEvent?.({ step: "working", detail: "Glimpsea is preparing the brief." });
      working = true;
    }
    await waitForPoll(signal);
    task = await readTask(await send("GetTask", { id: task.id }));
  }
  if (task.status.state === "TASK_STATE_COMPLETED") {
    onEvent?.({ step: "completed", detail: "The buyer agent received the brief. The simulated payment settled." });
  } else {
    onEvent?.({
      step: task.status.state === "TASK_STATE_REJECTED" ? "rejected" : "failed",
      detail: task.status.message?.parts[0]?.text ?? "Glimpsea released the simulated payment.",
    });
  }
  return task;
}
