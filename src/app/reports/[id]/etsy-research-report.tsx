import "@fontsource/fraunces/latin-700.css";
import Link from "next/link";
import type { Recommendation, ScanSeller } from "@/lib/etsy-recommendations";
import type { DemoListingCapture } from "@/lib/demo-catalog";
import { cafeMatches, ecbRateDate, ecbRateSource, listingSegment, priceSegments, seasonalPlan } from "@/lib/etsy-report-signals";
import { BriefCopy } from "../../brief-copy";
import { GenerateRecommendations } from "./generate-recommendations";
import styles from "./research-report.module.css";

type ValidationScan = { pagesRead: number; listings: DemoListingCapture[] };

function listingCsv(listings: DemoListingCapture[]) {
  const escape = (value: string) => `"${(/^[\s]*[=+@\-]/u.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
  return ["Title,Product format,Displayed price,URL", ...listings.map(({ title, price, url }) => [title, listingSegment(title), price ?? "", url].map(escape).join(","))].join("\r\n");
}

function workTime(hours: number) {
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

function tieReason(first: Recommendation, second?: Recommendation) {
  if (!second || first.score !== second.score || first.searchRatio !== second.searchRatio) return;
  if (first.hours < second.hours) return "The first two ideas tie on ease. Start here because the mockup takes less time.";
  if ((first.setupUsd ?? Infinity) < (second.setupUsd ?? Infinity)) {
    return "The first two ideas tie on ease. Start here because the estimated setup cost is lower.";
  }
  if (first.buyerNeed === "direct" && second.buyerNeed === "adjacent") {
    return "The first two ideas tie on ease. This one answers the buyer’s need more directly.";
  }
  return "The first two ideas are close. Start here and use the buyer test to decide whether to keep going.";
}

function Validation({ card, scan }: { card: Recommendation; scan?: ValidationScan }) {
  const search = `https://www.etsy.com/search?${new URLSearchParams({ q: card.keyword })}`;
  const comparison = scan && priceSegments(scan.listings).filter(({ median }) => median !== null);
  return (
    <div className={styles.validation}>
      <div>
        <h3>Validation search: {scan ? "scan complete" : "not run yet"}</h3>
        {scan ? (
          <>
            <p>“{card.keyword}” returned {scan.listings.length} unique listings across {scan.pagesRead} {scan.pagesRead === 1 ? "page" : "pages"}. Check which offers serve the same buyer.</p>
            {comparison?.length ? <p>Median displayed prices in USD: {comparison.map(({ segment, median }) => `${segment.toLowerCase()} ${median}`).join(" · ")}.</p> : null}
            <ul className={styles.validationLinks}>
              {scan.listings.slice(0, 3).map(({ title, url }) => <li key={url}><a href={url} target="_blank" rel="noreferrer">{title}</a></li>)}
            </ul>
          </>
        ) : <p>Open “{card.keyword}” on Etsy. Start a Basic scan with the same browser profile for a trial or the same wallet for a paid report. Reload this page when the scan is ready.</p>}
        {!scan && <p className={styles.validationNote}>A new scan uses a trial or payment.</p>}
        <p className={styles.validationNote}>{card.snapshot
          ? <a href={card.snapshot.url} target="_blank" rel="noreferrer">Etsy Marketplace Insights · {card.snapshot.searches} searches · {card.snapshot.results} results · {card.snapshot.period}</a>
          : <>Check search counts in <a href="https://help.etsy.com/hc/en-us/articles/35122361353239-How-Do-I-Use-Etsy-s-Marketplace-Insights-Tool" target="_blank" rel="noreferrer">Etsy Marketplace Insights</a> to measure demand.</>}</p>
      </div>
      <a className={styles.validationButton} href={search} target="_blank" rel="noreferrer">
        {scan ? "Open Etsy results" : "Run validation search"}
      </a>
    </div>
  );
}

