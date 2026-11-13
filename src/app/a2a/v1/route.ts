import { after } from "next/server";
import { PRODUCT_CATEGORIES, type OrderInput, type SimulatedOffer } from "@/lib/a2a";
import { authorize, getTask, processTask, quote } from "@/lib/orders";

export const runtime = "nodejs";

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const maxRequestBytes = 8192;

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function rpc(id: string | number | null, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id, result }, { headers: { "Cache-Control": "no-store" } });
}

function fail(id: string | number | null, code: number, message: string, status = 200) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } }, { status });
}

async function readRequest(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let size = 0;
  let body = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return body + decoder.decode();
    size += value.byteLength;
    if (size > maxRequestBytes) {
      await reader.cancel();
      return null;
    }
    body += decoder.decode(value, { stream: true });
  }
}

function orderInput(value: unknown): OrderInput | undefined {
  const { country, audience, category, format, productionHours, budgetUsd, sellerNotes } = record(value);
  const supportedCategory = PRODUCT_CATEGORIES.find((item) => item === category);
  if (typeof country !== "string" || !/^[A-Za-z]{2}$/.test(country)
      || typeof audience !== "string" || !audience.trim() || audience.length > 180
      || (category !== undefined && !supportedCategory)
      || (format !== undefined && ((format !== "printable" && format !== "physical") || category !== undefined || budgetUsd !== undefined))
      || typeof productionHours !== "number" || !Number.isFinite(productionHours) || productionHours <= 0 || productionHours > 80
      || (budgetUsd !== undefined && (typeof budgetUsd !== "number" || !Number.isFinite(budgetUsd) || budgetUsd < 0 || budgetUsd > 100_000))
      || (sellerNotes !== undefined && (typeof sellerNotes !== "string" || sellerNotes.length > 1000))) return;
  return {
    country: country.toUpperCase(), audience: audience.trim(),
    ...(format && { format }),
    productionHours,
    ...(supportedCategory && { category: supportedCategory }),
    ...(budgetUsd !== undefined && { budgetUsd }),
    ...(typeof sellerNotes === "string" && sellerNotes.trim() && { sellerNotes: sellerNotes.trim() }),
  };
}

function paymentOffer(header: string): SimulatedOffer | undefined {
  if (!/^[A-Za-z0-9+/=]{1,2048}$/.test(header)) return;
  try {
    const { x402Version, accepted, payload } = record(JSON.parse(Buffer.from(header, "base64").toString("utf8")));
    const { scheme, network, asset, amount, quoteId, expiresAt } = record(accepted);
    if (x402Version === 2 && record(payload).mode === "simulation"
        && scheme === "glimpsea-simulation" && network === "glimpsea:local" && asset === "USDC"
        && typeof amount === "string" && typeof quoteId === "string" && idPattern.test(quoteId)
        && typeof expiresAt === "number") return { scheme, network, asset, amount, quoteId, expiresAt };
  } catch {
    return;
  }
}

export async function POST(request: Request) {
  const body = await readRequest(request);
  if (body === null) return fail(null, -32600, "Keep the request under 8 KB.", 413);
  let envelope: Record<string, unknown>;
  try {
    envelope = record(JSON.parse(body));
  } catch {
    return fail(null, -32700, "Send valid JSON.", 400);
  }
  const id = typeof envelope.id === "string" || typeof envelope.id === "number" ? envelope.id : null;
  if (envelope.jsonrpc !== "2.0" || id === null) return fail(null, -32600, "Send a JSON-RPC 2.0 request with an ID.", 400);
  const params = record(envelope.params);
  if (envelope.method === "GetTask") {
    const task = typeof params.id === "string" ? getTask(params.id) : undefined;
    if (!task) return fail(id, -32001, "Task not found. Use the ID from SendMessage.");
    if (task.status.state === "TASK_STATE_SUBMITTED" || task.status.state === "TASK_STATE_WORKING") {
      after(() => processTask(task.id));
    }
    return rpc(id, { task });
  }
  if (envelope.method !== "SendMessage") return fail(id, -32601, "Use SendMessage or GetTask.");

  const message = record(params.message);
  if (typeof message.messageId !== "string" || !idPattern.test(message.messageId)
      || message.role !== "ROLE_USER" || !Array.isArray(message.parts) || message.parts.length !== 1) {
    return fail(id, -32602, "Send one user message with a UUID and one part.");
  }
  const part = record(message.parts[0]);
  let input = part.data;
  if (typeof part.text === "string" && input === undefined) {
    try { input = JSON.parse(part.text); } catch { /* The next check reports the required fields. */ }
  }
  const order = orderInput(input);
  if (!order) return fail(id, -32602, "Send a country code, audience, and production hours. The optional category is digital, pod, or personalized.");

  const payment = request.headers.get("X-PAYMENT");
  if (payment === null) {
    const offer = quote(message.messageId, order);
    if (!offer) return fail(id, -32602, "This message ID belongs to another order. Use a new UUID.");
    return Response.json({ x402Version: 2, mode: "simulation", accepts: [offer] },
      { status: 402, headers: { "Cache-Control": "no-store" } });
  }

  const offer = paymentOffer(payment);
  const task = offer && authorize(message.messageId, order, offer);
  if (!task) return fail(id, -32002, "The simulated authorization did not match the quote. Start a new order.", 402);
  if (task.status.state === "TASK_STATE_SUBMITTED") after(() => processTask(task.id));
  return rpc(id, { task });
}
