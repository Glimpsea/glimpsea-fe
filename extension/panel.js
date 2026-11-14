/* global readEtsySearch */
/* global GLIMPSEA_ORIGIN */
const origin = typeof GLIMPSEA_ORIGIN === "string" ? GLIMPSEA_ORIGIN : "http://127.0.0.1:3045";
const backend = new URL(origin);
const catalogMatch = `${backend.protocol}//${backend.hostname}/demo-catalog*`;
const reloadButton = document.querySelector("#reload-panel");
const form = document.querySelector("#research");
const options = document.querySelector("#research-options");
const startButton = document.querySelector("#start-analysis");
const newSearchButton = document.querySelector("#new-search");
const etsyKeyword = document.querySelector("#etsy-keyword");
const keywordHint = document.querySelector("#keyword-hint");
const useEtsyKeyword = document.querySelector("#use-etsy-keyword");
const trialAccess = document.querySelector("#trial-access");
const paidAccess = document.querySelector("#paid-access");
const paidLabel = document.querySelector("#paid-label");
const accessNote = document.querySelector("#access-note");
const reportButton = document.querySelector("#open-report");
const paymentReceipt = document.querySelector("#payment-receipt");
const checkoutButton = document.querySelector("#checkout");
const connectButton = document.querySelector("#connect-wallet");
const logoutButton = document.querySelector("#disconnect-wallet");
const status = document.querySelector("#status");
const trials = document.querySelector("#trials");
const walletDialog = document.querySelector("#wallet-dialog");
const walletFrame = document.querySelector("#wallet-frame");
const closeWalletButton = document.querySelector("#close-wallet");
const walletStatus = document.querySelector("#wallet-status");
const wallet = document.querySelector("#wallet");
const history = document.querySelector("#history");
const historySection = document.querySelector("#history-section");
const scanResults = document.querySelector("#scan-results");
const scanCount = document.querySelector("#scan-count");
const scanProgress = document.querySelector("#scan-progress");
const scanListings = document.querySelector("#scan-listings");
const opportunities = document.querySelector("#opportunities");
const opportunityForm = document.querySelector("#opportunity-form");
const opportunityFields = document.querySelector("#opportunity-fields");
const opportunityStatus = document.querySelector("#opportunity-status");
const sellerDetails = document.querySelector("#seller-details");
const opportunitySample = document.querySelector("#opportunity-sample");
const opportunityButton = document.querySelector("#open-opportunity");
const snapshotNote = document.querySelector("#snapshot-note");
let owner;
let activeJob;
let token;
let accountId;
let mode;
let working = false;
let verifiedPaymentId;
let openingOpportunity = false;
let connectingWallet = false;
let needsWalletForOrder = false;
let walletWait;
let walletView;
let tabKeyword = "";
let editedKeyword = false;
let selectedAccess = "trial";
let etsyReadVersion = 0;
const etsyPermission = { origins: ["https://www.etsy.com/*"] };

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
    const error = new Error(result?.error ?? "Glimpsea could not complete this request. Try again.");
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

function pendingJob() {
  return activeJob && !["complete", "failed"].includes(activeJob.state);
}

