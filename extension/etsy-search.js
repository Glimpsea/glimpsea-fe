globalThis.readEtsySearch = function readEtsySearch(expectedPage, keyword, highlight = false) {
  const url = new URL(location.href);
  const page = Number(url.searchParams.get("page") ?? "1");
  if (url.origin !== "https://www.etsy.com" || url.pathname !== "/search"
      || url.searchParams.get("q") !== keyword || page !== expectedPage
      || document.readyState === "loading") return null;
  if (/we detected unusual activity from your device or network/i.test(document.body?.innerText ?? "")) {
    return { blocked: true };
  }
  const listings = new Map();
  const clean = (value) => value?.replace(/\s+/g, " ").trim();

  for (const heading of document.querySelectorAll("main h2, main h3, #content h2, #content h3")) {
    const title = clean(heading.textContent);
    if (!title) continue;
    const link = heading.closest("a[href]") ?? heading.querySelector("a[href]");
    const card = heading.closest(".v2-listing-card, [data-listing-id]");
    if (!link || !card) continue;
    const href = new URL(link.href);
    const listingId = /^\/listing\/(\d+)(?:\/|$)/.exec(href.pathname)?.[1];
    if (href.origin !== url.origin || !listingId || listings.has(listingId)) continue;
    const prices = Array.from(card.querySelectorAll(".lc-price, .currency-value"));
    const priceNode = prices.find((node) => !node.closest("del, s, [hidden], [aria-hidden=true], .wt-text-strikethrough, .search-collage-original-price") && node.querySelector(".currency-value"))
      ?? prices.find((node) => node.matches(".currency-value") && !node.closest("del, s, [hidden], [aria-hidden=true], .wt-text-strikethrough, .search-collage-original-price"))?.parentElement;
    const currency = clean(priceNode?.querySelector(".currency-symbol")?.textContent);
    const value = clean(priceNode?.querySelector(".currency-value")?.textContent);
    listings.set(listingId, { listingId, title: title.slice(0, 250), price: currency && value ? currency + value : null,
      url: `${url.origin}/listing/${listingId}` });
    if (highlight) card.dataset.glimpseaRead = "";
  }

  const next = Array.from(document.querySelectorAll("a[href]")).find((link) => {
    const href = new URL(link.href);
    return href.origin === url.origin && href.pathname === "/search"
      && href.searchParams.get("q") === url.searchParams.get("q")
      && href.searchParams.get("page") === String(page + 1);
  });
  if (highlight) document.querySelector("[data-glimpsea-read]")?.scrollIntoView({ block: "nearest" });
  return { page, url: url.href, listings: Array.from(listings.values()), nextUrl: next?.href ?? null,
    documentLoaded: document.readyState === "complete" };
};
