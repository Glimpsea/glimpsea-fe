import "@fontsource/fraunces/latin-700.css";
import { HeaderLogo } from "../../header-logo";
import type { marketReportContent } from "@/lib/market-report-content";
import { MarketReportLogin } from "./market-report-login";
import styles from "./research-report.module.css";

export function MarketResearchReport({ id, network, content }: { id: string; network: "mainnet" | "testnet"; content?: ReturnType<typeof marketReportContent> }) {
  const csv = content?.observations.length ? [
    ["Keyword", "Searches", "Results", "Related to"],
    ...content.observations.map(({ keyword, searches, results, relatedTo }) => [keyword, searches, results, relatedTo]),
  ].map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n") : undefined;
  return <div className={styles.page}>
    <header className={styles.masthead}>
      <div className={styles.frame}><HeaderLogo href="/" /><p>Private report</p></div>
    </header>
    <main className={styles.frame}>
      {content ? <>
        <section className={styles.verdict}>
          <div className={styles.badges}><span>{content.status}</span></div>
          <h1>{content.verdict}</h1>
          <p>{content.scope}</p>
          <p><strong>Next step.</strong> {content.recommendation}</p>
          {content.schedule.length > 0 && <section className={styles.timeline}>
            <h2>Suggested schedule</h2>
            <ol>{content.schedule.map(({ date, label }) => <li key={label}><strong>{date}</strong>{label}</li>)}</ol>
          </section>}
          <div className={styles.verdictActions}>
            <a href={`/api/market-report/${id}/pdf`} download="glimpsea-research-report.pdf">Download PDF</a>
          </div>
        </section>
        <section className={styles.ideasGroup} aria-labelledby="market-ideas">
          <h2 id="market-ideas">Product ideas</h2>
          <div className={styles.ideas}>
            {content.ideas.map((idea) => <article className={idea.selected ? styles.primary : styles.idea} key={idea.title}>
              <p className={styles.eyebrow}>{idea.selected ? "Test first · " : ""}{idea.category} · {idea.hours} h to mock up</p>
              <h3>{idea.title}</h3>
              <p>{idea.summary}</p>
              <p><strong>{idea.score.score}/100 ease.</strong> {idea.evidence}</p>
              <details className={styles.marketDetails} open={idea.selected}>
                <summary>See the test plan <span className="sr-only">for {idea.title}</span></summary>
                <dl className={styles.marketFacts}>
                  {idea.detail.map(([label, text]) => <div key={label}><dt>{label}</dt><dd>{text}</dd></div>)}
                  <div><dt>Ease score breakdown</dt><dd>Mockup time {idea.score.workPoints}/45 · Setup cost {idea.score.budgetPoints}/25 · Evidence {idea.score.evidencePoints}/30</dd></div>
                </dl>
              </details>
            </article>)}
          </div>
        </section>
        <section className={styles.scan}>
          <h2>What the scan shows</h2>
          <p>{content.scanSummary}</p>
          {content.segments.length > 0 && <ul className={styles.segments}>
            {content.segments.map(({ segment, count, median }) => <li key={segment}>{segment} · {count} listings{median ? ` · Median ${median}` : ""}</li>)}
          </ul>}
          {content.listings.length > 0 && <details className={styles.marketDetails}>
            <summary>Show saved listings</summary>
            <ul className={styles.reportSources}>{content.listings.map(({ title, url, price }) => <li key={url}><a href={url}>{title}</a>{price && ` · ${price}`}</li>)}</ul>
          </details>}
          <details className={styles.marketDetails}>
            <summary>Sources and methodology</summary>
            <dl className={styles.marketFacts}>
              {content.methods.map(([label, text]) => <div key={label}><dt>{label}</dt><dd>{text}</dd></div>)}
            </dl>
            {csv && <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`} download="glimpsea-pilot.csv">Download pilot CSV</a>}
            <ul className={styles.reportSources}>
              {content.sources.map(({ label, text, url }) => <li key={label}>
                {url ? <a href={url} target="_blank" rel="noreferrer">{label}</a> : <strong>{label}</strong>} · {text}
              </li>)}
            </ul>
          </details>
        </section>
      </> : <section className={styles.verdict}>
        <h1>Glimpsea research report</h1>
        <p>Sign in with the NEAR {network} wallet that paid for this report.</p>
        <MarketReportLogin id={id} network={network} />
      </section>}
    </main>
  </div>;
}