function updateControls() {
  reloadButton.disabled = working || openingOpportunity || connectingWallet;
  options.disabled = working || openingOpportunity || connectingWallet || needsWalletForOrder || Boolean(pendingJob());
  newSearchButton.hidden = !mode?.etsyLive || (!pendingJob() && !needsWalletForOrder);
  newSearchButton.disabled = working || openingOpportunity || connectingWallet;
  startButton.disabled = working || openingOpportunity || connectingWallet
    || (!mode?.etsyLive && !pendingJob() && !needsWalletForOrder);
  opportunityFields.disabled = working || openingOpportunity || connectingWallet;
  const custom = opportunityForm.elements.topic.value === "custom";
  const sample = activeJob?.collection === "etsy" && activeJob.state === "complete" ? activeJob : null;
  sellerDetails.hidden = sellerDetails.disabled = !custom;
  snapshotNote.hidden = custom;
  opportunityButton.disabled = custom && !sample;
  opportunityButton.textContent = custom ? "Generate private brief" : "Open private brief";
  opportunitySample.textContent = sample
    ? `Using your Etsy live scan for “${sample.keyword}” · ${sample.audience} · up to ${sample.productionHours} hours.`
    : "Enter your target buyers and available hours below, then run an Etsy live analysis.";
  logoutButton.disabled = working || openingOpportunity || connectingWallet;
  form.noValidate = Boolean(pendingJob()) || needsWalletForOrder;
  if (needsWalletForOrder) {
    startButton.textContent = accountId ? "Resume research" : "Connect wallet";
  } else if (!pendingJob()) {
    const paid = paidAccess.checked && mode?.nearTestnet;
    startButton.textContent = paid ? (accountId ? "Open checkout" : "Connect wallet")
      : activeJob?.state === "complete" ? "Start another search" : "Start analysis";
  }
  startButton.classList.toggle("secondary", !checkoutButton.hidden || !reportButton.hidden);
}

async function updateEtsyKeyword() {
  const version = ++etsyReadVersion;
  if (!mode?.etsyLive || pendingJob() || needsWalletForOrder || working) return;
  const granted = await chrome.permissions.contains(etsyPermission);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (version !== etsyReadVersion || pendingJob() || needsWalletForOrder || working) return;
  const keyword = etsySearch(tab?.url)?.searchParams.get("q")?.trim() ?? "";
  tabKeyword = keyword.length <= 120 ? keyword : "";
  if (tabKeyword && !editedKeyword) etsyKeyword.value = tabKeyword;
  keywordHint.textContent = tabKeyword
    ? `Etsy tab is searching for “${tabKeyword}”.`
    : granted ? "Glimpsea will open Etsy results for this keyword."
      : "When you start, allow Etsy access so Glimpsea can read the results.";
  useEtsyKeyword.hidden = !tabKeyword || etsyKeyword.value.trim() === tabKeyword;
}

function showReadyStatus() {
  status.textContent = "";
}

async function openEtsySearch(job) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = etsySearch(tab?.url);
  const target = job.nextUrl ?? `https://www.etsy.com/search?${new URLSearchParams({ q: job.keyword })}`;
  if (!url) return chrome.tabs.create({ url: target, active: true });
  return url.searchParams.get("q") === job.keyword && (url.searchParams.get("page") ?? "1") === String(job.pages + 1)
    ? tab : chrome.tabs.update(tab.id, { url: target });
}

async function scanEtsy(job) {
  if (!await chrome.permissions.contains(etsyPermission)) {
    throw new Error("Select Resume research and allow Etsy access to read the results.");
  }
  const tab = await openEtsySearch(job);
  let target;
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
    if (!etsySearch(tab.url)) {
      if (etsySearch(tab.pendingUrl) || tab.status === "loading") {
        await sleep(500);
        continue;
      }
      throw new Error("Return to the Etsy search results tab and select Resume research.");
    }
    // During pagination Opera can still report the previous URL or a loading tab.
    // The injected reader checks the current document and its results instead.
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId }, func: readEtsySearch, args: [page, keyword],
    }).catch((error) => {
      if (!/frame (?:was removed|with id)|no document|document (?:unloaded|was unloaded)/i.test(error.message)) throw error;
      return [];
    });
    const capture = injection?.result;
    if (capture?.blocked) {
      throw new Error("Etsy restricted access. Research is paused. Resume once the search results are visible in your Etsy tab.");
    }
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
  const tabs = await chrome.tabs.query({ currentWindow: true, url: catalogMatch });
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
    price.className = "listing-price";
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
  trialAccess.checked = !trialAccess.disabled && selectedAccess === "trial";
  paidAccess.checked = !trialAccess.checked;
  accessNote.hidden = Boolean(pendingJob());
  accessNote.textContent = trialAccess.checked ? "Start without a wallet."
    : mode.nearTestnet ? "0.01 testnet NEAR. Review the payment in checkout."
    : "Simulated payment. No funds move.";
  updateControls();
}

