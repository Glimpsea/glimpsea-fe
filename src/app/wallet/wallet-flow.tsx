"use client";

import { useEffect, useState } from "react";
import type { NearConnector } from "@hot-labs/near-connect";

let connector: NearConnector | undefined;

async function walletConnector() {
  if (!connector) {
    const { NearConnector } = await import("@hot-labs/near-connect");
    connector = new NearConnector({
      network: "testnet",
      features: { testnet: true, signMessage: true, signAndSendTransaction: true, signInWithoutAddKey: true },
    });
  }
  return connector;
}

async function api<T>(path: string, body: object): Promise<T> {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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
  checkout?: { receiver: string; amount: string; txHash: string | null };
};

const auth = "/api/near-auth";
const research = "/api/extension-demo";

export function WalletFlow({ pair, checkout }: { pair?: string; checkout?: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [account, setAccount] = useState("");
  const [quote, setQuote] = useState<CheckoutJob["checkout"]>();
  const [txHash, setTxHash] = useState("");
  const storageKey = `glimpsea-testnet-tx:${checkout}`;

  useEffect(() => {
    if (!checkout) return;
    let current = true;
    Promise.all([
      api<{ accountId: string }>(auth, { action: "account" }),
      api<CheckoutJob>(research, { action: "status", id: checkout }),
    ]).then(([{ accountId }, job]) => {
      if (!current) return;
      if (!job.checkout) throw new Error("This order does not have a testnet checkout.");
      setAccount(accountId);
      setQuote(job.checkout);
      setTxHash(job.checkout.txHash ?? sessionStorage.getItem(storageKey) ?? "");
      setDone(Boolean(job.checkout.txHash));
    }).catch((error: Error) => { if (current) setMessage(error.message); });
    return () => { current = false; };
  }, [checkout, storageKey]);

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
    const result = await api<{ accountId: string }>(auth, { action: "verify", id: pair, ...signed });
    setAccount(result.accountId);
    setMessage("Wallet connected. Return to the Glimpsea side panel.");
    setDone(true);
  }

  async function pay() {
    if (!quote || !checkout) return;
    let hash = txHash;
    if (!hash) {
      const selector = await walletConnector();
      const { wallet, accounts } = await selector.getConnectedWallet().catch(async () => {
        const connected = await selector.connect();
        return { wallet: connected, accounts: await connected.getAccounts() };
      });
      if (!accounts.some((item) => item.accountId === account)) throw new Error(`Connect ${account} to pay for this order.`);
      const result = await wallet.signAndSendTransaction({
        signerId: account, network: "testnet", receiverId: quote.receiver,
        actions: [{ type: "Transfer", params: { deposit: quote.amount } }],
      });
      hash = result?.transaction?.hash;
      if (!hash) throw new Error("If your wallet sent the transfer, paste its transaction hash below before trying again.");
      sessionStorage.setItem(storageKey, hash);
      setTxHash(hash);
    }
    await api(research, { action: "pay", id: checkout, txHash: hash.trim() });
    setMessage("Testnet payment verified. Return to the side panel to continue research.");
    setDone(true);
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
      <p>{checkout ? "Pay with testnet NEAR to unlock this research order." : "Sign a message to link your trial quota and reports to your NEAR testnet account."}</p>
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
        <button className="run-button w-fit" type="button" onClick={act} disabled={busy}>
          {busy ? "Waiting for wallet or verification…" : checkout ? txHash ? "Verify payment" : "Pay with testnet NEAR" : "Connect wallet"}
        </button>
      )}
      {done && checkout && txHash && <a className="underline" href={`https://testnet.nearblocks.io/txns/${encodeURIComponent(txHash)}`}>View testnet receipt</a>}
      <p role="status">{message}</p>
    </div>
  );
}
