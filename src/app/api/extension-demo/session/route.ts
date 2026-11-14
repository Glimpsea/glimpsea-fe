import { NextResponse } from "next/server";
import { createReportSession, demoOwner, ExtensionDemoError, issueReportTicket, redeemReportTicket, researchOwner } from "@/lib/extension-demo";
import { nearOwner, requestNearToken, sessionAccount, sessionFingerprint } from "@/lib/near-auth";
import { nearMode } from "@/lib/near-testnet";

export async function POST(request: Request) {
  if (!nearMode() && process.env.GLIMPSEA_EXTENSION_DEMO !== "1") return new Response(null, { status: 404 });
  const token = request.headers.get("X-Glimpsea-Demo");
  try {
    const { id } = await request.json();
    const guest = token ? demoOwner(token) : undefined;
    const bearer = requestNearToken(request);
    const owner = nearMode() && bearer ? nearOwner(sessionAccount(bearer)) : guest ?? demoOwner(undefined);
    const reportOwner = researchOwner(owner, guest, id);
    const fingerprint = reportOwner.startsWith("near:testnet:") ? sessionFingerprint(bearer) : undefined;
    const ticket = issueReportTicket(reportOwner, id, fingerprint);
    return NextResponse.json({ reportPath: `/api/extension-demo/session?ticket=${ticket}` },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ExtensionDemoError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "Could not open the report." }, { status: 400 });
  }
}

export function GET(request: Request) {
  if (!nearMode() && process.env.GLIMPSEA_EXTENSION_DEMO !== "1") return new Response(null, { status: 404 });
  const url = new URL(request.url);
  try {
    const grant = redeemReportTicket(url.searchParams.get("ticket"));
    if (!grant) return new Response("The demo link expired. Open the report again from the extension.", { status: 404 });
    const path = `/reports/${grant.job_id}`;
    // Keep the report on the same host as the ticket, where its cookie is set.
    const response = new NextResponse(null, { status: 303, headers: { Location: path } });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    const session = createReportSession(grant.owner, grant.job_id);
    const options = {
      httpOnly: true, sameSite: "lax" as const, maxAge: 3600,
      secure: (process.env.GLIMPSEA_PUBLIC_ORIGIN ?? url.origin).startsWith("https:"),
    };
    response.cookies.set(`glimpsea_report_${grant.job_id}`, session, { ...options, path });
    response.cookies.set(`glimpsea_pdf_${grant.job_id}`, session, {
      ...options, path: `/api/market-report/${grant.job_id}/pdf`,
    });
    return response;
  } catch (error) {
    if (error instanceof ExtensionDemoError) return new Response("Invalid demo link.", { status: 404 });
    throw error;
  }
}
