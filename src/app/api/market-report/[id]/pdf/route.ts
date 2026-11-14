import { ExtensionDemoError, extensionChatReport } from "@/lib/extension-demo";
import { reportOwner } from "@/app/reports/[id]/report-owner";
import { cookies } from "next/headers";
import PDFDocument from "pdfkit";
import { marketReportContent } from "@/lib/market-report-content";
import { agentReportOwner, marketReportCookie, marketReportSession, readMarketReport } from "@/lib/market-reports";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = agentReportOwner(id);
  const buyer = agent && marketReportSession((await cookies()).get(marketReportCookie(agent.network))?.value, agent.network);
  let report = buyer && readMarketReport(id, buyer);
  if (!agent && /^[a-f0-9-]{36}$/.test(id)) {
    try {
      const owner = await reportOwner(id);
      if (owner) report = extensionChatReport(owner, id);
    } catch (error) {
      if (!(error instanceof ExtensionDemoError)) throw error;
    }
  }
  if (!report) return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });

  const content = marketReportContent(report.order, report.brief);
  const pdf = new PDFDocument({ size: "A4", margin: 50, info: { Title: content.title } });
  const chunks: Buffer[] = [];
  const finished = new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => {
    pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdf.once("end", () => resolve(Uint8Array.from(Buffer.concat(chunks))));
    pdf.once("error", reject);
  });
  const heading = (text: string, size = 17) => {
    if (pdf.y > pdf.page.height - pdf.page.margins.bottom - 60) pdf.addPage();
    pdf.moveDown(.55).font("Times-Bold").fontSize(size).fillColor("#1b2824").text(text).moveDown(.25);
  };
  const paragraph = (text: string) => pdf.font("Helvetica").fontSize(10).fillColor("#343e39").text(text, { lineGap: 3 }).moveDown(.35);
  heading(content.title, 25);
  paragraph(`${content.status} · ${content.scope}`);
  heading(content.verdict);
  paragraph(content.recommendation);
  for (const { date, label } of content.schedule) paragraph(`${date} · ${label}`);
  heading("Product ideas");
  for (const idea of content.ideas) {
    heading(idea.title, 13);
    paragraph(`${idea.category} · ${idea.hours} h to mock up · ${idea.score.score}/100 ease${idea.selected ? " · Test first" : ""}`);
    paragraph(idea.summary);
    paragraph(idea.evidence);
    for (const [label, text] of idea.detail) paragraph(`${label}. ${text}`);
    paragraph(`Ease score breakdown. Mockup time ${idea.score.workPoints}/45 · Setup cost ${idea.score.budgetPoints}/25 · Evidence ${idea.score.evidencePoints}/30`);
  }
  heading("What the scan shows");
  paragraph(content.scanSummary);
  for (const { segment, count, median } of content.segments) paragraph(`${segment} · ${count} listings${median ? ` · Median ${median}` : ""}`);
  for (const { title, url, price } of content.listings) {
    paragraph(price ? `${title} · ${price}` : title);
    pdf.fontSize(9).fillColor("#095d54").text(url, { link: url, underline: true }).moveDown(.4);
  }
  heading("Sources and methodology");
  for (const [label, text] of content.methods) paragraph(`${label}. ${text}`);
  for (const { label, text, url } of content.sources) {
    paragraph(`${label}. ${text}`);
    if (url) pdf.fontSize(9).fillColor("#095d54").text(url, { link: url, underline: true }).moveDown(.4);
  }
  pdf.end();
  return new Response(await finished, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="glimpsea-research-report.pdf"',
      "Cache-Control": "private, no-store",
    },
  });
}
