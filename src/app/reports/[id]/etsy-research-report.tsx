import type { Recommendation, ScanSeller } from "@/lib/etsy-recommendations";
import type { DemoListingCapture } from "@/lib/demo-catalog";
import { cafeMatches, ecbRateDate, ecbRateSource, listingSegment, priceSegments, seasonalPlan } from "@/lib/etsy-report-signals";
import { BriefCopy } from "../../brief-copy";
import { HeaderLogo } from "../../header-logo";
import { GenerateRecommendations } from "./generate-recommendations";
import { RecommendationBoard } from "./recommendation-board";
import styles from "./research-report.module.css";

function listingCsv(listings: DemoListingCapture[]) {
  const escape = (value: string) => `"${(/^[\s]*[=+@\-]/u.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
  return ["Title,Product format,Displayed price,URL", ...listings.map(({ title, price, url }) => [title, listingSegment(title), price ?? "", url].map(escape).join(","))].join("\r\n");
}

export function EtsyResearchReport({ reportId, scan, keyword, pages, limit, seller, listings, cards }: {
  reportId: string;
  scan: string;
  keyword: string;
  pages: number;
  limit: number;
  seller: ScanSeller;
  listings: DemoListingCapture[];
  cards: Recommendation[];
}) {
  const [first, second] = cards;
  const season = seasonalPlan(keyword);
  const relevant = cafeMatches(listings, seller.audience);
  const segments = priceSegments(listings);
  const ties = first && second && first.score === second.score && first.hours === second.hours && first.setupUsd === second.setupUsd && first.searchRatio === second.searchRatio;
  return (
    <>
      <header className="masthead wrap"><HeaderLogo href="/" /></header>
      <main className={`wrap ${styles.report}`}>
        <header className={styles.reportHeader}>
          <h1>Etsy research report</h1>
          <p className={styles.scanScope}><strong>{keyword}</strong> · {seller.audience} · Up to {seller.productionHours} {seller.productionHours === 1 ? "hour" : "hours"} to make it</p>
          <p className={styles.muted}>{pages} of {limit} search pages read · {listings.length} saved listings</p>
          <a className={styles.textLink} href="#listing-scan">See listings and prices <span aria-hidden="true">↓</span></a>
        </header>

        <section className={styles.reportSection} aria-labelledby="opportunities">
          <h2 id="opportunities">Products to test</h2>
          {first ? (
            <>
              <div className={styles.verdict}>
                <h3>{ties ? "Start with one of the tied ideas" : `Test first: ${first.name}`}</h3>
                <p>{first.whyThisSearch}</p>
                <p>{first.snapshot ? first.costCheck : "Check interest with buyers before you spend money."}</p>
                <p><strong>First step.</strong> {first.nextStep}</p>
                {season && <p><strong>New Year’s Day.</strong> {season.event}. {season.digitalTarget && first.category === "digital"
                  ? `Aim to publish by ${season.digitalTarget} to leave time for a buyer test. This is a planning target.`
                  : "Check how much time your test, supplier, or shipping needs."}</p>}
              </div>
              <RecommendationBoard cards={cards} reportId={reportId} />
            </>
          ) : listings.length ? <GenerateRecommendations reportId={reportId} />
            : <p>This report has no saved listing data to use for product ideas.</p>}
        </section>

        {cards.length > 0 && (
          <section className={styles.reportSection} aria-labelledby="idea-details">
            <h2 id="idea-details">Why these ideas</h2>
            {cards.map((card) => (
              <details key={card.id} className={styles.disclosure} id={`niche-${card.id}`}>
                <summary>{card.name}</summary>
                <div className={styles.detail}>
                  <dl className={styles.detailFacts}>
                    <div><dt>What to make</dt><dd>{card.product}</dd></div>
                    <div><dt>How to make it stand out</dt><dd>{card.difference}</dd></div>
                    <div><dt>Time and cost</dt><dd>{card.hours} {card.hours === 1 ? "hour" : "hours"} of seller work. {card.setupUsd === null ? "Get a setup quote." : `About $${card.setupUsd} USD to set up.`} {card.costCheck}</dd></div>
                    <div><dt>Etsy keyword</dt><dd>{card.keyword}</dd></div>
                    {card.tags.length > 0 && <div><dt>Tags to try</dt><dd>{card.tags.join(", ")}</dd></div>}
                    <div><dt>Rights to check</dt><dd>{card.ipCheck}</dd></div>
                    <div><dt>Buyer test</dt><dd>{card.nextStep}</dd></div>
                    <div><dt>Fit score</dt><dd>{card.workPoints}/45 time · {card.budgetPoints}/25 setup cost · {card.evidencePoints}/30 evidence</dd></div>
                  </dl>
                  {card.snapshot ? <p><a className={styles.textLink} href={card.snapshot.url} target="_blank" rel="noreferrer">
                    Etsy Marketplace Insights · {card.snapshot.period} · {card.snapshot.searches} searches · {card.snapshot.results} results
                  </a>{card.searchRatio !== null && <span> About {card.searchRatio} searches per 1,000 results.</span>}</p>
                    : <p>Look up “{card.keyword}” in Etsy Marketplace Insights to check interest.</p>}
                  {card.examples.length > 0 && (
                    <ul className={styles.checklist}>
                      {card.examples.map(({title, url, price}) => (
                        <li key={url}><a className={styles.textLink} href={url} target="_blank" rel="noreferrer">{title}</a>{price ? ` · ${price}` : ""}</li>
                      ))}
                    </ul>
                  )}
                  <p>Save the same keyword and market each week to build a trend.</p>
                </div>
              </details>
            ))}
          </section>
        )}

        <section className={styles.reportSection} id="listing-scan" aria-labelledby="evidence">
          <h2 id="evidence">Data behind this report</h2>
          <details className={styles.disclosure}>
            <summary>Listings and displayed prices</summary>
            <div className={styles.detail}>
              {listings.length > 0 && <a className={styles.button} href={`data:text/csv;charset=utf-8,${encodeURIComponent(listingCsv(listings))}`} download="glimpsea-etsy-scan.csv">Download CSV</a>}
              {segments.length > 0 && <dl className={styles.detailFacts}>{segments.map(({segment, count, priced, range, median}) => (
                <div key={segment}><dt>{segment} · {count} listings</dt><dd>{range ? `${range} USD · median ${median} · ${priced} prices` : "No prices with a known currency."}</dd></div>
              ))}</dl>}
              {segments.some((segment) => segment.priced > 0) && <p>USD estimates use European Central Bank rates from {ecbRateDate}. Etsy showed the original prices in the browser. <a href={ecbRateSource} target="_blank" rel="noreferrer">See exchange rates</a>.</p>}
              {relevant !== null && <><p>{relevant.length} titles mention cafes, coffee shops, or related terms.</p>{relevant.length > 0 && <ul className={styles.checklist}>{relevant.slice(0, 3).map(({ title, url }) => <li key={url}><a className={styles.textLink} href={url} target="_blank" rel="noreferrer">{title}</a></li>)}</ul>}</>}
              <BriefCopy markdown={scan} />
            </div>
          </details>
          <details className={styles.disclosure}>
            <summary>How Glimpsea ranks the ideas</summary>
            <div className={styles.detail}>
              <p>Glimpsea filters ideas by the seller’s limits, then uses up to 45 points for time, 25 for setup cost, and 30 for evidence. A comparable product format earns 15 evidence points. Direct Marketplace Insights figures for the exact keyword earn 15 more.</p>
              <p>The score helps you pick a first mockup. Listing titles and displayed prices show what was in the sample. Prototype costs and work hours are estimates.</p>
              <p>If every idea in the same category has direct figures from the same Etsy snapshot, Glimpsea ranks them by searches per 1,000 results first. This ratio compares search interest with the number of offers.</p>
            </div>
          </details>
        </section>
      </main>
    </>
  );
}
