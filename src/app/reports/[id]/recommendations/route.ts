import { ExtensionDemoError, recommendForSavedReport } from "@/lib/extension-demo";
import { nearMode } from "@/lib/near-testnet";
import { reportOwner } from "../report-owner";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if ((!nearMode() && process.env.GLIMPSEA_EXTENSION_DEMO !== "1") || !/^[a-f0-9-]{36}$/.test(id)
      || request.headers.get("sec-fetch-site") !== "same-origin") {
    return new Response(null, { status: 404 });
  }
  try {
    const owner = await reportOwner(id);
    if (!owner) return new Response(null, { status: 404 });
    await recommendForSavedReport(owner, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof ExtensionDemoError) return new Response(null, { status: error.status === 401 ? 404 : error.status });
    throw error;
  }
}
