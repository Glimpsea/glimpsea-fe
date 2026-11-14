import { createHash, createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { PRODUCT_CATEGORIES, type OrderInput } from "./a2a";
import { catalogPath, demoCatalogPage, demoListing, summarizeDemoCatalog, type DemoListingCapture } from "./demo-catalog";
import { db } from "./orders";
import { research } from "./research";
import { renderEtsyBrief } from "./etsy-brief";
import { ExtensionDemoError } from "./extension-errors";
import { accountForSessionFingerprint, nearOwner } from "./near-auth";
import { checkoutReceiver, verifyTestnetTransfer } from "./near-testnet";
import { opportunitySnapshotDate, opportunityTopic, readOpportunityInput, renderNewOpportunityBrief, renderOpportunityBrief } from "./opportunity-brief";

export { ExtensionDemoError } from "./extension-errors";

const plans = { basic: 2, medium: 5, deep: 10 } as const;
type Plan = keyof typeof plans;
const testnetPrices = { basic: 10n ** 22n, medium: 3n * 10n ** 22n, deep: 6n * 10n ** 22n };
type Checkout = { id: string; owner: string; receiver: string; amount: string; tx_hash: string | null };
type Capture = { page: number; listings: DemoListingCapture[]; hasNext: boolean; nextUrl?: string };
type DemoOrder = OrderInput & { collection?: "dom" | "etsy" };
type StoredOrder = DemoOrder | { collection: "opportunities"; topic: string; snapshot: string };
type Job = {
  id: string;
  owner: string;
  plan: Plan;
  access: "trial" | "simulated-payment" | "testnet-payment" | "snapshot" | "opportunity";
  keyword: string;
  order_json: string;
  pages: number;
  state: "awaiting-payment" | "browsing" | "ready" | "analyzing" | "complete" | "failed";
  markdown: string | null;
  lease_until: number | null;
};

function database() {
  const database = db();
  database.exec(`
    CREATE TABLE IF NOT EXISTS extension_demo_jobs (
      id TEXT PRIMARY KEY, owner TEXT NOT NULL, plan TEXT NOT NULL, access TEXT NOT NULL,
      keyword TEXT NOT NULL, order_json TEXT NOT NULL, pages INTEGER NOT NULL DEFAULT 0,
      state TEXT NOT NULL DEFAULT 'browsing', markdown TEXT, lease_until INTEGER
    );
    CREATE INDEX IF NOT EXISTS extension_demo_owner ON extension_demo_jobs(owner, access, state);
    CREATE TABLE IF NOT EXISTS extension_demo_captures (
      job_id TEXT NOT NULL, page INTEGER NOT NULL, capture_json TEXT NOT NULL, PRIMARY KEY (job_id, page)
    );
    CREATE TABLE IF NOT EXISTS extension_demo_tickets (
      ticket TEXT PRIMARY KEY, job_id TEXT NOT NULL, owner TEXT NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS extension_demo_tickets_expiry ON extension_demo_tickets(expires_at);
    CREATE TABLE IF NOT EXISTS extension_demo_configuration (id INTEGER PRIMARY KEY, session_key TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS extension_testnet_checkouts (
      id TEXT PRIMARY KEY, owner TEXT NOT NULL, receiver TEXT NOT NULL, amount TEXT UNIQUE NOT NULL,
      tx_hash TEXT UNIQUE
    );
  `);
  return database;
}

export function demoOwner(token: unknown) {
  if (typeof token !== "string" || !/^[a-f0-9-]{36}$/.test(token)) {
    throw new ExtensionDemoError("Open this demo from the Glimpsea extension.", 401);
  }
  return createHash("sha256").update(token).digest("hex");
}

export function trialsRemaining(owner: string) {
  const row = database().prepare(`
    SELECT count(*) AS used FROM extension_demo_jobs WHERE owner = ? AND access = 'trial' AND state != 'failed'
  `).get(owner) as { used: number };
  return Math.max(0, 2 - row.used);
}

export function startDemo(owner: string, input: Record<string, unknown>, nearAccount?: string, nearTestnet = Boolean(nearAccount)) {
  const { keyword, plan, access, category, productionHours, audience } = input;
  if (typeof keyword !== "string" || !keyword.trim() || keyword.length > 120
      || typeof audience !== "string" || !audience.trim() || audience.length > 180
      || (plan !== "basic" && plan !== "medium" && plan !== "deep")
      || (access !== "trial" && access !== (nearAccount ? "testnet-payment" : "simulated-payment"))
      || typeof productionHours !== "number" || !Number.isFinite(productionHours)
      || productionHours <= 0 || productionHours > 80) {
    throw new ExtensionDemoError("Choose a package, enter a keyword and audience, and set seller work from 0 to 80 hours.");
  }
  const supported = PRODUCT_CATEGORIES.find((item) => item === category);
  if (category !== undefined && !supported) throw new ExtensionDemoError("Choose a supported category.");
  if (access === "trial" && plan !== "basic") throw new ExtensionDemoError("Trials use the Basic package.");
  const collection = input.collection === "etsy" ? "etsy" : input.collection === "dom" ? "dom" : undefined;
  if (collection === "etsy" && (process.env.GLIMPSEA_ETSY_LIVE_BASIC !== "1" || plan !== "basic")) {
    throw new ExtensionDemoError("Etsy live is available only for the enabled Basic pilot.");
  }
  if (collection !== "etsy" && demoCatalogPage(keyword, 1).listings.length === 0) {
    throw new ExtensionDemoError("No results in the sample catalog. Try cafe owner supplies.");
  }
  const id = randomUUID();
  const order: DemoOrder = { country: "US", audience: audience.trim(), productionHours,
    ...(supported && { category: supported }), collection };
  if (nearAccount && access === "testnet-payment") {
    const receiver = checkoutReceiver();
    if (nearAccount === receiver) throw new ExtensionDemoError("Use a different wallet from the payment receiver.");
    const connection = database();
    connection.exec("BEGIN IMMEDIATE");
    try {
      let amount: string;
      do {
        amount = (testnetPrices[plan] + BigInt(randomInt(1, 10 ** 12)) * 10n ** 6n).toString();
      } while (connection.prepare("SELECT 1 FROM extension_testnet_checkouts WHERE amount = ?").get(amount));
      connection.prepare("INSERT INTO extension_testnet_checkouts (id, owner, receiver, amount) VALUES (?, ?, ?, ?)")
        .run(id, owner, receiver, amount);
      connection.prepare(`
        INSERT INTO extension_demo_jobs (id, owner, plan, access, keyword, order_json, state)
        VALUES (?, ?, ?, ?, ?, ?, 'awaiting-payment')
      `).run(id, owner, plan, access, keyword.trim(), JSON.stringify(order));
      connection.exec("COMMIT");
    } catch (error) {
      connection.exec("ROLLBACK");
      throw error;
    }
    return demoJob(owner, id);
  }
  const trialAccess = access === "trial" ? "trial" : "simulated-payment";
  const result = database().prepare(`
    INSERT INTO extension_demo_jobs (id, owner, plan, access, keyword, order_json)
    SELECT ?, ?, ?, ?, ?, ?
    WHERE ? != 'trial' OR (
      SELECT count(*) FROM extension_demo_jobs WHERE owner = ? AND access = 'trial' AND state != 'failed'
    ) < 2
  `).run(id, owner, plan, trialAccess, keyword.trim(), JSON.stringify(order), trialAccess, owner);
  if (result.changes === 0) throw new ExtensionDemoError(nearTestnet
    ? "Both Basic trials are used. Pay on NEAR testnet to start another research job."
    : "Both demo trials are used. Choose simulated payment.", 402);
  return demoJob(owner, id);
}

export function researchOwner(owner: string, guest: string | undefined, id: unknown) {
  if (!guest || owner === guest || typeof id !== "string") return owner;
  const job = database().prepare("SELECT owner FROM extension_demo_jobs WHERE id = ? AND owner IN (?, ?)")
    .get(id, owner, guest) as { owner: string } | undefined;
  return job?.owner ?? owner;
}

function readJob(owner: string, id: unknown): Job {
  const job = typeof id === "string"
    ? database().prepare("SELECT * FROM extension_demo_jobs WHERE id = ? AND owner = ?").get(id, owner) as Job | undefined
    : undefined;
  if (!job) throw new ExtensionDemoError("Research job not found.", 404);
  return job;
}

export function createOpportunityReport(owner: string, topicId: unknown) {
  const topic = opportunityTopic(topicId);
  if (!topic) throw new ExtensionDemoError("Choose a supported research topic.");

  const order = JSON.stringify({ collection: "opportunities", topic: topicId, snapshot: opportunitySnapshotDate });
  const connection = database();
  connection.exec("BEGIN IMMEDIATE");
  let id: string;
  try {
    const saved = connection.prepare(`
      SELECT id FROM extension_demo_jobs WHERE owner = ? AND access = 'snapshot' AND order_json = ?
    `).get(owner, order) as { id: string } | undefined;
    id = saved?.id ?? randomUUID();
    if (!saved) {
      connection.prepare(`
        INSERT INTO extension_demo_jobs (id, owner, plan, access, keyword, order_json, state, markdown)
        VALUES (?, ?, 'basic', 'snapshot', ?, ?, 'complete', ?)
      `).run(id, owner, topic.title, order, renderOpportunityBrief(topic));
    }
    connection.exec("COMMIT");
  } catch (error) {
    connection.exec("ROLLBACK");
    throw error;
  }
  return demoJob(owner, id);
}

export async function createNewOpportunityReport(owner: string, input: Record<string, unknown>) {
  const sample = readJob(owner, input.sampleId);
  const order = JSON.parse(sample.order_json) as StoredOrder;
  if (sample.state !== "complete" || order.collection !== "etsy") {
    throw new ExtensionDemoError("Finish an Etsy live analysis before generating ideas.");
  }
  const seller = readOpportunityInput({ ...input, audience: order.audience, productionHours: order.productionHours });
  const { pagesRead, listings } = summarizeCaptures(sample);
  const markdown = await renderNewOpportunityBrief(seller, {
    id: sample.id, keyword: sample.keyword, pages: pagesRead, listings: listings.length,
  });
  const id = randomUUID();
  database().prepare(`
    INSERT INTO extension_demo_jobs (id, owner, plan, access, keyword, order_json, state, markdown)
    VALUES (?, ?, 'basic', 'opportunity', ?, ?, 'complete', ?)
  `).run(id, owner, seller.topic || sample.keyword, JSON.stringify({
    collection: "opportunities", seller, sampleId: sample.id, snapshot: opportunitySnapshotDate,
  }), markdown);
  return demoJob(owner, id);
}

export function demoJob(owner: string, id: unknown) {
  const job = readJob(owner, id);
  const order = JSON.parse(job.order_json) as StoredOrder;
  const { collection } = order;
  const checkout = job.access === "testnet-payment" ? readCheckout(owner, job.id) : undefined;
  return {
    id: job.id, state: job.state, pages: job.pages, limit: plans[job.plan], keyword: job.keyword, collection,
    ...(order.collection === "etsy" && { audience: order.audience, productionHours: order.productionHours }),
    ...(collection === "dom" && job.state === "browsing" && { catalogPath: catalogPath(job.keyword, job.pages + 1) }),
    ...(collection === "etsy" && job.state === "browsing" && job.pages > 0 && { nextUrl: savedCapture(job, job.pages).nextUrl }),
    ...(collection && job.pages > 0 && { listings: summarizeCaptures(job).listings }),
    ...(checkout && { checkout: { receiver: checkout.receiver, amount: checkout.amount, txHash: checkout.tx_hash } }),
    ...(job.state === "complete" && { reportPath: `/reports/${job.id}` }),
  };
}

export function listDemoJobs(owner: string, guest = owner) {
  const jobs = database().prepare(`
    SELECT id, keyword, plan, state, access FROM extension_demo_jobs WHERE owner IN (?, ?) ORDER BY rowid DESC LIMIT 20
  `).all(owner, guest) as Pick<Job, "id" | "keyword" | "plan" | "state" | "access">[];
  return { jobs };
}

function readCheckout(owner: string, id: unknown) {
  const checkout = typeof id === "string" ? database().prepare("SELECT * FROM extension_testnet_checkouts WHERE id = ? AND owner = ?")
    .get(id, owner) as Checkout | undefined : undefined;
  if (!checkout) throw new ExtensionDemoError("Testnet checkout not found.", 404);
  return checkout;
}

export async function payDemo(owner: string, account: string, id: unknown, hash: unknown) {
  const checkout = readCheckout(owner, id);
  if (checkout.tx_hash && checkout.tx_hash === hash) return demoJob(owner, checkout.id);
  if (checkout.tx_hash) throw new ExtensionDemoError("This checkout already has a verified payment.", 409);
  const txHash = await verifyTestnetTransfer(hash, account, checkout.receiver, checkout.amount);
  const connection = database();
  connection.exec("BEGIN IMMEDIATE");
  try {
    const result = connection.prepare(`
      UPDATE OR IGNORE extension_testnet_checkouts SET tx_hash = ? WHERE id = ? AND tx_hash IS NULL
    `).run(txHash, checkout.id);
    if (!result.changes && readCheckout(owner, checkout.id).tx_hash !== txHash) {
      throw new ExtensionDemoError("This transaction or checkout was already used.", 409);
    }
    connection.prepare(`UPDATE extension_demo_jobs SET state = 'browsing' WHERE id = ? AND state = 'awaiting-payment'`).run(checkout.id);
    connection.exec("COMMIT");
  } catch (error) {
    connection.exec("ROLLBACK");
    throw error;
  }
  return demoJob(owner, checkout.id);
}

function readCapture(input: unknown, job: Job, page: number): Capture {
  const { listings, nextUrl, page: capturedPage } = (input ?? {}) as { listings?: unknown; nextUrl?: unknown; page?: unknown };
  const catalogOrigin = process.env.GLIMPSEA_PUBLIC_ORIGIN ?? "http://127.0.0.1:3045";
  const next = new URL(catalogPath(job.keyword, page + 1), catalogOrigin).href;
  if (capturedPage !== page || (nextUrl !== null && nextUrl !== next) || !Array.isArray(listings)
      || listings.length === 0 || listings.length > 3) {
    throw new ExtensionDemoError("Read this page from the demo catalog before continuing.");
  }
  const unique = new Map<string, DemoListingCapture>();
  for (const listing of listings) {
    if (!listing || typeof listing.title !== "string" || !listing.title.trim() || listing.title.length > 200
        || (listing.price !== null && (typeof listing.price !== "string" || listing.price.length > 60))
        || typeof listing.url !== "string") {
      throw new ExtensionDemoError("The demo page returned an invalid listing.");
    }
    const url = URL.parse(listing.url);
    const routeId = url?.origin === catalogOrigin
      ? /^\/demo-catalog\/listing\/(\d+|(?:digital|pod|personalized)-\d+)$/.exec(url.pathname)?.[1]
      : undefined;
    const fixture = routeId && demoListing(routeId);
    if (!fixture || fixture.category !== listing.category
        || (listing.listingId !== undefined && listing.listingId !== fixture.listingId)) {
      throw new ExtensionDemoError("The demo page returned an invalid listing.");
    }
    if (!unique.has(fixture.listingId)) {
      unique.set(fixture.listingId, { listingId: fixture.listingId, title: listing.title, price: listing.price,
        url: new URL(`/demo-catalog/listing/${fixture.listingId}`, catalogOrigin).href, category: fixture.category });
    }
  }
  return { page, listings: Array.from(unique.values()), hasNext: nextUrl !== null };
}

function matchesEtsySearch(value: unknown, keyword: string, page: number) {
  if (typeof value !== "string" || value.length > 2048) return false;
  const url = URL.parse(value);
  return url?.origin === "https://www.etsy.com" && url.pathname === "/search"
    && !url.username && !url.password && url.searchParams.get("q") === keyword
    && (url.searchParams.get("page") ?? "1") === String(page);
}

function readEtsyCapture(input: unknown, job: Job, page: number): Capture {
  if (process.env.GLIMPSEA_ETSY_LIVE_BASIC !== "1") throw new ExtensionDemoError("Etsy live is disabled.");
  const capture = (input ?? {}) as Record<string, unknown>;
  const { listings, nextUrl } = capture;
  if (capture.page !== page || !matchesEtsySearch(capture.url, job.keyword, page)
      || (nextUrl !== null && !matchesEtsySearch(nextUrl, job.keyword, page + 1))
      || !Array.isArray(listings) || listings.length === 0 || listings.length > 100) {
    throw new ExtensionDemoError("Read the expected Etsy search page before continuing.");
  }
  const unique = new Map<string, DemoListingCapture>();
  for (const listing of listings) {
    if (!listing || typeof listing.listingId !== "string" || !/^\d{1,20}$/.test(listing.listingId)
        || typeof listing.title !== "string" || !listing.title.trim() || listing.title.length > 250
        || (listing.price !== null && (typeof listing.price !== "string" || listing.price.length > 60))) {
      throw new ExtensionDemoError("Etsy returned an invalid listing.");
    }
    const { listingId, title, price } = listing;
    if (!unique.has(listingId)) unique.set(listingId, { listingId, title, price, url: `https://www.etsy.com/listing/${listingId}` });
  }
  return { page, listings: Array.from(unique.values()), hasNext: nextUrl !== null,
    ...(typeof nextUrl === "string" && { nextUrl }) };
}

function savedCapture(job: Job, page: number): Capture {
  const row = database().prepare("SELECT capture_json FROM extension_demo_captures WHERE job_id = ? AND page = ?")
    .get(job.id, page) as { capture_json: string };
  return JSON.parse(row.capture_json);
}

export function browseDemoPage(owner: string, id: unknown, page: unknown, capture?: unknown) {
  const job = readJob(owner, id);
  if (job.state === "awaiting-payment") throw new ExtensionDemoError("Verify the testnet payment before browsing.", 402);
  if (typeof page !== "number" || !Number.isInteger(page) || page < 1 || page > plans[job.plan]
      || page > job.pages + 1 || (page > job.pages && job.state !== "browsing")) {
    throw new ExtensionDemoError("Read pages in order up to the package limit.");
  }
  const collection = (JSON.parse(job.order_json) as DemoOrder).collection;
  if (collection) {
    const connection = database();
    if (page <= job.pages) {
      return { ...savedCapture(job, page), job: demoJob(owner, job.id) };
    }
    const result = collection === "etsy" ? readEtsyCapture(capture, job, page) : readCapture(capture, job, page);
    const state = !result.hasNext || page === plans[job.plan] ? "ready" : "browsing";
    connection.exec("BEGIN IMMEDIATE");
    try {
      const update = connection.prepare(`
        UPDATE extension_demo_jobs SET pages = ?, state = ? WHERE id = ? AND state = 'browsing' AND pages = ?
      `).run(page, state, job.id, job.pages);
      if (!update.changes) throw new ExtensionDemoError("The job has moved to another page. Resume research.", 409);
      connection.prepare("INSERT INTO extension_demo_captures VALUES (?, ?, ?)").run(job.id, page, JSON.stringify(result));
      connection.exec("COMMIT");
    } catch (error) {
      connection.exec("ROLLBACK");
      throw error;
    }
    return { ...result, job: demoJob(owner, job.id) };
  }
  const result = demoCatalogPage(job.keyword, page);
  if (page === job.pages + 1) {
    const state = !result.hasNext || page === plans[job.plan] ? "ready" : "browsing";
    database().prepare(`
      UPDATE extension_demo_jobs SET pages = ?, state = ? WHERE id = ? AND state = 'browsing' AND pages = ?
    `).run(page, state, job.id, job.pages);
  }
  return { ...result, job: demoJob(owner, job.id) };
}

export async function analyzeDemo(owner: string, id: unknown) {
  const job = readJob(owner, id);
  if (job.state === "awaiting-payment") throw new ExtensionDemoError("Verify the testnet payment before analysis.", 402);
  const now = Date.now();
  const lease = now + 90_000;
  const claim = database().prepare(`
    UPDATE extension_demo_jobs SET state = 'analyzing', lease_until = ?
    WHERE id = ? AND (state = 'ready' OR (state = 'analyzing' AND lease_until <= ?))
  `).run(lease, job.id, now);
  if (!claim.changes) return demoJob(owner, job.id);

  try {
    const order = JSON.parse(job.order_json) as DemoOrder;
    const markdown = order.collection === "etsy" ? etsyReport(job, order) : (await research(order, order.collection === "dom"
      ? summarizeCaptures(job) : summarizeDemoCatalog(job.keyword, plans[job.plan], job.pages))).markdown;
    database().prepare(`
      UPDATE extension_demo_jobs SET markdown = ?, state = 'complete', lease_until = NULL
      WHERE id = ? AND state = 'analyzing' AND lease_until = ?
    `).run(markdown, job.id, lease);
  } catch {
    database().prepare(`
      UPDATE extension_demo_jobs SET state = 'failed', lease_until = NULL
      WHERE id = ? AND state = 'analyzing' AND lease_until = ?
    `).run(job.id, lease);
  }
  return demoJob(owner, job.id);
}

function summarizeCaptures(job: Job) {
  const rows = database().prepare("SELECT capture_json FROM extension_demo_captures WHERE job_id = ? ORDER BY page")
    .all(job.id) as { capture_json: string }[];
  const unique = new Map<string, DemoListingCapture>();
  for (const row of rows) {
    for (const listing of (JSON.parse(row.capture_json) as Capture).listings) {
      const id = listing.listingId ?? demoListing(listing.url.split("/").at(-1) ?? "")?.listingId ?? listing.url;
      if (!unique.has(id)) unique.set(id, listing);
    }
  }
  const listings = Array.from(unique.values());
  const counts = { digital: 0, pod: 0, personalized: 0 };
  for (const listing of listings) if (listing.category) counts[listing.category]++;
  return { source: "glimpsea-synthetic-catalog", keyword: job.keyword, maxPages: plans[job.plan],
    pagesRead: rows.length, counts, titles: listings.map(({ title }) => title), listings };
}

function etsyReport(job: Job, order: DemoOrder) {
  const { pagesRead, listings } = summarizeCaptures(job);
  return renderEtsyBrief({ keyword: job.keyword, pagesRead, limit: plans[job.plan], listings, order });
}

export function demoReport(owner: string, id: string) {
  const job = readJob(owner, id);
  if (job.state !== "complete" || !job.markdown) throw new ExtensionDemoError("The report is not ready.", 404);
  // Older live reports have saved captures and can gain the brief without another scan.
  if (job.markdown.includes("\n### Listings read from Etsy\n") && job.markdown.startsWith("## Etsy live search\n")) {
    return etsyReport(job, JSON.parse(job.order_json) as DemoOrder);
  }
  return job.markdown;
}

export function issueReportTicket(owner: string, id: string, fingerprint?: string) {
  demoReport(owner, id);
  const ticket = randomUUID();
  const connection = database();
  connection.prepare("DELETE FROM extension_demo_tickets WHERE expires_at <= ?").run(Date.now());
  connection.prepare("INSERT INTO extension_demo_tickets VALUES (?, ?, ?, ?)")
    .run(demoOwner(ticket), id, fingerprint ? `${owner}|${fingerprint}` : owner, Date.now() + 60_000);
  return ticket;
}

export function redeemReportTicket(ticket: unknown) {
  return database().prepare(`
    DELETE FROM extension_demo_tickets WHERE ticket = ? AND expires_at > ? RETURNING job_id, owner
  `).get(demoOwner(ticket), Date.now()) as { job_id: string; owner: string } | undefined;
}

let sessionKey: string | undefined;

function reportSignature(owner: string, id: string, expiry: string) {
  if (!sessionKey) {
    const connection = database();
    connection.prepare("INSERT OR IGNORE INTO extension_demo_configuration VALUES (1, ?)").run(randomUUID());
    const configuration = connection.prepare("SELECT session_key FROM extension_demo_configuration WHERE id = 1")
      .get() as { session_key: string };
    sessionKey = configuration.session_key;
  }
  return createHmac("sha256", sessionKey).update(`${owner}.${id}.${expiry}`).digest();
}

export function createReportSession(owner: string, id: string) {
  const expiry = String(Date.now() + 3_600_000);
  return `${owner}.${expiry}.${reportSignature(owner, id, expiry).toString("hex")}`;
}

export function reportSessionOwner(token: string | undefined, id: string) {
  const match = /^(?<grant>[a-z0-9:._|-]+)\.(?<expiry>\d{13})\.(?<signature>[0-9a-f]{64})$/.exec(token ?? "");
  if (!match?.groups) return;
  const { grant, expiry, signature } = match.groups;
  if (Number(expiry) <= Date.now()
      || !timingSafeEqual(Buffer.from(signature, "hex"), reportSignature(grant, id, expiry))) return;
  if (/^[0-9a-f]{64}$/.test(grant)) return grant;
  const [owner, fingerprint] = grant.split("|");
  if (!/^[0-9a-f]{64}$/.test(fingerprint ?? "")) return;
  const account = accountForSessionFingerprint(fingerprint);
  if (account && nearOwner(account) === owner) return owner;
}