function EaseBreakdown({ card }: { card: Recommendation }) {
  const points = [
    ["Time", card.workPoints, 45],
    ["Setup cost", card.budgetPoints, 25],
    ["Evidence", card.evidencePoints, 30],
  ] as const;
  return (
    <section className={styles.breakdown} aria-label="Ease score breakdown">
      <p><strong>Why {card.score}?</strong> {card.snapshot
        ? "Time and setup cost carry most of the weight. The evidence includes a saved Etsy search count."
        : "Time and setup cost carry most of the weight. Search demand for this idea is still unmeasured."}</p>
      {points.map(([label, value, max]) => (
        <div className={styles.scoreRow} key={label}>
          <span>{label}</span>
          <meter className={label === "Evidence" ? styles.amberMeter : undefined} aria-label={label} min={0} max={max} value={value} />
          <span>{value}/{max}</span>
        </div>
      ))}
    </section>
  );
}

function TestPlan({ card, id }: { card: Recommendation; id?: string }) {
  return (
    <div id={id} className={styles.tests}>
      <section>
        <h3>Buyer test</h3>
        <p>{card.nextStep}</p>
        <p><strong>Channel.</strong> Send one mockup to 20 target buyers.</p>
        <p><strong>Pass.</strong> At least 3 say they would pay.</p>
        <p><strong>Stop.</strong> Move on if nobody says they would pay. If 1 or 2 say yes, ask the others what they would change.</p>
      </section>
      <section>
        <h3>Price test</h3>
        <p>Pick two prices after you check offers for the same format. Show the same mockup at each price to similar buyers. Count how many would buy at each price.</p>
        <p><strong>$[LOW] vs $[HIGH]</strong> · Prices you choose</p>
        <p>{card.costCheck}</p>
      </section>
      <section>
        <h3>Before you publish</h3>
        <p>{card.ipCheck}</p>
        {card.tags.length > 0 && <p><strong>Tags to try.</strong> {card.tags.join(", ")}</p>}
      </section>
    </div>
  );
}

