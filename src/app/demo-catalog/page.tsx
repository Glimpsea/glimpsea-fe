import Image from "next/image";
import { catalogPath, demoCatalogPage } from "@/lib/demo-catalog";

const formats = {
  digital: "Digital download",
  pod: "Made to order",
  personalized: "Personalizable",
};

const artwork = ["counter-print", "coffee-botanical", "seating-print"];

export default async function DemoCatalog({ searchParams }: {
  searchParams: Promise<{ keyword?: string | string[]; page?: string | string[] }>;
}) {
  const query = await searchParams;
  const keyword = typeof query.keyword === "string" ? query.keyword.slice(0, 120) : "cafe owner supplies";
  const page = typeof query.page === "string" && /^\d{1,2}$/.test(query.page) ? Math.max(1, Number(query.page)) : 1;
  const result = demoCatalogPage(keyword, page);
  const repeated = page === 2 ? demoCatalogPage(keyword, 1).listings[0] : undefined;
  const cards = repeated && result.listings.length ? [...result.listings, repeated] : result.listings;

  return (
    <main className="min-h-screen bg-[#fffaf3] px-5 pb-12 pt-6 text-[#241a16]" data-catalog-page={page}>
      <header className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 border-b border-[#d4c5b7] pb-5">
        <a className="font-serif text-2xl text-[#92320d]" href="/demo-catalog">Etsy search simulation</a>
        <form action="/demo-catalog" className="flex min-w-0 grow gap-2">
          <label className="min-w-0 grow">
            <span className="sr-only">Search listings</span>
            <input className="w-full rounded-full border border-[#9b8477] bg-white px-4 py-2" name="keyword" defaultValue={keyword} maxLength={120} required />
          </label>
          <input type="hidden" name="page" value="1" />
          <button className="rounded-full bg-[#92320d] px-5 text-white">Search</button>
        </form>
      </header>
      <section aria-labelledby="search-results" className="mx-auto max-w-5xl pt-6">
        <p className="text-sm">Sample catalog · Synthetic listings and prices</p>
        <h1 id="search-results" className="mt-2 font-serif text-4xl">Results for “{keyword}”</h1>
        <p className="mb-4 mt-2 text-sm">Page {page} · Sorted by relevance</p>
        <ul aria-label="Search results" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ listingId, title, category, price, activePrice }, index) => {
            const image = artwork[(Number(listingId) - 1) % artwork.length];
            const path = `/demo-catalog/listing/${listingId}`;
            const isRepeated = repeated?.listingId === listingId;
            const onSale = activePrice !== price;
            return (
              <li key={listingId} className="overflow-hidden rounded-lg border border-[#d4c5b7] bg-white" data-listing-id={listingId} data-category={category}>
                <a aria-hidden="true" tabIndex={-1} href={`${path}?ref=search-image&page=${page}`}>
                  <Image className="aspect-[16/9] w-full object-cover" src={`/cafe-art/${image}.webp`} alt="" width={480} height={270} preload={index === 0} sizes="(max-width: 640px) 100vw, 320px" />
                </a>
                <div className="space-y-2 p-4">
                  {isRepeated && <p className="text-sm text-[#6c4b3b]">Featured listing</p>}
                  <h2 className="text-lg font-semibold">
                    <a className="hover:underline" href={`${path}?ref=search-title&page=${page}`}>{title}</a>
                  </h2>
                  {activePrice === null ? <p>Price unavailable</p> : (
                    <p className="flex items-baseline gap-2">
                      {onSale && <span className="sr-only">Sale Price</span>}
                      <strong className="lc-price text-lg"><span className="currency-symbol">$</span><span className="currency-value">{activePrice.slice(1)}</span></strong>
                      {onSale && <del className="text-sm text-[#6c4b3b]"><span className="sr-only">Original Price </span>{price}</del>}
                    </p>
                  )}
                  <p className="text-sm text-[#6c4b3b]">{formats[category]}</p>
                </div>
              </li>
            );
          })}
        </ul>
        {result.listings.length === 0 && <p>No demo listings found.</p>}
        <nav aria-label="Search pages" className="mt-6 flex items-center gap-4">
          {page > 1 && <a className="underline" rel="prev" href={catalogPath(keyword, page - 1)}>Previous</a>}
          <span aria-current="page">{page}</span>
          {result.hasNext && <a className="underline" rel="next" href={catalogPath(keyword, page + 1)}>Next page</a>}
        </nav>
      </section>
    </main>
  );
}
