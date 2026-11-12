import assert from "node:assert/strict";
import { runBuyer, sampleOrder } from "../src/lib/buyer";

const endpoint = process.env.GLIMPSEA_A2A_URL || "http://127.0.0.1:3000/a2a/v1";
const missingKey = process.argv.includes("--missing-cloud-key");

async function send(method: string, params: object, payment?: string) {
  return fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(payment && { "X-PAYMENT": payment }) },
    body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method, params }),
  });
}

const valid = await runBuyer({ endpoint });
assert.equal(valid.status.state, missingKey ? "TASK_STATE_FAILED" : "TASK_STATE_COMPLETED");
assert.equal(valid.metadata.payment.state, missingKey ? "released" : "settled");
if (missingKey) {
  assert.equal(valid.artifacts, undefined);
  assert.match(valid.status.message?.parts[0]?.text ?? "", /NEAR_AI_API_KEY/);
  console.log("PASS Cloud configuration failure releases the simulated payment.");
} else {
  const text = valid.artifacts?.[0]?.parts[0]?.text ?? "";
  const json = text.match(/```json\s*([\s\S]+?)\s*```/)?.[1];
  assert.ok(json, "The agent needs a JSON block in the delivered brief.");
  const brief = JSON.parse(json);
  assert.equal(brief.schemaVersion, 1);
  assert.ok(brief.concepts.length <= 3);
  assert.ok(brief.concepts.every((concept: { productionHours: number }) => concept.productionHours <= 4));
  assert.ok(["test", "defer"].includes(brief.decision));
  assert.ok(brief.test);
  assert.ok(valid.metadata.research?.provider);
  console.log("PASS Buyer received a readable brief and the simulated payment settled.");
}

const rejected = await runBuyer({ endpoint, order: { ...sampleOrder, country: "JP" } });
assert.equal(rejected.status.state, "TASK_STATE_REJECTED");
assert.equal(rejected.metadata.payment.state, "released");
assert.equal(rejected.artifacts, undefined);
console.log("PASS The agent rejected an unsupported market and released the simulated payment.");

await assert.rejects(runBuyer({ endpoint, maxAmount: 1n }), /exceeds/);
console.log("PASS The buyer did not authorize a quote above its budget.");

const messageId = crypto.randomUUID();
const params = { message: { messageId, role: "ROLE_USER", parts: [{ data: sampleOrder }] } };
const price = await send("SendMessage", params);
assert.equal(price.status, 402);
const quote = (await price.json()).accepts[0];
const payment = btoa(JSON.stringify({ x402Version: 2, accepted: quote, payload: { mode: "simulation" } }));
const modified = { message: { ...params.message, parts: [{ data: { ...sampleOrder, productionHours: 2 } }] } };
const refused = await send("SendMessage", modified, payment);
assert.equal(refused.status, 402);
assert.equal((await refused.json()).error.code, -32002);

const duplicateCalls = await Promise.all([send("SendMessage", params, payment), send("SendMessage", params, payment)]);
const [first, second] = await Promise.all(duplicateCalls.map(async (call) => (await call.json()).result.task));
assert.equal(first.id, second.id);
const task = (await (await send("GetTask", { id: first.id })).json()).result.task;
assert.equal(task.id, first.id);
console.log("PASS The quote binds to the order and concurrent retries return the same task.");

const card = await fetch(new URL("/.well-known/agent-card.json", endpoint));
assert.equal(card.status, 200);
assert.equal((await card.json()).name, "Glimpsea");
console.log("PASS The buyer can discover the local agent card.");
