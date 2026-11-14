import { chatAvailable, sellerChat } from "@/lib/extension-chat";
import { analyzeDemo, browseDemoPage, contractQuoteDemo, createNewOpportunityReport, createOpportunityReport, demoJob, demoOwner, demoReport, ExtensionDemoError, failChatScan, ownerExceptions, listDemoJobs, payDemo, researchOwner, startDemo, trialsRemaining } from "@/lib/extension-demo";
import { after } from "next/server";
import { cookies } from "next/headers";
import { nearOwner, nearSessionCookie, requestNearToken, sessionAccount } from "@/lib/near-auth";
import { nearMode } from "@/lib/near-testnet";

export const runtime = "nodejs";

export function GET(request: Request) {
  const testnet = nearMode();
  const supportsEtsy = new URL(request.url).searchParams.get("etsy") === "1";
  return Response.json({ nearTestnet: testnet, simulation: !testnet && process.env.GLIMPSEA_EXTENSION_DEMO === "1",
    etsyLive: process.env.GLIMPSEA_ETSY_LIVE_BASIC === "1" && (!testnet || supportsEtsy), guestTrials: testnet, chat: testnet && chatAvailable(),
    chatContractCheckout: Boolean(process.env.GLIMPSEA_NEAR_CHECKOUT_CONTRACT && process.env.GLIMPSEA_NEAR_QUOTE_KEY_FILE),
    chatEtsy: supportsEtsy && process.env.GLIMPSEA_ETSY_LIVE_BASIC === "1" && process.env.GLIMPSEA_ETSY_AI_EVIDENCE === "1" },
    { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!nearMode() && process.env.GLIMPSEA_EXTENSION_DEMO !== "1") return new Response(null, { status: 404 });
  try {
    const testnet = nearMode();
    const guestToken = request.headers.get("X-Glimpsea-Demo");
    const guest = guestToken ? demoOwner(guestToken) : undefined;
    const token = requestNearToken(request) ?? (guest ? undefined : (await cookies()).get(nearSessionCookie)?.value);
    const accountId = testnet && (token || !guest) ? sessionAccount(token) : undefined;
    const owner = accountId ? nearOwner(accountId) : guest ?? demoOwner(undefined);
    const raw = await request.text();
    if (raw.length > 65_536) return Response.json({ error: "Request too large." }, { status: 413 });
    const input = JSON.parse(raw);
    if (input === null || typeof input !== "object" || Array.isArray(input)) {
      throw new ExtensionDemoError("Send a JSON object.");
    }
    const browserOwner = guest ?? owner;
    let result;
    switch (input.action) {
      case "owner-exceptions":
        if (!accountId || accountId !== process.env.GLIMPSEA_EXTENSION_OWNER_ACCOUNT) throw new ExtensionDemoError("Owner access required.", 403);
        result = { exceptions: ownerExceptions() };
        break;
      case "scan-failed": result = failChatScan(researchOwner(owner, guest, input.id), input.id); break;
      case "chat": result = await sellerChat(input); break;
      case "trials": result = { remaining: trialsRemaining(browserOwner), accountId }; break;
      case "start":
        if (input.access === "testnet-payment") {
          if (!accountId) throw new ExtensionDemoError("Connect a NEAR testnet wallet to pay.", 401);
          result = startDemo(owner, input, accountId);
        } else {
          if (testnet && input.access !== "trial") throw new ExtensionDemoError("Choose a trial or NEAR testnet checkout.");
          result = startDemo(browserOwner, input, undefined, testnet);
        }
        break;
      case "find-opportunities": result = createOpportunityReport(browserOwner, input.topic); break;
      case "generate-opportunities":
        result = await createNewOpportunityReport(researchOwner(owner, guest, input.sampleId), input);
        break;
      case "jobs": result = listDemoJobs(owner, browserOwner); break;
      case "contract-quote":
        if (!accountId) throw new ExtensionDemoError("Connect a NEAR testnet wallet first.", 401);
        result = await contractQuoteDemo(owner, accountId, input.id);
        break;
      case "pay":
        if (!accountId) throw new ExtensionDemoError("Connect a NEAR testnet wallet first.", 401);
        result = await payDemo(owner, accountId, input.id, input.txHash);
        break;
      case "status": result = demoJob(researchOwner(owner, guest, input.id), input.id); break;
      case "page": {
        const jobOwner = researchOwner(owner, guest, input.id);
        result = browseDemoPage(jobOwner, input.id, input.page, input.capture);
        const job = result.job;
        if (job.chat && job.state === "ready") after(() => analyzeDemo(jobOwner, job.id).then(() => undefined));
        break;
      }
      case "analyze": {
        const jobOwner = researchOwner(owner, guest, input.id);
        const job = demoJob(jobOwner, input.id);
        if (job.chat && ["ready", "analyzing"].includes(job.state)) {
          after(() => analyzeDemo(jobOwner, job.id).then(() => undefined));
          result = job;
        } else result = await analyzeDemo(jobOwner, input.id);
        break;
      }
      case "report": result = { markdown: demoReport(researchOwner(owner, guest, input.id), input.id) }; break;
      default: throw new ExtensionDemoError("Choose a demo action.");
    }
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ExtensionDemoError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return Response.json({ error: "Send valid JSON." }, { status: 400 });
    return Response.json({ error: "The demo could not finish this request." }, { status: 500 });
  }
}
