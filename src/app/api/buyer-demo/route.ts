import { PRODUCT_CATEGORIES } from "@/lib/a2a";
import { sampleOrder } from "@/lib/buyer";
import { research } from "@/lib/research";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { category } = await request.json().catch(() => ({})) ?? {};
  const selection = PRODUCT_CATEGORIES.find((item) => item === category);
  if (category !== undefined && !selection) {
    return Response.json({ error: "Choose one of the sample categories." }, { status: 400 });
  }
  try {
    const { markdown } = await research({ ...sampleOrder, category: selection }, undefined, "fixture");
    return Response.json({ markdown }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not prepare the Glimpsea sample brief.", error);
    return Response.json({ error: "The sample brief is unavailable. Try again." }, { status: 500 });
  }
}