export function EtsyResearchReport({ reportId, scan, keyword, pages, limit, seller, listings, cards, validations }: {
  reportId: string;
  scan: string;
  keyword: string;
  pages: number;
  limit: number;
  seller: ScanSeller;
  listings: DemoListingCapture[];
  cards: Recommendation[];
  validations: Record<string, ValidationScan>;
}) {
  const [first, second] = cards;
  // Prefer the saved season for reports with year-specific ideas.
  const ideaYear = /\b20\d{2}\b/u.exec(first?.name ?? "")?.[0];
  const season = seasonalPlan(ideaYear && !/\b20\d{2}\b/u.test(keyword) ? `${keyword} ${ideaYear}` : keyword);
  const relevant = cafeMatches(listings, seller.audience);
  const segments = priceSegments(listings);
  const tie = first && tieReason(first, second);
  return (
    <div className={styles.page}>
      <header className={styles.masthead}>
        <div className={styles.frame}>
          <Link className={styles.brand} href="/">Glimpsea</Link>
          <p>{keyword} · {seller.audience} · Up to {workTime(seller.productionHours)} to make it · {listings.length} listings read</p>
        </div>
      </header>
      <main className={styles.frame}>
        <section className={styles.verdict} aria-labelledby="report-title">
          {first ? (
            <>
              <div className={styles.badges}>
                <span>Test first</span>
                <span>{first.snapshot ? "Saved Etsy search data available" : "Limited data: demand not measured yet"}</span>
              </div>
              <h1 id="report-title">Start with {first.name}.</h1>
              <p>{first.whyThisSearch} The first mockup takes about {workTime(first.hours)}. {tie}</p>
              <div className={styles.verdictActions}>
                <a href="#test-plan">See the test plan</a>
                {cards.length > 1 && <a href="#compare-ideas">Compare all {cards.length} ideas</a>}
              </div>
              {season && (
                <section className={styles.timeline} aria-label="Suggested schedule">
                  <h2>Suggested schedule to New Year’s Day ({season.daysLeft} {season.daysLeft === 1 ? "day" : "days"} left)</h2>
                  <ol>
                    {season.milestones.map(({ date, label }) => <li key={label}><strong>{date}</strong><span>{label}</span></li>)}
                  </ol>
                </section>
              )}
            </>
          ) : (
            <>
              <h1 id="report-title">Etsy research report</h1>
              {listings.length ? <GenerateRecommendations reportId={reportId} />
                : <p>This report has no saved listings. Start a new scan to get product ideas.</p>}
            </>
          )}
        </section>

        {first && <div className={styles.ideasGroup} id="compare-ideas">
          <article className={styles.primary}>
            <header className={styles.ideaHeader}>
              <div>
                <p className={styles.eyebrow}>Idea 1 · {first.categoryLabel} · {workTime(first.hours)} to mock up</p>
                <h2>{first.name}</h2>
              </div>
              <div className={styles.score}>
                <p><strong>{first.score}</strong>/100 ease</p>
                <span>{first.snapshot ? "Saved demand data" : "Evidence: low"}</span>
              </div>
            </header>
            <p className={styles.product}>{first.product} {first.difference}</p>
            <TestPlan id="test-plan" card={first} />
            <Validation card={first} scan={validations[first.id]} />
            <EaseBreakdown card={first} />
          </article>

          {cards.length > 1 && <section className={styles.ideas} aria-label="Compare product ideas">
            {cards.slice(1).map((card, index) => (
              <article key={card.id} className={styles.idea}>
                <div className={styles.ideaHeader}>
                  <p className={styles.eyebrow}>Idea {index + 2} · {workTime(card.hours)}</p>
                  <p className={styles.smallScore}><strong>{card.score}</strong> ease</p>
                </div>
                <h2>{card.name}</h2>
                <p>{card.whyThisSearch}</p>
                <details>
                  <summary><strong>Validation search</strong> · {validations[card.id] ? "scan complete" : "not run yet"}</summary>
                  <p>{card.product} {card.difference}</p>
                  <TestPlan card={card} />
                  <Validation card={card} scan={validations[card.id]} />
                  <EaseBreakdown card={card} />
                </details>
              </article>
            ))}
          </section>}
        </div>}

        <section className={styles.scan} aria-labelledby="scan-title">
          <h2 id="scan-title">What the scan shows</h2>
          <p>Search “{keyword}” · {pages} of {limit} pages · {listings.length} listings.
            {segments.some(({ priced }) => priced > 0) && <> USD estimates use <a href={ecbRateSource} target="_blank" rel="noreferrer">ECB rates from {ecbRateDate}</a>.</>}</p>
          {segments.length > 0 && (
            <ul className={styles.segments}>
              {segments.map(({ segment, count, priced, median }) => (
                <li key={segment}>
                  <div><span>{segment} · {count} {count === 1 ? "listing" : "listings"}</span><span>{median ? `Median ${median} (${priced} ${priced === 1 ? "price" : "prices"})` : "No USD estimate"}</span></div>
                  <meter className={segment === "Physical" ? styles.amberMeter : segment === "Unclear" ? styles.softMeter : undefined} aria-label={`${segment} share of the scan`} value={count} min={0} max={listings.length} />
                </li>
              ))}
            </ul>
          )}
          {relevant !== null && listings.length > 0 && (
            <aside className={styles.finding}>
              <h3>{relevant.length} of {listings.length} titles mention cafes, coffee shops, or related terms</h3>
              <p>{relevant.length === 0
                ? "There may be few offers for cafes, or buyers may use a different search. Try the idea’s keyword to check the offers. Use Marketplace Insights and the buyer test to check interest."
                : "These are title matches. Open similar listings to check who they serve, then use Marketplace Insights and the buyer test to check interest."}</p>
            </aside>
          )}
        </section>

        <footer className={styles.appendix}>
          <details name="report-appendix">
            <summary>{listings.length > 0 ? `Show all ${listings.length} listings` : "Show saved scan details"}</summary>
            <div><BriefCopy markdown={scan} /></div>
          </details>
          {listings.length > 0 && <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(listingCsv(listings))}`} download="glimpsea-etsy-scan.csv">Download CSV</a>}
          <details name="report-appendix">
            <summary>How the score works</summary>
            <div>
              <p>The ease score gives up to 45 points for mockup time and 25 for estimated setup cost. A similar product format in the scan earns 15 evidence points. Saved Etsy Marketplace Insights figures for the idea’s exact keyword earn 15 more.</p>
              <p>If all ideas are in the same category and have figures from the same Etsy snapshot, searches per 1,000 results decide the order first. For tied scores, Glimpsea compares time and cost. If they still tie and buyer fit was assessed, the idea that meets the buyer’s need more directly goes first.</p>
              <p>Product formats come from listing titles. The original prices are in the CSV. A follow-up scan shows offers and displayed prices for its keyword. Demand comes from separate search data or buyer tests.</p>
            </div>
          </details>
        </footer>
      </main>
    </div>
  );
}
