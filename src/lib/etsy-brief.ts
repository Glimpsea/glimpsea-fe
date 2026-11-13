import type { OrderInput } from "./a2a";
import type { DemoListingCapture } from "./demo-catalog";

type Listing = DemoListingCapture;
type Pattern = { label: string; match: RegExp };

const cafePatterns = {
  operations: { label: "Operations templates", match: /\b(?:checklist|toolkit|dashboard|tracker|calculator|spreadsheet)s?\b/i },
  apparel: { label: "Barista aprons", match: /\baprons?\b/i },
  portraits: { label: "Custom storefront artwork", match: /\b(?:custom|personali[sz]ed)\b.*\bstorefront\b.*\b(?:portrait|watercolor|illustration)\b/i },
  signage: { label: "Cafe and menu signs", match: /\b(?:coffee|caf[eé]|menu|storefront|sidewalk)\b.*\b(?:sign|board|display)s?\b|\b(?:sign|board)s?\b.*\b(?:coffee|caf[eé]|menu)\b/i },
  stencils: { label: "Coffee and logo stencils", match: /\b(?:coffee|latte|logo)\b.*\bstencil(?:s|\s+set)?\b/i },
} satisfies Record<string, Pattern>;

function safe(value: string) {
  return value.replace(/\s+/g, " ").replace(/[\\`*_{}\[\]()<>~|&!]/g, "\\$&");
}

function priceRanges(listings: Listing[]) {
  const groups = new Map<string, number[]>();
  for (const { price } of listings) {
    const parts = price?.trim().match(/^(Rp|IDR|US\$|USD|CA\$|CAD|AU\$|AUD|€|EUR|£|GBP|\$)\s*([\d.,]+)$/i);
    if (!parts) continue;
    const currency = parts[1].toUpperCase();
    const label = ({ RP: "IDR", "US$": "USD", "CA$": "CAD", "AU$": "AUD", "€": "EUR", "£": "GBP" } as Record<string, string>)[currency] ?? currency;
    const number = parts[2];
    if (!/^\d+(?:\.\d{1,2})?$|^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(number)) continue;
    const amount = Number(number.replaceAll(",", ""));
    if (!Number.isFinite(amount)) continue;
    const group = groups.get(label) ?? [];
    group.push(amount);
    groups.set(label, group);
  }
  const format = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
  return Array.from(groups, ([label, prices]) => {
    prices.sort((left, right) => left - right);
    const middle = Math.floor(prices.length / 2);
    const median = prices.length % 2 ? prices[middle] : (prices[middle - 1] + prices[middle]) / 2;
    const currency = label === "$" ? "$ (currency unspecified)" : label;
    return `${currency} ${format.format(prices[0])}–${format.format(prices.at(-1)!)} (median ${format.format(median)}; ${prices.length} prices)`;
  });
}

function link(listing: Listing, title = listing.title) {
  return `- [${safe(title)}](${listing.url}) · ${listing.price === null ? "No price shown" : safe(listing.price)}`;
}

function cafeIdeas(listings: Listing[], order: OrderInput) {
  const matches = (pattern: Pattern) => listings.filter(({ title }) => pattern.match.test(title));
  const operations = matches(cafePatterns.operations);
  const aprons = matches(cafePatterns.apparel);
  const portraits = matches(cafePatterns.portraits);
  const ideas = [
    {
      title: "Opening and closing shift checklist",
      type: "Digital download",
      hours: 2.5,
      evidence: operations.find(({ title }) => /checklist template/i.test(title)) ?? operations[0],
      pitch: "Create a one-page editable US Letter checklist for shift handoffs. Add a staff initials box and separate opening and closing tasks. Confirm the tasks with a cafe manager.",
      cost: "Use existing design tools for the mockup. Verify listing fees before publishing.",
      reason: "A cafe manager can try it on the next shift. A mockup needs neither a supplier nor a customer photo.",
      test: "Show one mockup to three US cafe owners or managers. Ask each to mark a missing task and say whether they would try it on a shift. Proceed if two agree to try it and the feedback identifies a task the mockup can improve.",
    },
    {
      title: "Cafe staff apron with shop name",
      type: "Print on demand",
      hours: 3,
      evidence: aprons.find(({ title }) => /coffee shop uniform/i.test(title)) ?? aprons[0],
      pitch: "Mock up a one-color shop name on a neutral apron. Keep personalization to one text field. The estimate covers seller setup and excludes supplier lead time.",
      cost: "Verify the blank, printing, sample, and US delivery costs before setting a price.",
      reason: "It is easy to mock up, but an actual sale depends on a supplier quote and a sample quality check.",
      test: "Get one US supplier quote and show a mockup to three cafe owners. Proceed if two would consider ordering at a price that covers the quoted costs.",
    },
    {
      title: "Custom storefront print",
      type: "Simple personalization",
      hours: 3.5,
      evidence: portraits[0],
      pitch: "Turn one cafe storefront photo into a simplified line drawing and deliver one print-ready file. Limit the pilot to one photo and one proof.",
      cost: "Check whether photo cleanup or revisions fit the estimate. Use a photo supplied with permission.",
      reason: "It gives the owner a custom display piece, but photo quality and revisions make delivery time less predictable.",
      test: "Time one mockup from a photo you have permission to use and show it to three owners. Proceed if you finish within the estimate and two ask about a custom version.",
    },
  ];
  const chosen = ideas.filter((idea) => idea.evidence && idea.hours <= order.productionHours)
    .sort((left, right) => left.hours - right.hours)[0];

  const lines = ["## Three product ideas", ""];
  for (const idea of ideas) {
    const status = idea.hours <= order.productionHours ? "within the time limit" : "over the time limit";
    lines.push(`### ${idea.title}`, "",
      `${idea.type} · estimated ${idea.hours} hours of seller work (${status}). ${idea.pitch}`, "",
      idea.cost, "", idea.reason, "");
    if (idea.evidence) lines.push(link(idea.evidence, "Comparable listing in the sample"), "");
    else lines.push("No direct comparable was found in this sample.", "");
  }
  if (chosen) {
    lines.push("## Recommended first test", "",
      `**${chosen.title}** It has a comparable in this sample and takes the least seller time of the supported ideas within the limit. ${chosen.reason}`, "",
      chosen.test, "");
  } else {
    lines.push("## Recommendation deferred", "", "The sample did not support an idea within the seller's time limit. Collect a more specific sample or revise the production limit.", "");
  }
  return lines;
}

