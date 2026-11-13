/* global readEtsySearch */
const origin = "http://127.0.0.1:3045";
const catalogButton = document.querySelector("#open-catalog");
const form = document.querySelector("#research");
const options = document.querySelector("#research-options");
const startButton = document.querySelector("#start-analysis");
const etsyKeyword = document.querySelector("#etsy-keyword");
const keywordError = document.querySelector("#keyword-error");
const allowEtsyButton = document.querySelector("#allow-etsy");
const openEtsyButton = document.querySelector("#open-etsy");
const accessNote = document.querySelector("#access-note");
const reportScope = document.querySelector("#report-scope");
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
let etsyTabKeyword = "";
let etsyReadVersion = 0;
const sampleKeyword = form.elements.keyword.defaultValue;
const etsyPermission = { origins: ["https://www.etsy.com/*"] };
const startingPrices = { basic: "0.01", medium: "0.03", deep: "0.06" };

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

function liveSelected() {
  return Boolean(mode?.etsyLive && form.elements.source.value === "etsy");
}

function pendingJob() {
  return activeJob && !["complete", "failed"].includes(activeJob.state);
}

function updateControls() {
  options.disabled = working || Boolean(pendingJob());
  startButton.disabled = working || (liveSelected() && !pendingJob() && !etsyTabKeyword);
  startButton.classList.toggle("secondary", !checkoutButton.hidden || !reportButton.hidden);
}

function updateScope() {
  if (!liveSelected()) return;
  const keyword = pendingJob() ? activeJob.keyword : etsyTabKeyword;
  const cafe = /\b(?:caf[eé]|coffee shop|barista)\b/i;
  reportScope.hidden = !keyword;
  reportScope.textContent = cafe.test(keyword) && cafe.test(form.elements.audience.value)
    ? "Report: listings, displayed prices, and three product ideas for cafe owners."
    : "Report: listings and displayed prices. Product ideas are available for cafe searches with a cafe audience.";
}

async function updateEtsyKeyword() {
  const version = ++etsyReadVersion;
  if (!liveSelected()) return;
  const granted = await chrome.permissions.contains(etsyPermission);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (version !== etsyReadVersion || !liveSelected()) return;
  const keyword = etsySearch(tab?.url)?.searchParams.get("q") ?? "";
  etsyTabKeyword = keyword.trim() && keyword.length <= 120 ? keyword : "";
  if (pendingJob()) {
    etsyKeyword.textContent = activeJob.keyword;
  } else if (etsyTabKeyword) {
    etsyKeyword.textContent = etsyTabKeyword;
  } else {
    etsyKeyword.textContent = !granted ? "Allow access to show the keyword from your Etsy tab."
      : keyword.length > 120 ? "Use an Etsy keyword of 120 characters or fewer."
      : "Open Etsy search results in this window.";
  }
  allowEtsyButton.hidden = granted || Boolean(pendingJob());
  openEtsyButton.hidden = !granted || Boolean(etsyTabKeyword) || Boolean(pendingJob());
  updateScope();
  updateControls();
}

function showReadyStatus() {
  status.textContent = liveSelected()
    ? "Etsy research reads up to two results pages after you start a trial or verify payment."
    : "Ready to search the sample catalog.";
}

function clearKeywordError() {
  keywordError.hidden = true;
  form.elements.keyword.removeAttribute("aria-invalid");
}