async function refresh() {
  const { remaining } = await call("trials");
  trials.textContent = `${remaining} Basic ${remaining === 1 ? "trial" : "trials"} left${accountId && !mode.guestTrials ? " on this NEAR account" : " in this browser"}.`;
  trialAccess.disabled = remaining === 0;
  syncAccess();
  if (!mode.nearTestnet) return;
  const { jobs } = await call("jobs");
  history.replaceChildren();
  for (const job of jobs) {
    if (job.state === "failed") continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary history-item";
    const title = document.createElement("span");
    title.textContent = job.access === "snapshot" ? `Open ${job.keyword}` : job.keyword;
    button.append(title);
    if (job.access !== "snapshot") {
      const state = document.createElement("span");
      state.className = "history-state";
      state.textContent = job.state === "complete" ? "Report ready" : job.state.replaceAll("-", " ");
      button.append(state);
    }
    button.addEventListener("click", () => {
      if (job.access === "snapshot" || job.access === "opportunity") {
        void withOpportunityProgress(async () => openPrivateReport(await call("status", { id: job.id })));
      } else {
        void withProgress(async () => run(await call("status", { id: job.id })));
      }
    });
    history.append(button);
  }
  historySection.hidden = !history.childElementCount;
}

async function run(job) {
  needsWalletForOrder = false;
  activeJob = job;
  paymentReceipt.hidden = !job.checkout?.txHash;
  if (job.checkout?.txHash) paymentReceipt.href = `https://testnet.nearblocks.io/txns/${job.checkout.txHash}`;
  if (job.collection === "etsy" && pendingJob()) {
    etsyKeyword.value = job.keyword;
    useEtsyKeyword.hidden = true;
    keywordHint.textContent = "This keyword is saved for the current order.";
  }
  if (job.listings) showCaptures(job);
  else scanResults.hidden = true;
  await chrome.storage.local.set({ glimpseaJob: job.id, glimpseaJobRequiresWallet: Boolean(job.checkout) });
  if (job.state === "awaiting-payment") {
    status.textContent = "Open checkout to review the testnet amount and pay.";
    checkoutButton.hidden = mode.guestTrials;
    startButton.textContent = mode.guestTrials ? "Open checkout" : "Resume research";
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
  await chrome.storage.local.remove(["glimpseaJob", "glimpseaJobRequiresWallet"]);
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
  if (working || openingOpportunity) return;
  working = true;
  checkoutButton.hidden = true;
  reportButton.hidden = true;
  updateControls();
  try {
    const result = await work();
    await refresh();
    return result;
  } catch (error) {
    if (error.status === 401 && mode.nearTestnet && token) {
      await resetWallet(false);
    }
    status.textContent = error.message;
    status.scrollIntoView({ block: "nearest" });
    await refresh().catch(() => {});
  } finally {
    working = false;
    updateControls();
    void updateEtsyKeyword().catch(() => {});
    if (verifiedPaymentId) {
      const id = verifiedPaymentId;
      verifiedPaymentId = undefined;
      void withProgress(async () => run(await call("status", { id })));
    }
  }
}

async function showWallet() {
  wallet.hidden = mode.guestTrials && !accountId;
  walletStatus.textContent = accountId || "Use a NEAR testnet wallet to run searches and open private reports.";
  connectButton.hidden = Boolean(accountId) || mode.guestTrials;
  logoutButton.hidden = !accountId;
  form.hidden = opportunities.hidden = !accountId && !mode.guestTrials;
  paidLabel.textContent = "Pay on NEAR testnet";
  paidAccess.value = "testnet-payment";
  await updateEtsyKeyword();
  syncAccess();
}

async function resetWallet(revoke = true) {
  if (revoke) {
    await auth("logout");
  }
  token = undefined;
  accountId = undefined;
  activeJob = undefined;
  await chrome.storage.local.remove(mode.guestTrials ? ["glimpseaNearToken", "glimpseaNearPair"]
    : ["glimpseaNearToken", "glimpseaJob", "glimpseaJobRequiresWallet", "glimpseaLastReport", "glimpseaNearPair"]);
  checkoutButton.hidden = true;
  paymentReceipt.hidden = true;
  reportButton.hidden = true;
  startButton.textContent = "Start analysis";
  scanResults.hidden = true;
  scanListings.replaceChildren();
  history.replaceChildren();
  historySection.hidden = true;
  opportunities.open = false;
  opportunityStatus.textContent = "";
  if (walletView) closeWalletView();
  await showWallet();
  if (mode.guestTrials) {
    const { glimpseaJobRequiresWallet } = await chrome.storage.local.get("glimpseaJobRequiresWallet");
    if (glimpseaJobRequiresWallet) showPendingWallet();
    await refresh();
  }
}

function showPendingWallet() {
  needsWalletForOrder = true;
  checkoutButton.hidden = true;
  status.textContent = "Connect the wallet used for this order to continue.";
  updateControls();
}

function openWalletView(params) {
  const url = new URL("/wallet", origin);
  url.search = new URLSearchParams({ ...params, panel: location.origin });
  walletView = params;
  walletDialog.hidden = false;
  walletFrame.src = url.href;
  walletDialog.scrollIntoView({ block: "nearest" });
}

function closeWalletView() {
  const wait = walletWait;
  walletWait = undefined;
  wait?.reject(new Error("Wallet connection canceled. Select Connect wallet to try again."));
  walletView = undefined;
  walletDialog.hidden = true;
  walletFrame.removeAttribute("src");
}

closeWalletButton.addEventListener("click", closeWalletView);
window.addEventListener("message", (event) => {
  if (event.origin !== origin || event.source !== walletFrame.contentWindow || !walletView) return;
  if (event.data?.type === "glimpsea-wallet-ready" && walletView.checkout && token) {
    walletFrame.contentWindow.postMessage({ type: "glimpsea-checkout-session", token }, origin);
  } else if (event.data?.type === "glimpsea-wallet-signed" && event.data.id === walletView.pair) {
    walletWait?.resolve();
  } else if (event.data?.type === "glimpsea-payment-verified" && event.data.id === walletView.checkout) {
    const id = walletView.checkout;
    closeWalletView();
    startButton.textContent = "Resume research";
    status.textContent = "Payment verified. Starting research…";
    if (working) verifiedPaymentId = id;
    else void withProgress(async () => run(await call("status", { id })));
  }
});

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
  connectingWallet = true;
  updateControls();
  try {
    const pair = savedPair || await auth("pair");
    if (mode.guestTrials) {
      status.textContent = "Choose a NEAR testnet wallet to pay for this search.";
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Wallet sign-in expired. Try again.")), 300_000);
        walletWait = {
          resolve() { clearTimeout(timeout); resolve(); },
          reject(error) { clearTimeout(timeout); reject(error); },
        };
        openWalletView({ pair: pair.id });
      }).finally(closeWalletView);
    } else if (!savedPair) {
      await chrome.storage.local.set({ glimpseaNearPair: pair });
      await chrome.tabs.create({ url: `${origin}/wallet?pair=${encodeURIComponent(pair.id)}` });
      status.textContent = "Finish signing in on the wallet tab.";
    }
    await finishPair(pair);
  } catch (error) {
    await chrome.storage.local.remove("glimpseaNearPair");
    status.textContent = error.message;
  } finally {
    connectButton.disabled = false;
    connectingWallet = false;
    updateControls();
  }
}

