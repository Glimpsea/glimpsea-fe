"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { NearConnector, NearWalletBase } from "@hot-labs/near-connect";

let connector: Promise<NearConnector> | undefined;

function walletConnector() {
  connector ??= import("@hot-labs/near-connect").then(({ NearConnector }) =>
    new NearConnector({
      network: "testnet",
      autoConnect: false,
      features: { testnet: true, signMessage: true, signAndSendTransaction: true, signInWithoutAddKey: true },
    }),
  ).catch((error: unknown) => {
    connector = undefined;
    throw error;
  });
  return connector;
}

async function hasAccount(wallet: NearWalletBase | undefined, account: string) {
  return (await wallet?.getAccounts())?.some(({ accountId }) => accountId === account) ?? false;
}

async function api<T>(path: string, body: object, token?: string): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Try again from the side panel.");
  return result;
}

function nearAmount(amount: string) {
  const padded = amount.padStart(25, "0");
  return `${padded.slice(0, -24)}.${padded.slice(-24).replace(/0+$/, "") || "0"}`;
}

type CheckoutJob = {
  state: string;
  collection?: string;
  checkout?: { receiver: string; amount: string; txHash: string | null; protocol?: "contract-v1"; verified?: boolean };
};

type ContractQuote = {
  args?: { order_id: string; issued_at_ms: string; expires_at_ms: string; signature: string };
  job?: CheckoutJob;
};

