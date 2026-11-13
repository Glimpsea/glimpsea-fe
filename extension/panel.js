const origin = "http://127.0.0.1:3045";
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
  await chrome.storage.local.set({ glimpseaJob: job.id });
  if (job.state === "awaiting-payment") {
    status.textContent = "Payment is required before reading pages. Complete checkout, then select Resume research.";
    checkoutButton.hidden = false;
    startButton.textContent = "Resume research";
    return;
  }
  while (job.state === "browsing") {
    status.textContent = `Reading page ${job.pages + 1} of up to ${job.limit}…`;
    job = (await call("page", { id: job.id, page: job.pages + 1 })).job;
  }
  while (job.state === "ready" || job.state === "analyzing") {
    status.textContent = `Preparing your brief from ${job.pages} demo pages…`;
    job = await call("analyze", { id: job.id });
    if (job.state === "analyzing") await sleep(1000);
  }
  activeJob = job;
  await chrome.storage.local.remove("glimpseaJob");
  startButton.textContent = "Start research";
  if (job.state === "failed") throw new Error("Research failed. A reserved trial becomes available again.");
  if (job.state !== "complete") throw new Error("Research did not finish.");
  await chrome.storage.local.set({ glimpseaLastReport: job.id });
  status.textContent = `Report ready. Read ${job.pages} of up to ${job.limit} demo pages.`;
  reportButton.hidden = false;
}

async function withProgress(work) {
  if (working) return;
  working = true;
  startButton.disabled = true;
  logoutButton.disabled = true;
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
  startButton.textContent = "Start research";
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

connectButton.addEventListener("click", () => void connectWallet());
logoutButton.addEventListener("click", () => void resetWallet().catch((error) => { status.textContent = error.message; }));
form.elements.plan.addEventListener("change", syncAccess);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = Object.fromEntries(new FormData(form));
  input.productionHours = Number(input.productionHours);
  if (!input.category) delete input.category;
  void withProgress(async () => {
    const { glimpseaJob } = await chrome.storage.local.get("glimpseaJob");
    await run(glimpseaJob ? await call("status", { id: glimpseaJob }) : await call("start", input));
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
  if (mode.nearTestnet) {
    document.querySelector("#demo-note").textContent = "Search the synthetic catalog. Paid research uses NEAR testnet.";
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
  }
})().catch((error) => { status.textContent = error.message; }).finally(() => { startButton.disabled = false; });