async function updateSource() {
  const live = liveSelected();
  for (const [id, name] of [["catalog-keyword", "keyword"], ["category-field", "category"], ["plan-field", "plan"]]) {
    document.getElementById(id).hidden = live;
    form.elements[name].disabled = live;
  }
  for (const id of ["etsy-search", "etsy-plan"]) document.getElementById(id).hidden = !live;
  catalogButton.hidden = live;
  clearKeywordError();
  if (!live) reportScope.hidden = true;
  document.querySelector("#demo-note").textContent = live
    ? "Read listings from the Etsy search beside this panel."
    : "Try Glimpsea with a sample catalog.";
  syncAccess();
  await updateEtsyKeyword();
  updateControls();
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
  const deadline = Date.now() + 30_000;
  let previousIds = "";
  let stableSince = 0;
  while (Date.now() < deadline) {
    const tab = await chrome.tabs.get(tabId);
    if (!etsySearch(tab.url)) throw new Error("Return to the Etsy search results tab and select Resume research.");
    // During pagination Opera can still report the previous URL or a loading tab.
    // The injected reader checks the current document and its results instead.
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId }, func: readEtsySearch, args: [page, keyword],
    }).catch((error) => {
      if (!/frame (?:was removed|with id)|no document|document (?:unloaded|was unloaded)/i.test(error.message)) throw error;
      return [];
    });
    const capture = injection?.result;
    if (capture?.listings.length) {
      const ids = capture.listings.map((listing) => listing.listingId).join(",");
      if (ids !== previousIds) {
        previousIds = ids;
        stableSince = Date.now();
      }
      if (capture.documentLoaded && Date.now() - stableSince >= 2_000) {
        await chrome.scripting.insertCSS({ target: { tabId }, files: ["catalog-content.css"] });
        await chrome.scripting.executeScript({ target: { tabId }, func: readEtsySearch, args: [page, keyword, true] });
        return capture;
      }
    } else {
      previousIds = "";
    }
    await sleep(500);
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
  const plan = liveSelected() ? "basic" : form.elements.plan.value;
  trial.disabled = trial.dataset.empty === "1" || plan !== "basic";
  if (trial.disabled) form.elements.access.selectedIndex = 1;
  else if (form.elements.access.dataset.intent !== "paid") form.elements.access.selectedIndex = 0;
  accessNote.hidden = Boolean(pendingJob());
  accessNote.textContent = form.elements.access.selectedIndex === 0 ? "Uses 1 Basic trial."
    : mode.nearTestnet ? `From ${startingPrices[plan]} NEAR on testnet. See the exact amount at checkout.`
    : "Simulated payment. No funds move.";
}

