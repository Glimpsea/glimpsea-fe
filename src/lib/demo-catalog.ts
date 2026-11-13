import { CATEGORY_LABELS, PRODUCT_CATEGORIES } from "./a2a";

const ideas = {
  digital: [
    "Opening and closing checklist", "Coffee tasting cards", "Seasonal menu template", "Inventory tracker",
    "Barista training worksheet", "Staff schedule template", "Equipment cleaning log",
  ],
  pod: [
    "Coffee plant tote bag", "Espresso illustration T-shirt", "Coffee brewing mug", "Coffee bean notebook",
    "Cafe window illustration art print", "Coffee cup coaster set", "Coffee roaster graphic apron",
  ],
  personalized: [
    "Cafe name apron", "Cafe name stamp", "Cafe name counter plaque", "Barista name mug",
    "Cafe name loyalty card holder", "Cafe name cup sleeve", "Cafe name window decal",
  ],
};

const listings = ideas.digital.flatMap((_, index) => PRODUCT_CATEGORIES.map((category) => ({
  id: `${category}-${index + 1}`, title: ideas[category][index], category,
  price: `$${({ digital: 4, pod: 18, personalized: 22 })[category] + index}.00`,
}))).map((listing, index) => ({
  ...listing,
  listingId: String(1000000001 + index),
  activePrice: index === 0 ? "$3.20" : index === 2 ? null : listing.price,
}));

export function demoListing(id: string) {
  return listings.find((listing) => listing.id === id || listing.listingId === id);
}

export function catalogPath(keyword: string, page: number) {
  return `/demo-catalog?${new URLSearchParams({ keyword, page: String(page) })}`;
}

export type DemoListingCapture = {
  listingId?: string;
  title: string;
  price: string | null;
  url: string;
  category?: keyof typeof ideas;
};

export type CatalogEvidence = ReturnType<typeof summarizeDemoCatalog> & { listings?: DemoListingCapture[] };

export function demoCatalogPage(keyword: string, page: number) {
  const words = keyword.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").match(/[a-z0-9]+/g) ?? [];
  const scope = words.filter((word) => !["cafe", "cafes", "owner", "owners", "supplies", "products", "for", "the"].includes(word));
  const cafeSearch = words.some((word) => word === "cafe" || word === "cafes");
  const matches = words.length === 0 ? [] : listings.filter(({ title, category }) => {
    if (cafeSearch && scope.length === 0) return true;
    const text = `${title} ${CATEGORY_LABELS[category]}`.toLowerCase();
    return scope.length > 0 && scope.every((word) => text.includes(word));
  });

  const start = (page - 1) * 2;
  return {
    source: "glimpsea-synthetic-catalog",
    page,
    listings: matches.slice(start, start + 2),
    hasNext: start + 2 < matches.length,
  };
}

export function summarizeDemoCatalog(keyword: string, maxPages: number, readLimit = maxPages) {
  const counts = { digital: 0, pod: 0, personalized: 0 };
  let pagesRead = 0;
  const titles: string[] = [];
  for (let page = 1; page <= readLimit; page++) {
    const result = demoCatalogPage(keyword, page);
    if (result.listings.length === 0) break;
    pagesRead++;
    for (const listing of result.listings) {
      counts[listing.category]++;
      titles.push(listing.title);
    }
    if (!result.hasNext) break;
  }
  return { source: "glimpsea-synthetic-catalog", keyword, maxPages, pagesRead, counts, titles };
}
