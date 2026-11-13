const origin = "http://127.0.0.1:3045";
const catalogButton = document.querySelector("#open-catalog");
const form = document.querySelector("#research");
const startButton = form.querySelector("button");
const reportButton = document.querySelector("#open-report");
const checkoutButton = document.querySelector("#checkout");
const connectButton = document.querySelector("#connect-wallet");
const logoutButton = document.querySelector("#disconnect-wallet");
const status = document.querySelector("#status");
const trials = document.querySelector("#trials");
const walletStatus = document.querySelector("#wallet-status");
const history = document.querySelector("#history");
const scanResults = document.querySelector("#scan-results");
const scanCount = document.querySelector("#scan-count");
const scanProgress = document.querySelector("#scan-progress");
const scanListings = document.querySelector("#scan-listings");
let owner;
let activeJob;
let token;
let accountId;
let mode;
let working = false;

async function request(path, data) {
  const response = await fetch(origin + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(owner ? { "X-Glimpsea-Demo": owner } : {}),
    },
    body: JSON.stringify(data),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) {
    const error = new Error(result?.error ?? "Start the local Glimpsea server and try again.");
    error.status = response.status;
    throw error;
  }
  return result;
}

const auth = (action, data = {}) => request("/api/near-auth", { action, ...data });
const call = (action, data = {}, suffix = "") => request(`/api/extension-demo${suffix}`, { action, ...data });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function etsySearch(url) {
  if (!url) return;
  const parsed = URL.parse(url);
  if (parsed?.origin === "https://www.etsy.com" && parsed.pathname === "/search") return parsed;
}

async function activeEtsyTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = etsySearch(tab?.url);
  if (!url?.searchParams.get("q")?.trim()) {
    throw new Error("Open an Etsy search results page in this window and try again.");
  }
  return { tab, url };
}

async function scanEtsy(job) {
  const { tab, url } = await activeEtsyTab();
  let target = job.nextUrl;
  if (job.pages === 0 && (url.searchParams.get("q") !== job.keyword || ![null, "1"].includes(url.searchParams.get("page")))) {
    url.search = new URLSearchParams({ q: job.keyword }).toString();
    target = url.href;
  }
  showCaptures(job);
  status.scrollIntoView({ block: "start" });
  while (job.state === "browsing" && job.pages < job.limit) {
    const page = job.pages + 1;
    status.textContent = `Reading Etsy page ${page} of up to ${job.limit}…`;
    if (target && (await chrome.tabs.get(tab.id)).url !== target) await chrome.tabs.update(tab.id, { url: target });
    const capture = await readEtsy(tab.id, page, job.keyword);
    job = (await call("page", { id: job.id, page, capture })).job;
    showCaptures(job);
    target = job.nextUrl;
    if (job.state === "browsing") await sleep(900);
  }
  return job;
}

async function readEtsy(tabId, page, keyword) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const tab = await chrome.tabs.get(tabId);
    const url = etsySearch(tab.url);
    if (tab.status === "complete" && url?.searchParams.get("q") === keyword
        && (url.searchParams.get("page") ?? "1") === String(page)) {
      const [injection] = await chrome.scripting.executeScript({ target: { tabId }, files: ["etsy-search.js"] });
      if (injection?.result?.page === page && injection.result.listings.length) {
        await chrome.scripting.insertCSS({ target: { tabId }, files: ["catalog-content.css"] });
        return injection.result;
      }
    }
    await sleep(300);
  }
  throw new Error(`Could not find readable listings on Etsy page ${page}. Check the Etsy tab, then select Resume research.`);
}

async function readCatalog(tabId, url, page) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === "complete" && tab.url === url) {
      const capture = await chrome.tabs.sendMessage(tabId, { type: "read-demo-catalog", url, interactive: true }).catch(() => null);
      if (capture?.page === page) return capture;
    }
    await sleep(250);
  }
  throw new Error(`Could not read demo page ${page}. Select Resume research to try again.`);
}