async function refresh() {
  const { remaining } = await call("trials");
  trials.textContent = `${remaining} Basic ${remaining === 1 ? "trial" : "trials"} left${accountId ? " on this NEAR account" : " in this browser"}.`;
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
  if (pendingJob() && mode.etsyLive && job.collection) {
    form.elements.source.value = job.collection;
    await updateSource();
  }
  if (job.listings) showCaptures(job);
  else scanResults.hidden = true;
  await chrome.storage.local.set({ glimpseaJob: job.id });
  if (job.state === "awaiting-payment") {
    status.textContent = "Pay on NEAR testnet before the scan starts. Then return here and select Resume research.";
    checkoutButton.hidden = false;
    startButton.textContent = "Resume research";
    status.scrollIntoView({ block: "nearest" });
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
  if (job.state === "failed") {
    throw new Error(job.checkout ? "Research failed after payment. Keep your testnet receipt and order ID."
      : "Research failed. If you used a trial, it is available again.");
  }
  if (job.state !== "complete") throw new Error("Research did not finish.");
  await chrome.storage.local.set({ glimpseaLastReport: job.id });
  status.textContent = `Report ready. Read ${job.pages} of up to ${job.limit} ${job.collection === "etsy" ? "Etsy" : "demo"} pages.`;
  startButton.textContent = "Start another search";
  reportButton.hidden = false;
  status.scrollIntoView({ block: "nearest" });
}

async function withProgress(work) {
  if (working) return;
  working = true;
  clearKeywordError();
  logoutButton.disabled = true;
  catalogButton.disabled = true;
  checkoutButton.hidden = true;
  reportButton.hidden = true;
  updateControls();
  try {
    await work();
    await refresh();
  } catch (error) {
    if (error.status === 401 && mode.nearTestnet) {
      await resetWallet(false);
    }
    if (error.message.startsWith("No results in the sample catalog")) {
      keywordError.textContent = error.message;
      keywordError.hidden = false;
      form.elements.keyword.setAttribute("aria-invalid", "true");
      form.elements.keyword.scrollIntoView({ block: "nearest" });
      status.textContent = "Update the keyword and try again.";
    } else {
      status.textContent = error.message;
      status.scrollIntoView({ block: "nearest" });
    }
    await refresh().catch(() => {});
  } finally {
    working = false;
    updateControls();
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
  if (accountId) await updateSource();
  else document.querySelector("#demo-note").textContent = "Connect a testnet wallet to use trials, pay for research, and open private reports.";
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
      showReadyStatus();
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
  const query = new URLSearchParams({ keyword: keyword || sampleKeyword, page: "1" });
  void showCatalog(`${origin}/demo-catalog?${query}`).catch((error) => { status.textContent = error.message; });
});
allowEtsyButton.addEventListener("click", () => {
  void chrome.permissions.request(etsyPermission).then(async (granted) => {
    await updateEtsyKeyword();
    if (!granted) status.textContent = "Allow Etsy access to read the search keyword and listing cards.";
    else showReadyStatus();
  }).catch((error) => { status.textContent = error.message; });
});
openEtsyButton.addEventListener("click", () => {
  const query = new URLSearchParams({ q: sampleKeyword });
  void chrome.tabs.create({ url: `https://www.etsy.com/search?${query}` });
});
function refreshActiveSearch() {
  void updateEtsyKeyword().catch((error) => { status.textContent = error.message; });
}
chrome.tabs.onActivated.addListener(refreshActiveSearch);
chrome.tabs.onUpdated.addListener((_id, change, tab) => {
  if (tab.active && (change.url || change.status === "complete")) refreshActiveSearch();
});
chrome.permissions.onRemoved.addListener(refreshActiveSearch);
connectButton.addEventListener("click", () => void connectWallet());
logoutButton.addEventListener("click", () => void resetWallet().catch((error) => { status.textContent = error.message; }));
form.elements.plan.addEventListener("change", syncAccess);
form.elements.access.addEventListener("change", () => {
  form.elements.access.dataset.intent = form.elements.access.selectedIndex === 0 ? "trial" : "paid";
  syncAccess();
});
form.elements.audience.addEventListener("input", updateScope);
form.elements.keyword.addEventListener("input", clearKeywordError);
form.elements.source.addEventListener("change", () => {
  showReadyStatus();
  void updateSource().catch((error) => { status.textContent = error.message; });
});
form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (working) return;
  const input = Object.fromEntries(new FormData(form));
  input.productionHours = Number(input.productionHours);
  if (!input.category) delete input.category;
  const live = liveSelected();
  const displayedKeyword = etsyTabKeyword;
  const permission = live ? chrome.permissions.request(etsyPermission) : undefined;
  void withProgress(async () => {
    if (permission && !await permission) throw new Error("Allow Etsy access to read the active search results tab.");
    const { glimpseaJob } = await chrome.storage.local.get("glimpseaJob");
    if (glimpseaJob) return run(await call("status", { id: glimpseaJob }));
    const collection = live ? "etsy" : "dom";
    if (collection === "etsy") {
      const { url } = await activeEtsyTab();
      if (url.searchParams.get("q") !== displayedKeyword) {
        await updateEtsyKeyword();
        throw new Error("The Etsy keyword changed. Check it here before starting research.");
      }
      input.keyword = url.searchParams.get("q");
      input.plan = "basic";
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
  }
  if (activeTab && isCatalog(activeTab)) {
    const keyword = new URL(activeTab.url).searchParams.get("keyword");
    if (keyword) form.elements.keyword.value = keyword.slice(0, 120);
  }
  if (mode.nearTestnet) {
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
    await updateSource();
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
  showReadyStatus();
  if (saved.glimpseaLastReport) {
    activeJob = await call("status", { id: saved.glimpseaLastReport }).catch(() => undefined);
    reportButton.hidden = activeJob?.state !== "complete";
    if (!reportButton.hidden) {
      startButton.textContent = "Start another search";
      status.textContent = `Report ready for “${activeJob.keyword}”.`;
      if (activeJob.listings) showCaptures(activeJob);
    }
  }
})().catch((error) => {
  status.textContent = mode ? error.message : "Could not reach Glimpsea. Start the local server, then reopen this panel.";
}).finally(updateControls);
