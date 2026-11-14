import { setTimeout as sleep } from "node:timers/promises";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Database } from "bun:sqlite";
import { asObject, requireText } from "../src/lib/product-research";
import { readResearchOrder, supportsResearchMarket } from "../src/lib/research-order";
import { marketBuyerPattern, marketReportsSchema, reportLine, reportOrigin } from "../src/lib/market-report-format";
import { research } from "../src/lib/research";

const token = process.env.GLIMPSEA_MARKET_AGENT_TOKEN?.trim();
const assignmentId = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const leaseMs = 120_000;

async function api(path: string, body?: object) {
  const response = await fetch(`https://market.near.ai/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, ...(body && { "Content-Type": "application/json" }) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Agent Market ${path} returned HTTP ${response.status}.`);
  return response;
}

async function poll(stored: Database) {
  const { assignments } = asObject(await (await api("agents/me/assignments")).json());
  if (!Array.isArray(assignments)) throw new Error("Invalid Agent Market assignment list.");
  for (const item of assignments) {
    const { assignment, job } = asObject(item);
    const { assignmentId: id, status, startedAt, submittedAt, slaDeadlineAt } = asObject(assignment);
    if (typeof id !== "string" || !assignmentId.test(id) || status !== "in_progress" || submittedAt) continue;
    const deadline = typeof slaDeadlineAt === "string" ? Date.parse(slaDeadlineAt) : NaN;
    if (!Number.isFinite(deadline) || deadline <= Date.now()) continue;
    const route = `assignments/${id}`;
    const now = Date.now();
    const leaseUntil = now + leaseMs;
    const claimed = stored.query(`
      INSERT INTO market_delivery_leases (assignment_id, until_ms) VALUES (?, ?)
      ON CONFLICT(assignment_id) DO UPDATE SET until_ms = excluded.until_ms
      WHERE market_delivery_leases.until_ms <= ?
    `).run(id, leaseUntil, now);
    if (!claimed.changes) continue;
    try {
      const saved = stored.query("SELECT markdown FROM market_deliverables WHERE assignment_id = ?").get(id) as { markdown: string } | null;
      if (saved) {
        await api(`${route}/submit`, { deliverableMarkdown: saved.markdown });
        console.log(`Agent Market → delivered ${id}`);
        continue;
      }

      let order;
      let reportBuyer: string | undefined;
      try {
        const description = asObject(JSON.parse(requireText(asObject(job).description, 4000)));
        order = readResearchOrder(description);
        if (description.reportBuyer !== undefined) {
          const buyer = description.reportBuyer;
          if (typeof buyer !== "string" || buyer.length < 2 || buyer.length > 64 || !marketBuyerPattern.test(buyer) || order?.format) {
            order = undefined;
          } else {
            reportBuyer = buyer;
          }
        }
      } catch {
        // The listing accepts a structured order in the text part of SendMessage.
      }
      if (!order || !supportsResearchMarket(order.country)) {
        await api(`${route}/decline`, {
          reason: startedAt ? "failed" : "rejected",
          detail: "Send a JSON Etsy research order with country, audience, and productionHours for the US or a supported European market.",
        });
        continue;
      }
      if (!startedAt) await api(`${route}/start`, {});
      console.log(`Agent Market → researching ${id}`);
      let markdown: string;
      try {
        const result = await research(order, undefined, "gemini");
        markdown = result.markdown;
        if (reportBuyer) {
          const reportId = crypto.randomUUID();
          const url = new URL(`/reports/${reportId}`, reportOrigin());
          const delivery = `${reportLine(url.href)}\n\n${result.brief.recommendation}`;
          stored.exec("BEGIN IMMEDIATE");
          try {
            stored.query("INSERT INTO market_reports (id, assignment_id, buyer, order_json, brief_json) VALUES (?, ?, ?, ?, ?)")
              .run(reportId, id, reportBuyer, JSON.stringify(order), JSON.stringify(result.brief));
            stored.query("INSERT INTO market_deliverables (assignment_id, markdown) VALUES (?, ?)").run(id, delivery);
            stored.exec("COMMIT");
          } catch (error) {
            stored.exec("ROLLBACK");
            throw error;
          }
          markdown = delivery;
        } else {
          stored.query("INSERT INTO market_deliverables (assignment_id, markdown) VALUES (?, ?)").run(id, markdown);
        }
      } catch {
        await api(`${route}/decline`, { reason: "failed", detail: "Glimpsea could not prepare a valid research brief." });
        continue;
      }
      if (deadline > Date.now()) {
        await api(`${route}/submit`, { deliverableMarkdown: markdown });
        console.log(`Agent Market → delivered ${id}`);
      }
    } catch (error) {
      console.error(`Assignment ${id}: ${error instanceof Error ? error.message : "request failed"}`);
    } finally {
      stored.query("DELETE FROM market_delivery_leases WHERE assignment_id = ? AND until_ms = ?").run(id, leaseUntil);
    }
  }
}

try {
  if (!token?.startsWith("aat_")) throw new Error("Set GLIMPSEA_MARKET_AGENT_TOKEN to the listing's agent API token.");
  if (!process.env.GLIMPSEA_SELLER_GEMINI_API_KEY?.trim()) throw new Error("Set GLIMPSEA_SELLER_GEMINI_API_KEY.");
  const path = resolve(process.env.GLIMPSEA_MARKET_DB_PATH || ".data/market-worker.sqlite");
  mkdirSync(dirname(path), { recursive: true });
  const stored = new Database(path);
  stored.exec(`
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    ${marketReportsSchema}
    CREATE TABLE IF NOT EXISTS market_deliverables (assignment_id TEXT PRIMARY KEY, markdown TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS market_delivery_leases (assignment_id TEXT PRIMARY KEY, until_ms INTEGER NOT NULL);
  `);
  if (process.argv.includes("--once")) await poll(stored);
  else {
    for (;;) {
      await poll(stored).catch((error: unknown) => console.error(error instanceof Error ? error.message : "Could not poll Agent Market."));
      await sleep(30_000);
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Agent Market worker failed.");
  process.exitCode = 1;
}