function isCatalog(tab) {
  if (!tab.url) return false;
  const url = new URL(tab.url);
  return url.origin === origin && url.pathname === "/demo-catalog";
}

async function showCatalog(url) {
  const tabs = await chrome.tabs.query({ currentWindow: true, url: "http://127.0.0.1/demo-catalog*" });
  const tab = tabs.find((candidate) => candidate.active && isCatalog(candidate)) ?? tabs.find(isCatalog);
  if (!tab) return chrome.tabs.create({ url, active: true });
  return chrome.tabs.update(tab.id, { active: true, ...(tab.url !== url && { url }) });
}

function showCaptures(job) {
  scanResults.hidden = false;
  const listings = job.listings ?? [];
  scanCount.textContent = `${job.pages} of ${job.limit} pages read · ${listings.length} unique listings`;
  scanProgress.max = job.limit;
  scanProgress.value = job.pages;
  scanListings.replaceChildren(...listings.map((listing) => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = listing.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = listing.title;
    const price = document.createElement("span");
    price.textContent = listing.price ?? "No price shown";
    item.append(link, price);
    return item;
  }));
}

async function scanCatalog(job) {
  let url = origin + job.catalogPath;
  const tab = await showCatalog(url);
  showCaptures(job);
  status.scrollIntoView({ block: "start" });
  while (job.state === "browsing" && job.pages < job.limit) {
    const page = job.pages + 1;
    status.textContent = `Reading page ${page} of up to ${job.limit}…`;
    const capture = await readCatalog(tab.id, url, page);
    job = (await call("page", { id: job.id, page, capture })).job;
    showCaptures(job);
    if (job.state !== "browsing" || job.pages >= job.limit) break;
    if (capture.nextUrl !== origin + job.catalogPath) throw new Error("The demo catalog returned an unexpected next page.");
    await sleep(600);
    url = capture.nextUrl;
    await chrome.tabs.update(tab.id, { url });
  }
  return job;
}

function syncAccess() {
  const trial = form.elements.access.options[0];
  trial.disabled = trial.dataset.empty === "1" || form.elements.plan.value !== "basic";
  if (trial.disabled) form.elements.access.selectedIndex = 1;
}

async function refresh() {
  const { remaining } = await call("trials");
  trials.textContent = `${remaining} Basic trials left${accountId ? " on this NEAR account" : " in this browser"}.`;
  form.elements.access.options[0].dataset.empty = remaining === 0 ? "1" : "0";
  syncAccess();
  if (!mode.nearTestnet) return;
  const { jobs } = await call("jobs");
  history.replaceChildren();
  for (const job of jobs) {
    if (job.state === "failed") continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary";
    button.textContent = `${job.keyword} · ${job.state.replaceAll("-", " ")}`;
    button.addEventListener("click", () => void withProgress(async () => run(await call("status", { id: job.id }))));
    history.append(button);
  }
}

async function run(job) {
  activeJob = job;
  if (job.listings) showCaptures(job);
  else scanResults.hidden = true;
  await chrome.storage.local.set({ glimpseaJob: job.id });
  if (job.state === "awaiting-payment") {
    status.textContent = "Payment is required before reading pages. Complete checkout, then select Resume research.";
    checkoutButton.hidden = false;
    startButton.textContent = "Resume research";
    return;
  }
  if (job.state === "browsing" && job.catalogPath) {
    startButton.textContent = "Resume research";
    job = await scanCatalog(job);
  }
  if (job.state === "browsing" && job.collection === "etsy") {
    startButton.textContent = "Resume research";
    job = await scanEtsy(job);
  }
  while (job.state === "browsing") {
    status.textContent = `Reading page ${job.pages + 1} of up to ${job.limit}…`;
    job = (await call("page", { id: job.id, page: job.pages + 1 })).job;
  }
  while (job.state === "ready" || job.state === "analyzing") {
    status.textContent = `Preparing your report from ${job.pages} ${job.collection === "etsy" ? "Etsy" : "demo"} pages…`;
    job = await call("analyze", { id: job.id });
    if (job.state === "analyzing") await sleep(1000);
  }
  activeJob = job;
  await chrome.storage.local.remove("glimpseaJob");
  startButton.textContent = "Start analysis";
  if (job.state === "failed") throw new Error("Research failed. A reserved trial becomes available again.");
  if (job.state !== "complete") throw new Error("Research did not finish.");
  await chrome.storage.local.set({ glimpseaLastReport: job.id });
  status.textContent = `Report ready. Read ${job.pages} of up to ${job.limit} ${job.collection === "etsy" ? "Etsy" : "demo"} pages.`;
  reportButton.hidden = false;
}