reloadButton.addEventListener("click", () => window.location.reload());

newSearchButton.addEventListener("click", () => {
  void withProgress(async () => {
    await chrome.storage.local.remove(["glimpseaJob", "glimpseaJobRequiresWallet"]);
    if (walletView) closeWalletView();
    activeJob = undefined;
    needsWalletForOrder = false;
    editedKeyword = true;
    etsyKeyword.value = "";
    paymentReceipt.hidden = true;
    scanResults.hidden = true;
    showReadyStatus();
  }).then(() => etsyKeyword.focus());
});

useEtsyKeyword.addEventListener("click", () => {
  editedKeyword = false;
  etsyKeyword.value = tabKeyword;
  useEtsyKeyword.hidden = true;
  etsyKeyword.focus();
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
form.addEventListener("change", (event) => {
  if (event.target.name !== "access") return;
  selectedAccess = event.target.value;
  showReadyStatus();
  syncAccess();
});
etsyKeyword.addEventListener("input", () => {
  editedKeyword = true;
  useEtsyKeyword.hidden = !tabKeyword || etsyKeyword.value.trim() === tabKeyword;
});
form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (working || connectingWallet || startButton.disabled) return;
  const input = Object.fromEntries(new FormData(form));
  input.keyword = etsyKeyword.value.trim();
  input.audience = form.elements.audience.value.trim();
  input.productionHours = Number(input.productionHours);
  if (!pendingJob() && !needsWalletForOrder && (!input.keyword || !input.audience)) {
    status.textContent = "Enter an Etsy keyword and target buyers.";
    (input.keyword ? form.elements.audience : etsyKeyword).focus();
    return;
  }
  const permission = mode.etsyLive && (!pendingJob() || activeJob.collection === "etsy")
    ? chrome.permissions.request(etsyPermission) : undefined;
  void withProgress(async () => {
    if (permission && !await permission) throw new Error("Allow Etsy access to read the active search results tab.");
    const { glimpseaJob, glimpseaJobRequiresWallet } = await chrome.storage.local.get(["glimpseaJob", "glimpseaJobRequiresWallet"]);
    if (glimpseaJob) {
      if (mode.guestTrials && glimpseaJobRequiresWallet && !accountId) {
        await connectWallet();
        if (!accountId) return;
      }
      const job = await call("status", { id: glimpseaJob });
      if (job.state !== "awaiting-payment" && walletView?.checkout === job.id) {
        verifiedPaymentId = undefined;
        closeWalletView();
      }
      await run(job);
      return job;
    }
    if (input.access === "testnet-payment" && mode.guestTrials && !accountId) {
      await connectWallet();
      if (!accountId) return;
    }
    const job = await call("start", { ...input, plan: "basic", collection: "etsy", paymentProtocol: "contract-v1" });
    await run(job);
    return job;
  }).then((job) => {
    if (mode.guestTrials && job?.state === "awaiting-payment") openWalletView({ checkout: job.id });
  });
});

