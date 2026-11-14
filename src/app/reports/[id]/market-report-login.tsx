"use client";

import { useState } from "react";
import type { NearConnector } from "@hot-labs/near-connect";

const connectors: Partial<Record<"mainnet" | "testnet", NearConnector>> = {};

async function reportSession<T>(input: object) {
  const response = await fetch("/api/market-report/session", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error("Access denied. Sign in with the NEAR wallet that paid for this report.");
  return response.json() as Promise<T>;
}

export function MarketReportLogin({ id, network }: { id: string; network: "mainnet" | "testnet" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signIn() {
    setBusy(true);
    setError("");
    try {
      const { NearConnector } = await import("@hot-labs/near-connect");
      const connector = connectors[network] ??= new NearConnector({
        network, autoConnect: false, features: { [network]: true, signMessage: true, signInWithoutAddKey: true },
      });
      const wallet = await connector.connect();
      const [selected] = await wallet.getAccounts();
      if (!selected) throw new Error("Select a NEAR account.");
      const challenge = await reportSession<{ nonce: string; message: string; recipient: string }>({ action: "challenge", id });
      const nonce = Uint8Array.from(atob(challenge.nonce.replace(/-/g, "+").replace(/_/g, "/")), (byte) => byte.charCodeAt(0));
      const signed = await wallet.signMessage({
        network, signerId: selected.accountId, message: challenge.message, recipient: challenge.recipient, nonce,
      });
      await reportSession({ action: "verify", id, nonce: challenge.nonce, ...signed });
      window.location.reload();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not connect the wallet.");
      setBusy(false);
    }
  }

  return <>
    <button className="run-button" type="button" onClick={signIn} disabled={busy}>
      {busy ? "Waiting for signature…" : "Sign in with a NEAR wallet"}
    </button>
    {error && <p role="alert">{error}</p>}
  </>;
}
