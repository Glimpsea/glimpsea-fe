import { analyzeDemo, browseDemoPage, createNewOpportunityReport, createOpportunityReport, demoJob, demoOwner, demoReport, ExtensionDemoError, listDemoJobs, payDemo, startDemo, trialsRemaining } from "@/lib/extension-demo";
import { cookies } from "next/headers";
import { nearOwner, nearSessionCookie, requestNearToken, sessionAccount } from "@/lib/near-auth";
import { nearMode } from "@/lib/near-testnet";

export const runtime = "nodejs";

export function GET() {
  return Response.json({ nearTestnet: nearMode(), simulation: !nearMode() && process.env.GLIMPSEA_EXTENSION_DEMO === "1",
    etsyLive: process.env.GLIMPSEA_ETSY_LIVE_BASIC === "1" },
    { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!nearMode() && process.env.GLIMPSEA_EXTENSION_DEMO !== "1") return new Response(null, { status: 404 });
  try {
    const accountId = nearMode() ? sessionAccount(requestNearToken(request) ?? (await cookies()).get(nearSessionCookie)?.value) : undefined;
    const owner = accountId ? nearOwner(accountId) : demoOwner(request.headers.get("X-Glimpsea-Demo"));
    const raw = await request.text();
    if (raw.length > 65_536) return Response.json({ error: "Request too large." }, { status: 413 });
    const input = JSON.parse(raw);
    if (input === null || typeof input !== "object" || Array.isArray(input)) {
      throw new ExtensionDemoError("Send a JSON object.");
    }
    let result;
    switch (input.action) {
      case "trials": result = { remaining: trialsRemaining(owner), accountId }; break;
      case "start": result = startDemo(owner, input, accountId); break;
      case "find-opportunities": result = createOpportunityReport(owner, input.topic); break;
      case "generate-opportunities": result = await createNewOpportunityReport(owner, input); break;
      case "jobs": result = listDemoJobs(owner); break;
      case "pay":
        if (!accountId) throw new ExtensionDemoError("Connect a NEAR testnet wallet first.", 401);
        result = await payDemo(owner, accountId, input.id, input.txHash);
        break;
      case "status": result = demoJob(owner, input.id); break;
      case "page": result = browseDemoPage(owner, input.id, input.page, input.capture); break;
      case "analyze": result = await analyzeDemo(owner, input.id); break;
      case "report": result = { markdown: demoReport(owner, input.id) }; break;
      default: throw new ExtensionDemoError("Choose a demo action.");
    }
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ExtensionDemoError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return Response.json({ error: "Send valid JSON." }, { status: 400 });
    return Response.json({ error: "The demo could not finish this request." }, { status: 500 });
  }
}