checkoutButton.addEventListener("click", () => {
  if (!activeJob) return;
  if (mode.guestTrials) openWalletView({ checkout: activeJob.id });
  else void chrome.tabs.create({ url: `${origin}/wallet?checkout=${encodeURIComponent(activeJob.id)}` });
});

async function openPrivateReport(job) {
  const { reportPath } = mode.nearTestnet && !mode.guestTrials ? job : await call("open", { id: job.id }, "/session");
  await chrome.tabs.create({ url: origin + reportPath });
}

async function withOpportunityProgress(work, message = "Opening your brief…") {
  if (working || openingOpportunity) return;
  openingOpportunity = true;
  updateControls();
  opportunityStatus.textContent = message;
  try {
    await work();
    opportunityStatus.textContent = "Private brief opened in a new tab.";
  } catch (error) {
    if (error.status === 401 && mode.nearTestnet && token) await resetWallet(false);
    opportunityStatus.textContent = error.message;
  } finally {
    openingOpportunity = false;
    updateControls();
  }
}

opportunityForm.elements.topic.addEventListener("change", updateControls);
opportunityForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const fields = opportunityForm.elements;
  const topic = fields.topic.value;
  if (topic === "custom") {
    if (activeJob?.collection !== "etsy" || activeJob.state !== "complete") return;
    const input = {
      sampleId: activeJob.id,
      topic: fields.ideaTopic.value,
      keywords: fields.compareKeywords.value,
      skills: fields.skills.value,
      budgetUsd: fields.budget.valueAsNumber,
    };
    void withOpportunityProgress(async () => {
      await openPrivateReport(await call("generate-opportunities", input));
      await refresh();
    }, "Preparing 3–5 product ideas…");
    return;
  }
  void withOpportunityProgress(async () => {
    await openPrivateReport(await call("find-opportunities", { topic }));
    await refresh();
  });
});

