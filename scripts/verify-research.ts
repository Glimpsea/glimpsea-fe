import assert from "node:assert/strict";
import { sampleOrder } from "../src/lib/buyer";
import { research } from "../src/lib/research";
import { cafeProductPlan, validateProductPlan } from "../src/lib/product-research";
import type { OrderInput } from "../src/lib/a2a";

process.env.GLIMPSEA_RESEARCH_MODE = "fixture";
const discovery = await research(sampleOrder);
assert.equal(discovery.brief.schemaVersion, 2);
assert.deepEqual(discovery.brief.concepts.map((idea) => idea.category), ["digital", "pod", "personalized"]);
const legacyOrder: OrderInput = { ...sampleOrder, format: "printable" };
const fixture = await research(legacyOrder);
assert.equal(fixture.brief.schemaVersion, 1);
const { concepts, decision, selectedConcept, recommendation, evidenceGap, test, criteria } = fixture.brief;
const plan = { concepts, decision, selectedConcept, recommendation, evidenceGap, test, criteria };

process.env.GLIMPSEA_RESEARCH_MODE = "near-ai-cloud";
process.env.NEAR_AI_API_KEY = "unused-in-test";
const originalFetch = globalThis.fetch;

async function runWithPlan(output: object, repair?: object) {
  let calls = 0;
  globalThis.fetch = Object.assign(async (_url: unknown, request?: RequestInit) => {
    calls++;
    if (calls > 1) {
      assert.equal(calls, 2);
      assert.ok(repair);
      const body = JSON.parse(String(request?.body));
      assert.equal(body.max_completion_tokens, 1300);
      assert.match(body.messages[0].content, /Fix this validation error/);
    }
    return Response.json({
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify(calls === 1 ? output : repair) } }],
      ...(repair && { usage: { prompt_tokens: 100, completion_tokens: 500 } }),
    });
  }, originalFetch);

  try {
    return await research(legacyOrder);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const accepted = await runWithPlan(plan);
assert.equal(accepted.brief.concepts.length, 3);

const rejectedConcepts = [
  { title: "Minimalist Coffee Order Icon Set", description: "A printable sheet for cafe menu boards." },
  { productType: "signage" },
  { wallPlacement: "On a table." },
  { deliverable: "A source illustration in SVG." },
  { productionHours: 4.5 },
];

for (const update of rejectedConcepts) {
  await assert.rejects(runWithPlan({
    ...plan,
    concepts: [concepts[0], { ...concepts[1], ...update }],
  }), /invalid research brief/);
}

await assert.rejects(runWithPlan({
  ...plan, recommendation: "Sell a matching menu board.",
}), /outside decorative wall art/);

process.env.GLIMPSEA_RESEARCH_MAX_TOKENS = "1800";
const repaired = await runWithPlan({ ...plan, concepts: [{ ...concepts[0], ...rejectedConcepts[0] }] }, plan);
assert.equal(repaired.brief.concepts.length, 3);
assert.equal(repaired.usage?.outputTokens, 1000);

console.log("PASS Wall art brief accepted. Off-scope alternatives, incomplete deliverables, and over-budget concepts rejected.");

const [digital, pod, personalized] = cafeProductPlan.concepts;
assert.throws(() => validateProductPlan({ ...cafeProductPlan, concepts: [digital, pod, { ...personalized, category: "pod" }] }, sampleOrder), /include one digital/);
assert.throws(() => validateProductPlan({ ...cafeProductPlan, concepts: [digital, pod, { ...personalized, productionHours: 4.5 }] }, sampleOrder), /production hours/);
assert.throws(() => validateProductPlan({ ...cafeProductPlan, concepts: [digital, pod, { ...personalized, personalizationInputs: ["Cafe name", "Opening hours"] }] }, sampleOrder), /exactly one buyer input/);
assert.throws(() => validateProductPlan({ ...cafeProductPlan, concepts: [digital, { ...pod, estimatedSetupUsd: 20 }, personalized] }, { ...sampleOrder, budgetUsd: 10 }), /within budget/);
assert.throws(() => validateProductPlan({ ...cafeProductPlan, selectedConcept: "Unknown idea" }, sampleOrder), /exact title/);
assert.throws(() => validateProductPlan(cafeProductPlan, { ...sampleOrder, category: "digital" }), /allowed product category/);
assert.equal(validateProductPlan({ ...cafeProductPlan, concepts: [digital] }, { ...sampleOrder, category: "digital" }).concepts.length, 1);
console.log("PASS Discovery requires three categories, respects time and budget, and selects an idea from the brief.");
