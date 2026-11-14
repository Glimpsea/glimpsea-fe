import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { demoReportView, ExtensionDemoError, reportSessionOwner } from "@/lib/extension-demo";
import { BriefCopy } from "../../brief-copy";
import { nearOwner, nearSessionCookie, sessionAccount } from "@/lib/near-auth";
import { nearMode } from "@/lib/near-testnet";
import { EtsyResearchReport } from "./etsy-research-report";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  if (!nearMode() && process.env.GLIMPSEA_EXTENSION_DEMO !== "1") notFound();
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id)) notFound();
  const jar = await cookies();
  let report;
  try {
    const reportOwner = reportSessionOwner(jar.get(`glimpsea_report_${id}`)?.value, id);
    const owner = reportOwner ?? (nearMode() ? nearOwner(sessionAccount(jar.get(nearSessionCookie)?.value)) : undefined);
    if (!owner) notFound();
    report = demoReportView(owner, id);
  } catch (error) {
    if (error instanceof ExtensionDemoError) notFound();
    throw error;
  }
  const [body] = report.markdown.split("\n```json\n");
  if (report.etsy) return <EtsyResearchReport scan={body} {...report.etsy} />;

  const source = body.startsWith("## New topic opportunity brief") ? "Product ideas from your seller brief, with a sample from Etsy live."
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
