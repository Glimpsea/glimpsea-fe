"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
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
  checkout?: { receiver: string; amount: string; txHash: string | null };
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
  const [done, setDone] = useState(false);
  const [account, setAccount] = useState("");
  const [quote, setQuote] = useState<CheckoutJob["checkout"]>();
  const [txHash, setTxHash] = useState("");
  const [etsy, setEtsy] = useState(false);
  const storageKey = `glimpsea-testnet-tx:${checkout}`;

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
      setTxHash(job.checkout.txHash ?? sessionStorage.getItem(storageKey) ?? "");
      setDone(Boolean(job.checkout.txHash));
    }).catch((error: Error) => { if (current) setMessage(error.message); });
    return () => { current = false; };
  }, [checkout, panelOrigin, session, storageKey]);

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

  async function pay() {
    if (!quote || !checkout) return;
    let hash = txHash;
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
      if (!hash) throw new Error("If your wallet sent the transfer, paste its transaction hash below before trying again.");
      sessionStorage.setItem(storageKey, hash);
      setTxHash(hash);
    }
    await api(research, { action: "pay", id: checkout, txHash: hash.trim() }, session);
    setMessage("");
    setDone(true);
    if (panelOrigin) window.parent.postMessage({ type: "glimpsea-payment-verified", id: checkout, hash: hash.trim() }, panelOrigin);
  }

  async function act() {
    setBusy(true);
    setMessage("");
    try {
      if (checkout) await pay();
      else await connect();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 grid max-w-xl gap-4">
      <p>{checkout ? "Pay with testnet NEAR to unlock this research order." : panelOrigin ? "Sign a message to verify the wallet you want to pay from." : "Sign a message to connect your NEAR testnet wallet."}</p>
      {account && <p className="break-all">{account}</p>}
      {checkout && quote && (
        <>
          <p className="break-all"><strong>{nearAmount(quote.amount)} testnet NEAR</strong> to {quote.receiver}</p>
          {!done && <label className="grid gap-1">
            Already paid? Paste the transaction hash
            <input className="min-h-11 rounded border px-2" value={txHash} onChange={(event) => setTxHash(event.target.value)} disabled={busy} />
          </label>}
        </>
      )}
      {!done && (!checkout || quote) && (
        <button className="run-button w-fit" type="button" onClick={act} disabled={!hydrated || busy}>
          {busy ? "Waiting for wallet or verification…" : checkout ? txHash ? "Verify payment" : "Pay with testnet NEAR" : "Connect wallet"}
        </button>
      )}
      {done && checkout && txHash && (
        <>
          <p role="status">Payment verified. {panelOrigin ? "Select" : etsy ? "Return to your Etsy search tab and select" : "Return to the Glimpsea side panel and select"} <strong>Resume research</strong>.</p>
          <a className="underline" target="_blank" rel="noreferrer" href={`https://testnet.nearblocks.io/txns/${encodeURIComponent(txHash)}`}>View testnet receipt</a>
        </>
      )}
      <p role="status">{message}</p>
    </div>
  );
}