reportButton.addEventListener("click", async () => {
  if (!activeJob) return;
  try {
    await openPrivateReport(activeJob);
  } catch (error) {
    status.textContent = error.message;
  }
});

startButton.disabled = true;
(async () => {
  const saved = await chrome.storage.local.get(["glimpseaOwner", "glimpseaJob", "glimpseaJobRequiresWallet", "glimpseaLastReport", "glimpseaNearToken", "glimpseaNearPair"]);
  const manifest = chrome.runtime.getManifest();
  const supportsEtsy = manifest.permissions.includes("scripting")
    && manifest.optional_host_permissions?.includes(etsyPermission.origins[0]);
  const configuration = await fetch(`${origin}/api/extension-demo${supportsEtsy ? "?etsy=1" : ""}`, { cache: "no-store" });
  if (!configuration.ok) throw new Error("Glimpsea configuration is unavailable.");
  mode = await configuration.json();
  if (!mode.etsyLive) {
    opportunityForm.querySelector('option[value="custom"]').hidden = true;
  }
  if (mode.guestTrials || !mode.nearTestnet && mode.simulation) {
    owner = saved.glimpseaOwner ?? crypto.randomUUID();
    if (!saved.glimpseaOwner) await chrome.storage.local.set({ glimpseaOwner: owner });
  }
  if (mode.nearTestnet) {
    token = saved.glimpseaNearToken;
    if (token) {
      try { ({ accountId } = await auth("account")); }
      catch (error) { if (error.status !== 401) throw error; await resetWallet(false); }
    }
    await showWallet();
    if (!accountId && !mode.guestTrials) {
      if (saved.glimpseaNearPair) await connectWallet(saved.glimpseaNearPair);
      else status.textContent = "";
      return;
    }
  } else if (mode.simulation) {
    form.hidden = false;
    opportunities.hidden = false;
    await updateEtsyKeyword();
  } else {
    throw new Error("This Glimpsea server is not accepting research requests.");
  }
  if (saved.glimpseaJob && mode.guestTrials && saved.glimpseaJobRequiresWallet && !accountId) {
    await refresh();
    showPendingWallet();
    return;
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
    await chrome.storage.local.remove(["glimpseaJob", "glimpseaJobRequiresWallet"]);
  }
  await refresh();
  if (mode.etsyLive) showReadyStatus();
  else status.textContent = "Etsy research is unavailable on this server.";
  if (saved.glimpseaLastReport) {
    activeJob = await call("status", { id: saved.glimpseaLastReport }).catch(() => undefined);
    if (activeJob?.checkout?.txHash) {
      paymentReceipt.href = `https://testnet.nearblocks.io/txns/${activeJob.checkout.txHash}`;
      paymentReceipt.hidden = false;
    }
    reportButton.hidden = activeJob?.state !== "complete";
    if (!reportButton.hidden) {
      startButton.textContent = "Start another search";
      status.textContent = `Report ready for “${activeJob.keyword}”.`;
      if (activeJob.listings) showCaptures(activeJob);
    }
  }
})().catch((error) => {
  status.textContent = mode ? error.message : "Could not reach Glimpsea. Check your connection and select Reload.";
}).finally(updateControls);
