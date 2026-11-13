import { NextResponse } from "next/server";
import { createReportSession, demoOwner, ExtensionDemoError, issueReportTicket, redeemReportTicket } from "@/lib/extension-demo";
import { nearMode } from "@/lib/near-testnet";

export async function POST(request: Request) {
  if (nearMode() || process.env.GLIMPSEA_EXTENSION_DEMO !== "1") return new Response(null, { status: 404 });
  const token = request.headers.get("X-Glimpsea-Demo");
  try {
    const { id } = await request.json();
    const ticket = issueReportTicket(demoOwner(token), id);
    return NextResponse.json({ reportPath: `/api/extension-demo/session?ticket=${ticket}` },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ExtensionDemoError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "Could not open the report." }, { status: 400 });
  }
}

export function GET(request: Request) {
  if (nearMode() || process.env.GLIMPSEA_EXTENSION_DEMO !== "1") return new Response(null, { status: 404 });
  const url = new URL(request.url);
  try {
    const grant = redeemReportTicket(url.searchParams.get("ticket"));
    if (!grant) return new Response("The demo link expired. Open the report again from the extension.", { status: 404 });
    const path = `/reports/${grant.job_id}`;
    // Keep the report on the same host as the ticket, where its cookie is set.
    const response = new NextResponse(null, { status: 303, headers: { Location: path } });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.cookies.set(`glimpsea_report_${grant.job_id}`, createReportSession(grant.owner, grant.job_id), {
      httpOnly: true, sameSite: "lax", path, maxAge: 3600,
    });
    return response;
  } catch (error) {
    if (error instanceof ExtensionDemoError) return new Response("Invalid demo link.", { status: 404 });
    throw error;
  }
}