async function withProgress(work) {
  if (working) return;
  working = true;
  startButton.disabled = true;
  logoutButton.disabled = true;
  catalogButton.disabled = true;
  checkoutButton.hidden = true;
  reportButton.hidden = true;
  try {
    await work();
    await refresh();
  } catch (error) {
    if (error.status === 401 && mode.nearTestnet) {
      await resetWallet(false);
    }
    status.textContent = error.message;
    await refresh().catch(() => {});
  } finally {
    working = false;
    startButton.disabled = false;
    logoutButton.disabled = false;
    catalogButton.disabled = false;
  }
}

async function showWallet() {
  walletStatus.textContent = accountId || "Connect a NEAR testnet wallet to use trials and open reports.";
  connectButton.hidden = Boolean(accountId);
  logoutButton.hidden = !accountId;
  form.hidden = !accountId;
  form.elements.access.options[1].textContent = "Pay on NEAR testnet";
  form.elements.access.options[1].value = "testnet-payment";
}

async function resetWallet(revoke = true) {
  if (revoke) {
    await auth("logout");
  }
  token = undefined;
  accountId = undefined;
  activeJob = undefined;
  await chrome.storage.local.remove(["glimpseaNearToken", "glimpseaJob", "glimpseaLastReport", "glimpseaNearPair"]);
  checkoutButton.hidden = true;
  reportButton.hidden = true;
  startButton.textContent = "Start analysis";
  scanResults.hidden = true;
  scanListings.replaceChildren();
  history.replaceChildren();
  await showWallet();
}

async function finishPair(pair) {
  for (let i = 0; i < 150; i++) {
    const result = await auth("redeem", pair);
    if (!result.pending) {
      token = result.token;
      accountId = result.accountId;
      await chrome.storage.local.set({ glimpseaNearToken: token });
      await chrome.storage.local.remove("glimpseaNearPair");
      await showWallet();
      await refresh();
      status.textContent = "Ready to search the demo catalog.";
      return;
    }
    await sleep(2000);
  }
  throw new Error("Wallet sign-in expired. Start again.");
}

async function connectWallet(savedPair) {
  connectButton.disabled = true;
  try {
    const pair = savedPair || await auth("pair");
    if (!savedPair) {
      await chrome.storage.local.set({ glimpseaNearPair: pair });
      await chrome.tabs.create({ url: `${origin}/wallet?pair=${encodeURIComponent(pair.id)}` });
    }
    status.textContent = "Finish signing in on the wallet tab.";
    await finishPair(pair);
  } catch (error) {
    await chrome.storage.local.remove("glimpseaNearPair");
    status.textContent = error.message;
  } finally {
    connectButton.disabled = false;
  }
}

