import assert from "node:assert/strict";
import { sampleOrder } from "../src/lib/buyer";
import { research } from "../src/lib/research";

process.env.GLIMPSEA_RESEARCH_MODE = "fixture";
const fixture = await research(sampleOrder);
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
    return await research(sampleOrder);
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