export function renderEtsyBrief({ keyword, pagesRead, limit, listings, order }: {
  keyword: string;
  pagesRead: number;
  limit: number;
  listings: Listing[];
  order: OrderInput;
}) {
  const priced = listings.filter(({ price }) => price !== null).length;
  const isCafe = /\b(?:caf[eé]|coffee shop|barista)\b/i.test(keyword)
    && /\b(?:caf[eé]|coffee shop|barista)\b/i.test(order.audience);
  const relevant = isCafe ? listings.filter(({ title }) => /(?:\bcaf[eé]\b|\bcoffee shop\b|\bbarista\b|\brestaurant\b|\blatte art\b|\bcoffee bar\b)/i.test(title)) : [];
  const ranges = priceRanges(listings);
  const lines = [
    "## Etsy live search", "",
    `Keyword: ${safe(keyword)}. Pages read: ${pagesRead} of up to ${limit}.`, "",
    `Audience: ${safe(order.audience)} · ${safe(order.country)}. Seller time limit: ${order.productionHours} hours.`, "",
    `${listings.length} unique listings. ${priced} showed a price.`, "",
    "## Observed prices", "",
    ...(ranges.length ? ranges.map((range) => `- ${range}`) : ["No displayed prices could be grouped by currency."]), "",
    "These are displayed offers from the sample. Ranges include recognized currencies and number formats. The currency reflects the browser session. Search results do not measure sales, demand, or what a US buyer would pay.", "",
  ];
  if (isCafe) {
    lines.push("## Patterns for cafe owners", "",
      `${relevant.length} of ${listings.length} titles matched cafe-related terms. Pattern counts use title matches and may overlap. Unrelated results were excluded from these groups.`, "");
    for (const pattern of Object.values(cafePatterns)) {
      const matching = relevant.filter(({ title }) => pattern.match.test(title));
      if (!matching.length) continue;
      const ranges = priceRanges(matching);
      lines.push(`### ${pattern.label}`, "",
        `${matching.length} matching titles.${ranges.length ? ` ${ranges.join(" / ")}.` : ""}`, "",
        ...matching.slice(0, 2).map((listing) => link(listing)), "");
    }
    lines.push(...cafeIdeas(relevant, order));
  } else {
    lines.push("## Product recommendation", "",
      "This pilot has a product comparison for cafe searches. Use the observed prices and captured listings to review this search.", "");
  }
  lines.push("## Listings read from Etsy", "", ...listings.map((listing) => link(listing)));
  return lines.join("\n");
}
