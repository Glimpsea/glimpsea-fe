import { CATEGORY_LABELS, type OrderInput } from "./a2a";
import { easeScore, priceSegments, seasonalPlan } from "./etsy-report-signals";
import { insightLink, opportunitySnapshot, opportunityTopic } from "./opportunity-brief";
import type { Brief } from "./research";

export function marketReportContent(order: OrderInput, brief: Extract<Brief, { schemaVersion: 2 }>) {
  const topic = `${order.audience} ${order.sellerNotes ?? ""}`;
  const pilot = order.country !== "US" ? undefined
    : /\b(?:micro[ -]weddings?|small weddings?)\b/i.test(topic) ? opportunityTopic("micro-wedding")
    : /\b(?:caf[eé]s?|coffee shops?|kedai kopi)\b/iu.test(topic) ? opportunityTopic("cafe") : undefined;
  const catalog = brief.catalogEvidence;
  const scope = [
    /^(?:pemilik|pengusaha) kedai kopi independen$/iu.test(order.audience) ? "Independent coffee shop owners" : order.audience,
    order.country,
    `Up to ${order.productionHours} h to prototype`,
    ...(order.budgetUsd === undefined ? [] : [`USD ${order.budgetUsd} setup budget`]),
  ].join(" · ");
  const ideas = [...brief.concepts].sort((left, right) =>
    Number(right.title === brief.selectedConcept) - Number(left.title === brief.selectedConcept)).map((concept) => {
    const keyword = concept.title.toLowerCase();
    const tags = [keyword, ...keyword.split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 3)]
      .filter((tag, index, all) => tag.length <= 20 && all.indexOf(tag) === index).slice(0, 4);
    const match = pilot?.candidates.find((candidate) => candidate.keyword === keyword && candidate.counts && !candidate.counts.relatedTo);
    const cost = concept.estimatedSetupUsd === null ? concept.costCheck : `Estimated setup cost: USD ${concept.estimatedSetupUsd}. ${concept.costCheck}`;
    const selected = concept.title === brief.selectedConcept;
    return {
      title: concept.title,
      category: CATEGORY_LABELS[concept.category],
      selected,
      hours: concept.productionHours,
      score: easeScore(concept.productionHours, concept.estimatedSetupUsd, order.productionHours, order.budgetUsd, false, Boolean(match)),
      evidence: match?.counts
        ? `Saved Etsy Marketplace Insights: ${match.counts.searches} searches and ${match.counts.results} results for the exact keyword, ${opportunitySnapshot.period}.`
        : "Search demand for this exact keyword is unmeasured.",
      summary: concept.description,
      detail: [
        ["Product and differentiation", `${concept.deliverable} ${concept.tradeoff}`],
        ["Mockup time and setup cost", `About ${concept.productionHours} h. ${concept.assumptions} ${cost}`],
        ["Buyer test", selected
          ? `${brief.test} Pass: ${brief.criteria.proceed} Revise: ${brief.criteria.revise} Stop: ${brief.criteria.stop}`
          : "Show this mockup to target buyers and record who would try it or pay."],
        ["Price test", `Choose two trial prices and show the same mockup to comparable buyers. Track willingness to pay for each. ${concept.costCheck}`],
        ["Before you publish", `Check for trademarks and confirm you have permission to use artwork or customer-supplied logos.${tags.length ? ` Tags to try: ${tags.join(", ")}.` : ""}`],
        ["Etsy keyword to validate", keyword],
      ],
    };
  });
  const sources = brief.sources.map((source) => ({
    label: source.title, text: `${source.observedAt}. ${source.scope}`, url: source.url,
  }));
  const observations = pilot?.candidates.flatMap(({ keyword, counts }) => counts ? [{
    keyword, searches: counts.searches, results: counts.results, relatedTo: counts.relatedTo ?? "",
  }] : []) ?? [];
  if (pilot) {
    sources.push({
      label: `Glimpsea pilot — ${pilot.title}`,
      text: `Etsy Marketplace Insights, ${opportunitySnapshot.period}. ${pilot.gaps} The figures below apply to the recorded terms.`,
      url: undefined,
    }, ...pilot.references.map(({ title, url }) => ({ label: title, text: "Comparable listing from the saved pilot.", url })),
    ...observations.map(({ keyword, searches, results, relatedTo }) => ({
      label: keyword, text: `${searches} searches · ${results} results. ${relatedTo ? `Related to “${relatedTo}”.` : "Direct lookup."}`,
      url: insightLink(relatedTo || keyword),
    })));
  }
  const schedule = seasonalPlan(order.sellerNotes ?? "")?.milestones ?? [];
  return {
    title: "Glimpsea research report",
    scope,
    status: "Limited data",
    verdict: brief.selectedConcept ? `Start with ${brief.selectedConcept}.` : "Gather more evidence before testing.",
    recommendation: brief.recommendation,
    ideas,
    schedule,
    scanSummary: catalog?.source === "etsy-live"
      ? `Etsy search “${catalog.keyword}” · ${catalog.pagesRead} of ${catalog.maxPages} pages read. Displayed prices reflect the scan sample.`
      : catalog ? `Sample catalog search “${catalog.keyword}” · ${catalog.pagesRead} of ${catalog.maxPages} pages. Catalog data is synthetic.`
      : pilot ? `Saved Glimpsea pilot · Etsy Marketplace Insights · ${opportunitySnapshot.period}. This order did not run a live listing scan.`
      : "No live Etsy listing scan or saved pilot data is available for this order.",
    segments: priceSegments(catalog?.listings ?? []),
    listings: catalog?.listings ?? [],
    methods: [
      ["Evidence coverage", brief.evidenceGap],
      ["How the ease score works", "Up to 45 points for mockup time, 25 for setup cost and 30 for evidence. A comparable format in the extension scan and exact-keyword figures are worth 15 points each when available. The ease score measures how practical an idea is to test."],
      ["What to verify next", "Validate the exact keyword in Etsy Marketplace Insights and test a mockup with target buyers. A 12-week forecast requires additional observations."],
    ],
    sources,
    observations,
  };
}