const auth = "/api/near-auth";
const research = "/api/extension-demo";
const subscribeToNothing = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function WalletFlow({ pair, checkout, panelOrigin }: { pair?: string; checkout?: string; panelOrigin?: string }) {
  const [session, setSession] = useState<string>();
  const hydrated = useSyncExternalStore(subscribeToNothing, clientReady, serverReady);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const actionInFlight = useRef(false);
  const [done, setDone] = useState(false);
  const [account, setAccount] = useState("");
  const [quote, setQuote] = useState<CheckoutJob["checkout"]>();
  const [txHash, setTxHash] = useState("");
  const [submittedHash, setSubmittedHash] = useState("");
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [etsy, setEtsy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const storageKey = `glimpsea-testnet-tx:${checkout}`;
  const attemptKey = `glimpsea-contract-payment:${checkout}`;

  useEffect(() => {
    if (!checkout || !panelOrigin) return;
    function receive(event: MessageEvent) {
      if (event.origin === panelOrigin && event.source === window.parent && event.data?.type === "glimpsea-checkout-session"
          && typeof event.data.token === "string" && /^[A-Za-z0-9_-]{43}$/.test(event.data.token)) {
        setSession(event.data.token);
      }
    }
    window.addEventListener("message", receive);
    window.parent.postMessage({ type: "glimpsea-wallet-ready" }, panelOrigin);
    return () => window.removeEventListener("message", receive);
  }, [checkout, panelOrigin]);

  useEffect(() => {
    if (!checkout || panelOrigin && !session) return;
    let current = true;
    Promise.all([
      api<{ accountId: string }>(auth, { action: "account" }, session),
      api<CheckoutJob>(research, { action: "status", id: checkout }, session),
    ]).then(([{ accountId }, job]) => {
      if (!current) return;
      if (!job.checkout) throw new Error("This order does not have a testnet checkout.");
      setAccount(accountId);
      setEtsy(job.collection === "etsy");
      setQuote(job.checkout);
      const savedHash = sessionStorage.getItem(storageKey) ?? "";
      setSubmittedHash(savedHash);
      setTxHash(job.checkout.txHash ?? savedHash);
      setRecoveryOpen(Boolean(!job.checkout.txHash && savedHash));
      setSubmitted(Boolean(sessionStorage.getItem(attemptKey)));
      setDone(Boolean(job.checkout.verified || job.checkout.txHash));
    }).catch((error: Error) => { if (current) setMessage(error.message); });
    return () => { current = false; };
  }, [checkout, panelOrigin, session, storageKey, attemptKey]);

  async function connect() {
    if (!pair) {
      setMessage("Start wallet sign-in from the Glimpsea side panel.");
      return;
    }
    const challenge = await api<{ nonce: string; message: string; recipient: string }>(auth, { action: "challenge", id: pair });
    const wallet = await (await walletConnector()).connect();
    const [selected] = await wallet.getAccounts();
    if (!selected) throw new Error("Select a NEAR testnet account.");
    const nonce = Uint8Array.from(atob(challenge.nonce.replace(/-/g, "+").replace(/_/g, "/")), (byte) => byte.charCodeAt(0));
    const signed = await wallet.signMessage({
      message: challenge.message, recipient: challenge.recipient, nonce, network: "testnet", signerId: selected.accountId,
    });
    if (signed.accountId !== selected.accountId) throw new Error(`Sign the message with ${selected.accountId}.`);
    const result = await api<{ accountId: string }>(auth, { action: "verify", id: pair, ...signed });
    setAccount(result.accountId);
    setMessage(panelOrigin ? "Wallet connected." : "Wallet connected. Return to the Glimpsea side panel.");
    setDone(true);
    if (panelOrigin) window.parent.postMessage({ type: "glimpsea-wallet-signed", id: pair }, panelOrigin);
  }

  async function pay(existingHash: string) {
    if (!quote || !checkout) return;
    if (quote.protocol === "contract-v1") {
      await payContract(quote.receiver, existingHash);
      return;
    }
    let hash = existingHash.trim();
    if (!hash) {
      const selector = await walletConnector();
      let wallet = await selector.wallet().catch(() => undefined);
      if (!wallet || !await hasAccount(wallet, account)) {
        wallet = await selector.connect();
        if (!await hasAccount(wallet, account)) throw new Error(`Connect ${account} to pay for this order.`);
      }
      const result = await wallet.signAndSendTransaction({
        signerId: account, network: "testnet", receiverId: quote.receiver,
        actions: [{ type: "Transfer", params: { deposit: quote.amount } }],
      });
      hash = result?.transaction?.hash;
      if (!hash) {
        setRecoveryOpen(true);
        throw new Error("Check your wallet activity. If the transfer went through, verify it using its transaction hash.");
      }
      sessionStorage.setItem(storageKey, hash);
      setSubmittedHash(hash);
    }
    setTxHash(hash);
    await api(research, { action: "pay", id: checkout, txHash: hash.trim() }, session);
    sessionStorage.removeItem(storageKey);
    setMessage("");
    setDone(true);
    if (panelOrigin) window.parent.postMessage({ type: "glimpsea-payment-verified", id: checkout, hash: hash.trim() }, panelOrigin);
  }

  async function payContract(receiverId: string, knownHash: string, checkOnly = false) {
    let hash = knownHash;
    if (!checkOnly) {
      const signed = await api<ContractQuote>(research, { action: "contract-quote", id: checkout }, session);
      if (signed.job) {
        finishContractPayment(signed.job);
        return;
      }
      if (!signed.args) throw new Error("Could not prepare the order for payment.");
      const selector = await walletConnector();
      let wallet = await selector.wallet().catch(() => undefined);
      if (!wallet || !await hasAccount(wallet, account)) {
        wallet = await selector.connect();
        if (!await hasAccount(wallet, account)) throw new Error(`Connect ${account} to pay for this order.`);
      }
      sessionStorage.setItem(attemptKey, "1");
      setSubmitted(true);
      try {
        const result = await wallet.signAndSendTransaction({
          signerId: account, network: "testnet", receiverId,
          actions: [{ type: "FunctionCall", params: { methodName: "pay", args: signed.args, gas: "40000000000000", deposit: "10000000000000000000000" } }],
        });
        hash = result?.transaction?.hash ?? "";
        if (hash) {
          sessionStorage.setItem(storageKey, hash);
          setSubmittedHash(hash);
        }
      } catch {
        setMessage("Checking NEAR for the order payment…");
      }
    }
    for (let attempt = 0; attempt < 12; attempt++) {
      try {
        const job = await api<CheckoutJob>(research, { action: "pay", id: checkout, txHash: hash || undefined }, session);
        finishContractPayment(job);
        return;
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "Waiting for a finalized NEAR payment.") throw error;
        if (checkOnly) break;
        await new Promise((resolve) => setTimeout(resolve, 1_500));
      }
    }
    throw new Error("NEAR has not finalized a payment for this order. Check again if your wallet submitted it.");
  }

  function finishContractPayment(job: CheckoutJob) {
    if (!job.checkout?.verified) throw new Error("The checkout is waiting for final payment.");
    const hash = job.checkout.txHash ?? "";
    sessionStorage.removeItem(attemptKey);
    sessionStorage.removeItem(storageKey);
    setTxHash(hash);
    setMessage("");
    setDone(true);
    if (panelOrigin) window.parent.postMessage({ type: "glimpsea-payment-verified", id: checkout }, panelOrigin);
  }

  async function act(paymentHash = "", checkOnly = false) {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setBusy(true);
    setMessage("");
    try {
      if (checkout && quote?.protocol === "contract-v1" && checkOnly) await payContract(quote.receiver, paymentHash, true);
      else if (checkout) await pay(paymentHash);
      else await connect();
    } catch (error) {
      if (checkout && (paymentHash || sessionStorage.getItem(storageKey))) setRecoveryOpen(true);
      setMessage(error instanceof Error ? error.message : "Try again.");
    } finally {
      actionInFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 grid max-w-xl gap-3">
      {!checkout && <p>Choose a NEAR testnet wallet and sign a message to connect.</p>}
      {checkout && !quote && !message && <p role="status">Loading your payment details…</p>}
      {checkout && quote && (
        <div className="grid gap-2 rounded-lg border border-ink/20 bg-[#fff9eb] p-3">
          <p className="break-words"><strong className="text-xl tabular-nums">{nearAmount(quote.amount)}</strong> testnet NEAR</p>
          <dl className="grid gap-1 text-sm">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2"><dt className="font-semibold">From</dt><dd className="break-all">{account}</dd></div>
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2"><dt className="font-semibold">To</dt><dd className="break-all">{quote.receiver}</dd></div>
          </dl>
        </div>
      )}
      {!done && (!checkout || quote) && (
        <button className="run-button w-full" type="button" onClick={() => void act(submittedHash, quote?.protocol === "contract-v1" && submitted)} disabled={!hydrated || busy}>
          {busy ? "Waiting for wallet or verification…" : checkout ? submittedHash || quote?.protocol === "contract-v1" && submitted ? "Check payment" : "Pay with testnet NEAR" : "Connect wallet"}
        </button>
      )}
      {checkout && quote?.protocol === "contract-v1" && submitted && !busy && !done && !submittedHash && (
        <button className="min-h-11 rounded border px-3 font-semibold" type="button" onClick={() => void act()}>
          Try paying again
        </button>
      )}
      {checkout && quote && quote.protocol !== "contract-v1" && !done && (
        <details open={recoveryOpen} onToggle={(event) => setRecoveryOpen(event.currentTarget.open)} className="border-t border-ink/20 text-sm">
          <summary className="min-h-11 py-2 font-semibold">Already paid?</summary>
          <form className="grid gap-2 pb-2" onSubmit={(event) => { event.preventDefault(); void act(txHash); }}>
            <label className="grid gap-1">
              Transaction hash
              <input className="min-h-11 w-full rounded border px-2" value={txHash} onChange={(event) => setTxHash(event.target.value)} disabled={busy} spellCheck={false} required />
            </label>
            <button className="min-h-11 rounded border px-3 font-semibold" type="submit" disabled={busy || !txHash.trim()}>Verify payment</button>
          </form>
        </details>
      )}
      {done && checkout && (
        <>
          <p role="status">Payment verified. {panelOrigin ? "Select" : etsy ? "Return to your Etsy search tab and select" : "Return to the Glimpsea side panel and select"} <strong>Resume research</strong>.</p>
          {txHash && <a className="underline" target="_blank" rel="noreferrer" href={`https://testnet.nearblocks.io/txns/${encodeURIComponent(txHash)}`}>View testnet receipt</a>}
        </>
      )}
      <p role="status">{message}</p>
    </div>
  );
}
