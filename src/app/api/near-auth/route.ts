import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createPair, loginChallenge, nearSessionCookie, redeemPair, requestNearToken, revokeSession, sessionAccount, verifyLogin } from "@/lib/near-auth";
import { nearMode } from "@/lib/near-testnet";
import { ExtensionDemoError } from "@/lib/extension-errors";

export async function POST(request: Request) {
  if (!nearMode()) return new Response(null, { status: 404 });
  const origin = new URL(request.url).origin;
  try {
    const input = await request.json();
    let result;
    switch (input?.action) {
      case "pair": result = createPair(origin); break;
      case "challenge": result = loginChallenge(input.id, origin); break;
      case "redeem": result = redeemPair(input.id, input.pairSecret); break;
      case "account": result = { accountId: sessionAccount(requestNearToken(request) ?? (await cookies()).get(nearSessionCookie)?.value) }; break;
      case "logout": {
        revokeSession(requestNearToken(request) ?? (await cookies()).get(nearSessionCookie)?.value);
        const response = NextResponse.json({ ok: true });
        response.cookies.delete(nearSessionCookie);
        return response;
      }
      case "verify": {
        const { accountId, token } = await verifyLogin(input, origin);
        const response = NextResponse.json({ accountId }, { headers: { "Cache-Control": "no-store" } });
        response.cookies.set(nearSessionCookie, token, {
          httpOnly: true, sameSite: "lax", secure: origin.startsWith("https:"), path: "/", maxAge: 86_400,
        });
        return response;
      }
      default: throw new ExtensionDemoError("Choose a wallet action.");
    }
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ExtensionDemoError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return Response.json({ error: "Send valid JSON." }, { status: 400 });
    return Response.json({ error: "Could not complete wallet sign-in." }, { status: 500 });
  }
}
