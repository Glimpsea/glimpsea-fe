const catalogOrigin = "http://127.0.0.1:3045";

function parseListings(catalog) {
  const listings = new Map();
  for (const card of catalog.querySelectorAll("li[data-listing-id]")) {
    const { listingId, category } = card.dataset;
    if (!/^\d+$/.test(listingId) || listings.has(listingId)) continue;
    const titleLink = card.querySelector("h2 a[href], h3 a[href]");
    const title = titleLink?.textContent.replace(/\s+/g, " ").trim();
    if (!title) continue;
    const url = new URL(titleLink.href);
    if (url.origin !== catalogOrigin || url.pathname !== `/demo-catalog/listing/${listingId}`) continue;
    const activePrice = card.querySelector(".lc-price");
    const currency = activePrice?.querySelector(".currency-symbol")?.textContent.trim();
    const value = activePrice?.querySelector(".currency-value")?.textContent.trim();
    const price = currency && value ? currency + value : null;
    listings.set(listingId, { listingId, title, price, url: url.origin + url.pathname, category, card });
  }
  return Array.from(listings.values());
}

async function readPage(catalog, interactive) {
  const listings = [];
  for (const { card, ...listing } of parseListings(catalog)) {
    if (interactive) {
      card.dataset.glimpseaRead = "";
      card.scrollIntoView({ block: "nearest" });
    }
    listings.push(listing);
    if (interactive) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return {
    page: Number(catalog.dataset.catalogPage),
    listings,
    nextUrl: catalog.querySelector('a[rel="next"]')?.href ?? null,
  };
}

if (location.origin === catalogOrigin && location.pathname === "/demo-catalog") {
  chrome.runtime.onMessage.addListener((message, _sender, reply) => {
    if (message?.type !== "read-demo-catalog" || message.url !== location.href) return;
    const catalog = document.querySelector("[data-catalog-page]");
    if (!catalog) return;
    void readPage(catalog, message.interactive).then(reply, () => reply(null));
    return true;
  });
}
