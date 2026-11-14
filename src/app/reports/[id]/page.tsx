import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { demoReport, ExtensionDemoError, reportSessionOwner } from "@/lib/extension-demo";
import { BriefCopy } from "../../brief-copy";
import { nearOwner, nearSessionCookie, sessionAccount } from "@/lib/near-auth";
import { nearMode } from "@/lib/near-testnet";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  if (!nearMode() && process.env.GLIMPSEA_EXTENSION_DEMO !== "1") notFound();
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id)) notFound();
  const jar = await cookies();
  let markdown;
  try {
    const owner = nearMode() ? nearOwner(sessionAccount(jar.get(nearSessionCookie)?.value))
      : reportSessionOwner(jar.get(`glimpsea_report_${id}`)?.value, id);
    if (!owner) notFound();
    markdown = demoReport(owner, id);
  } catch (error) {
    if (error instanceof ExtensionDemoError) notFound();
    throw error;
  }
  const [body] = markdown.split("\n```json\n");
  const source = body.startsWith("## Etsy live search") ? "Listings read from Etsy search results."
    : body.startsWith("## New topic opportunity brief") ? "Product ideas from your seller brief, with a sample from Etsy live."
    : body.includes("## Candidate evidence\n") ? "Product ideas based on a saved Etsy Marketplace Insights snapshot."
    : "Research from the synthetic Glimpsea catalog.";
  return (
    <main className="brief wrap">
      <h1 className="text-3xl font-semibold">Glimpsea research report</h1>
      <p>{source}</p>
      <BriefCopy markdown={body} standalone />
    </main>
  );
}
