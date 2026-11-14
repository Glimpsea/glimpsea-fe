import type { DemoListingCapture } from "./demo-catalog";

export const ecbRateSource = "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html";
export const ecbRateDate = "Nov 13, 2026";
// Historical ECB rates expressed as units per euro. Keep the date with the estimate.
const euroRates: Record<string, number> = { EUR: 1, USD: 1.1052, IDR: 20163.71, GBP: .83559, CAD: 1.5758, AUD: 1.6288 };
const currencySymbols: Record<string, string> = { RP: "IDR", "US$": "USD", "CA$": "CAD", "AU$": "AUD", "€": "EUR", "£": "GBP" };
const digital = /\b(?:digital download|instant download|printable|digital file|pdf|png|svg|sublimation design)\b/i;
const physical = /\b(?:ship(?:ping|ped)?|ceramic|engraved|embroidered|acrylic|wooden|cotton|linen|chocolates?|candy|magnet|mugs?|tumblers?|notebooks?|gift boxes?)\b/i;

export function perThousandSearchResults(searches: string, results: string) {
  const parse = (value: string) => Number.parseFloat(value.replaceAll(",", "")) * (value.toLowerCase().endsWith("k") ? 1000 : 1);
  return parse(results) > 0 ? Math.round(parse(searches) / parse(results) * 1000) : null;
}

export function seasonalPlan(keyword: string, now = new Date()) {
  const match = /\bnew[ -]?year(?:['’]s)?\b/i.test(keyword);
  if (!match) return null;
  const explicitYear = keyword.match(/\b20\d{2}\b/)?.[0];
  const year = explicitYear ? Number(explicitYear) : now.getUTCFullYear() + 1;
  const event = new Date(Date.UTC(year, 0, 1));
  if (event <= now) return null;
  const target = new Date(Date.UTC(year - 1, 11, 15));
  const date = (value: Date) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(value);
  return {
    event: date(event),
    digitalTarget: target > now ? date(target) : null,
  };
}

export function listingSegment(title: string) {
  if (digital.test(title)) return "Digital";
  if (physical.test(title)) return "Physical";
  return "Unclear";
}

export function cafeMatches(titles: DemoListingCapture[], audience: string) {
  if (!/\b(?:caf[eé]|coffee shop|barista)\b/i.test(audience)) return null;
  return titles.filter(({ title }) => /\b(?:cafe|coffee shop|coffee bar|barista|takeout|coffee cup)\b|café/i.test(title));
}

export function usdEstimate(price: string | null) {
  const match = price?.trim().match(/^(Rp|IDR|US\$|USD|CA\$|CAD|AU\$|AUD|€|EUR|£|GBP)\s*([\d.,]+)$/iu);
  if (!match) return null;
  const symbol = match[1].toUpperCase();
  const currency = currencySymbols[symbol] ?? symbol;
  const rate = euroRates[currency];
  if (!rate) return null;
  const number = match[2];
  const normalized = /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(number)
    ? number.replaceAll(".", "").replace(",", ".")
    : /^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(number) ? number.replaceAll(",", "") : number.replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount * euroRates.USD / rate : null;
}

export const formatUsd = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

export function priceSegments(listings: DemoListingCapture[]) {
  return (["Digital", "Physical", "Unclear"] as const).map((segment) => {
    const matches = listings.filter(({title}) => listingSegment(title) === segment);
    const prices = matches.flatMap(({price}) => { const value = usdEstimate(price); return value === null ? [] : [value]; }).sort((a,b) => a-b);
    const middle = Math.floor(prices.length / 2);
    const median = prices.length % 2 ? prices[middle] : (prices[middle - 1] + prices[middle]) / 2;
    return { segment, count: matches.length, priced: prices.length,
      range: prices.length ? `${formatUsd(prices[0])} to ${formatUsd(prices.at(-1)!)}` : null,
      median: prices.length ? formatUsd(median) : null };
  }).filter(({count}) => count > 0);
}
