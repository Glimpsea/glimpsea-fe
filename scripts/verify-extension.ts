import assert from "node:assert/strict";

const origin = process.env.GLIMPSEA_EXTENSION_URL || "http://127.0.0.1:3045";
const owner = crypto.randomUUID();
const other = crypto.randomUUID();
const example = { keyword: "cafe owner supplies", audience: "US cafe owners", productionHours: 4 };

async function post(action: string, data = {}, token = owner, suffix = "") {
  return fetch(`${origin}/api/extension-demo${suffix}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Glimpsea-Demo": token },
    body: JSON.stringify({ action, ...data }),
  });
}

async function ok(action: string, data = {}) {
  const response = await post(action, data);
  assert.ok(response.ok, await response.clone().text());
  return response.json();
}

assert.equal((await ok("trials")).remaining, 2);
assert.equal((await post("start", { ...example, plan: "medium", access: "trial" })).status, 400);
assert.equal((await post("start", { ...example, plan: "basic" })).status, 400);
assert.equal((await post("start", { ...example, keyword: "no match 123", plan: "basic", access: "trial" })).status, 400);
assert.equal((await ok("trials")).remaining, 2);

const trial = await Promise.all(Array.from({ length: 3 }, () => post("start", { ...example, plan: "basic", access: "trial" })));
assert.deepEqual(trial.map((response) => response.status).sort(), [200, 200, 402]);
const basic = await trial.find((response) => response.ok)!.json();
assert.equal((await ok("trials")).remaining, 0);
assert.equal((await ok("analyze", { id: basic.id })).state, "browsing");
assert.equal((await post("page", { id: basic.id, page: 2 })).status, 400);

for (const [plan, limit] of [["basic", 2], ["medium", 5], ["deep", 10]] as const) {
  const job = plan === "basic" ? basic : await ok("start", { ...example, plan, access: "simulated-payment" });
  assert.equal(job.limit, limit);
  for (let page = 1; page <= limit; page++) {
    const result = await ok("page", { id: job.id, page });
    assert.equal(result.source, "glimpsea-synthetic-catalog");
    assert.equal(result.job.pages, page);
  }
  assert.equal((await ok("page", { id: job.id, page: 1 })).job.pages, limit);
  assert.equal((await post("page", { id: job.id, page: limit + 1 })).status, 400);
  const complete = await ok("analyze", { id: job.id });
  assert.equal(complete.state, "complete");
  const { markdown } = await ok("report", { id: job.id });
  const brief = JSON.parse(markdown.split("\n```json\n")[1].split("\n```")[0]);
  assert.equal(brief.catalogEvidence.pagesRead, limit);
  assert.equal(brief.catalogEvidence.source, "glimpsea-synthetic-catalog");
  assert.deepEqual(brief.concepts.map((idea: { category: string }) => idea.category).sort(), ["digital", "personalized", "pod"]);
}
console.log("PASS Two Basic trials, simulated access, page caps, duplicate page reads, and three-category reports.");

assert.equal((await post("report", { id: basic.id }, other)).status, 404);
assert.equal((await post("open", { id: basic.id }, other, "/session")).status, 404);
assert.equal((await fetch(`${origin}/reports/${basic.id}`)).status, 404);
const launch = await post("open", { id: basic.id }, owner, "/session");
assert.ok(launch.ok);
const { reportPath } = await launch.json();
const redirect = await fetch(origin + reportPath, { redirect: "manual" });
assert.equal(redirect.status, 303);
const redirectLocation = redirect.headers.get("Location");
assert.ok(redirectLocation);
const location = new URL(redirectLocation, origin);
assert.equal(location.origin, origin);
assert.equal(location.pathname, `/reports/${basic.id}`);
const cookie = redirect.headers.get("Set-Cookie")?.split(";")[0];
assert.ok(cookie);
const report = await fetch(location, { headers: { Cookie: cookie } });
assert.equal(report.status, 200);
assert.match(await report.text(), /Coffee Tasting Flight Kit/);
assert.equal((await fetch(origin + reportPath)).status, 404);
console.log("PASS The report requires the owner session. The temporary link works once.");

const short = await ok("start", { ...example, keyword: "cafe name stamp", plan: "deep", access: "simulated-payment" });
const lastPage = await ok("page", { id: short.id, page: 1 });
assert.equal(lastPage.job.state, "ready");
assert.equal(lastPage.job.pages, 1);
assert.equal((await post("page", { id: short.id, page: 2 })).status, 400);

const failingTrial = await post("start", { ...example, productionHours: 1, plan: "basic", access: "trial" }, other);
assert.equal(failingTrial.status, 200);
const { id } = await failingTrial.json();
for (const page of [1, 2]) assert.ok((await post("page", { id, page }, other)).ok);
assert.equal((await (await post("analyze", { id }, other)).json()).state, "failed");
assert.equal((await (await post("trials", {}, other)).json()).remaining, 2);
console.log("PASS Browsing stops when results run out. A failed analysis releases the trial.");
