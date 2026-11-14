import { PRODUCT_CATEGORIES, type OrderInput } from "./a2a";

export function readResearchOrder(value: unknown): OrderInput | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const { country, audience, category, format, productionHours, budgetUsd, sellerNotes } = value as Record<string, unknown>;
  const supportedCategory = PRODUCT_CATEGORIES.find((item) => item === category);
  if (typeof country !== "string" || !/^[A-Za-z]{2}$/.test(country)
      || typeof audience !== "string" || !audience.trim() || audience.length > 180
      || (category !== undefined && !supportedCategory)
      || (format !== undefined && ((format !== "printable" && format !== "physical") || category !== undefined || budgetUsd !== undefined))
      || typeof productionHours !== "number" || !Number.isFinite(productionHours) || productionHours <= 0 || productionHours > 80
      || (budgetUsd !== undefined && (typeof budgetUsd !== "number" || !Number.isFinite(budgetUsd) || budgetUsd < 0 || budgetUsd > 100_000))
      || (sellerNotes !== undefined && (typeof sellerNotes !== "string" || sellerNotes.length > 1000))) return;
  return {
    country: country.toUpperCase(), audience: audience.trim(),
    ...(format && { format }),
    productionHours,
    ...(supportedCategory && { category: supportedCategory }),
    ...(budgetUsd !== undefined && { budgetUsd }),
    ...(typeof sellerNotes === "string" && sellerNotes.trim() && { sellerNotes: sellerNotes.trim() }),
  };
}

const supportedMarkets = new Set([
  "US", "AD", "AL", "AT", "BA", "BE", "BG", "BY", "CH", "CY", "CZ", "DE", "DK", "EE", "ES",
  "FI", "FR", "GB", "GR", "HR", "HU", "IE", "IS", "IT", "LI", "LT", "LU", "LV", "MC",
  "MD", "ME", "MK", "NL", "NO", "PL", "PT", "RO", "RS", "SI", "SK", "SM", "UA",
]);

export function supportsResearchMarket(country: string) {
  return supportedMarkets.has(country);
}
