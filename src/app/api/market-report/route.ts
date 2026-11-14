import { settleMarketReport } from "@/lib/market-reports";
import { reportIdPattern } from "@/lib/market-report-format";

export async function POST(request: Request) {
  try {
    const { id, taskId } = await request.json();
    if (typeof id !== "string" || !reportIdPattern.test(id) || typeof taskId !== "string" || !/^[\w-]{1,128}$/.test(taskId)) {
      return Response.json({ error: "Invalid report or task." }, { status: 400 });
    }
    if (await settleMarketReport(id, taskId)) return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    return Response.json({ error: "Settlement could not be confirmed." }, { status: 409 });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ error: "Invalid request." }, { status: 400 });
    return Response.json({ error: "Agent Market verification is unavailable." }, { status: 503 });
  }
}
