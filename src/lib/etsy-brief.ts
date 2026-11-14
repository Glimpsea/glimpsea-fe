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
  }
  lines.push("## Listings read from Etsy", "", ...listings.map((listing) => link(listing)));
  return lines.join("\n");
}
