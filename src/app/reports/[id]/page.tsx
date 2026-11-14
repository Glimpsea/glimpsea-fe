import { cookies } from "next/headers";
import { agentReportOwner, marketReportCookie, marketReportSession, readMarketReport } from "@/lib/market-reports";
import { marketReportContent } from "@/lib/market-report-content";
import { MarketResearchReport } from "./market-research-report";
import { notFound } from "next/navigation";
import { demoReportView, extensionChatReport, ExtensionDemoError } from "@/lib/extension-demo";
import { BriefCopy } from "../../brief-copy";
import { reportOwner } from "./report-owner";
import { nearMode } from "@/lib/near-testnet";
import { EtsyResearchReport } from "./etsy-research-report";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id)) notFound();
  const agent = agentReportOwner(id);
  if (agent) {
    const buyer = marketReportSession((await cookies()).get(marketReportCookie(agent.network))?.value, agent.network);
    const report = buyer && readMarketReport(id, buyer);
    return <MarketResearchReport id={id} network={agent.network} content={report ? marketReportContent(report.order, report.brief) : undefined} />;
  }
  if (!nearMode() && process.env.GLIMPSEA_EXTENSION_DEMO !== "1") notFound();
  let report;
  let chat;
  try {
    const owner = await reportOwner(id);
    if (!owner) notFound();
    chat = extensionChatReport(owner, id);
    if (!chat) report = demoReportView(owner, id);
  } catch (error) {
    if (error instanceof ExtensionDemoError) notFound();
    throw error;
  }
  if (chat) return <MarketResearchReport id={id} network="testnet" content={marketReportContent(chat.order, chat.brief)} />;
  if (!report) notFound();
  const [body] = report.markdown.split("\n```json\n");
  if (report.etsy) return <EtsyResearchReport reportId={id} scan={body} {...report.etsy} />;

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
