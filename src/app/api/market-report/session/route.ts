import { NextResponse } from "next/server";
import { marketReportChallenge, marketReportCookie, verifyMarketReportLogin } from "@/lib/market-reports";
import { reportIdPattern, reportOrigin } from "@/lib/market-report-format";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== reportOrigin()) return new Response(null, { status: 403 });
  try {
    const input = await request.json();
    if (typeof input?.id !== "string" || !reportIdPattern.test(input.id)) return new Response(null, { status: 404 });
    const headers = { "Cache-Control": "no-store" };
    if (input.action === "challenge") {
      const challenge = marketReportChallenge(input.id);
      if (challenge) return NextResponse.json(challenge, { headers });
    }
    if (input.action === "verify") {
      const login = await verifyMarketReportLogin(input.id, input);
      if (login) {
        const response = NextResponse.json({ ok: true }, { headers });
        response.cookies.set(marketReportCookie(login.network), login.token, {
          httpOnly: true, sameSite: "lax", secure: reportOrigin().startsWith("https:"), path: "/", maxAge: 86_400,
        });
        return response;
      }
    }
    return NextResponse.json({ error: "Use the NEAR wallet that paid for this report." }, { status: 401, headers });
  } catch (error) {
    if (error instanceof SyntaxError) return new Response(null, { status: 400 });
    return NextResponse.json({ error: "Report access is temporarily unavailable." }, { status: 503 });
  }
}