catalogButton.addEventListener("click", () => {
  const keyword = form.elements.keyword.value.trim();
  const query = new URLSearchParams({ keyword: keyword || "cafe owner supplies", page: "1" });
  void showCatalog(`${origin}/demo-catalog?${query}`).catch((error) => { status.textContent = error.message; });
});
connectButton.addEventListener("click", () => void connectWallet());
logoutButton.addEventListener("click", () => void resetWallet().catch((error) => { status.textContent = error.message; }));
form.elements.plan.addEventListener("change", syncAccess);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = Object.fromEntries(new FormData(form));
  input.productionHours = Number(input.productionHours);
  if (!input.category) delete input.category;
  const live = mode.etsyLive && input.source === "etsy";
  const permission = live ? chrome.permissions.request({ origins: ["https://www.etsy.com/*"] }) : undefined;
  void withProgress(async () => {
    if (permission && !await permission) throw new Error("Allow Etsy access to read the active search results tab.");
    const { glimpseaJob } = await chrome.storage.local.get("glimpseaJob");
    if (glimpseaJob) return run(await call("status", { id: glimpseaJob }));
    const collection = live ? "etsy" : "dom";
    if (collection === "etsy") {
      const { url } = await activeEtsyTab();
      input.keyword = url.searchParams.get("q");
    }
    await run(await call("start", { ...input, collection }));
  });
});

checkoutButton.addEventListener("click", () => {
  if (activeJob) void chrome.tabs.create({ url: `${origin}/wallet?checkout=${encodeURIComponent(activeJob.id)}` });
});

reportButton.addEventListener("click", async () => {
  if (!activeJob) return;
  try {
    const { reportPath } = mode.nearTestnet ? activeJob : await call("open", { id: activeJob.id }, "/session");
    await chrome.tabs.create({ url: origin + reportPath });
  } catch (error) {
    status.textContent = error.message;
  }
});

startButton.disabled = true;
(async () => {
  const saved = await chrome.storage.local.get(["glimpseaOwner", "glimpseaJob", "glimpseaLastReport", "glimpseaNearToken", "glimpseaNearPair"]);
  const configuration = await fetch(`${origin}/api/extension-demo`);
  mode = await configuration.json();
  const [activeTab] = await chrome.tabs.query({ currentWindow: true, active: true });
  if (mode.etsyLive) {
    document.querySelector("#source-field").hidden = false;
    form.elements.source.value = activeTab && isCatalog(activeTab) ? "dom" : "etsy";
    const keyword = etsySearch(activeTab?.url)?.searchParams.get("q");
    if (keyword) form.elements.keyword.value = keyword.slice(0, 120);
    document.querySelector("#demo-note").textContent = "Basic can read the active Etsy search tab. Open Glimpsea from the toolbar on that tab.";
  }
  if (activeTab && isCatalog(activeTab)) {
    const keyword = new URL(activeTab.url).searchParams.get("keyword");
    if (keyword) form.elements.keyword.value = keyword.slice(0, 120);
  }
  if (mode.nearTestnet) {
    if (!mode.etsyLive) document.querySelector("#demo-note").textContent = "Search the local Etsy simulation beside Glimpsea. Paid research uses NEAR testnet.";
    token = saved.glimpseaNearToken;
    if (token) {
      try { ({ accountId } = await auth("account")); }
      catch (error) { if (error.status !== 401) throw error; await resetWallet(false); }
    }
    await showWallet();
    if (!accountId) {
      if (saved.glimpseaNearPair) await connectWallet(saved.glimpseaNearPair);
      else status.textContent = "Sign in to start research.";
      return;
    }
  } else if (mode.simulation) {
    owner = saved.glimpseaOwner ?? crypto.randomUUID();
    await chrome.storage.local.set({ glimpseaOwner: owner });
    form.hidden = false;
  } else {
    throw new Error("Enable the extension on the local Glimpsea server.");
  }
  if (saved.glimpseaJob) {
    const job = await call("status", { id: saved.glimpseaJob }).catch((error) => {
      if (error.status !== 404) throw error;
      return null;
    });
    if (job) {
      await withProgress(() => run(job));
      return;
    }
    await chrome.storage.local.remove("glimpseaJob");
  }
  await refresh();
  status.textContent = "Ready to search the demo catalog.";
  if (saved.glimpseaLastReport) {
    activeJob = await call("status", { id: saved.glimpseaLastReport }).catch(() => undefined);
    reportButton.hidden = activeJob?.state !== "complete";
    if (activeJob?.listings) showCaptures(activeJob);
  }
})().catch((error) => { status.textContent = error.message; }).finally(() => { startButton.disabled = false; });
