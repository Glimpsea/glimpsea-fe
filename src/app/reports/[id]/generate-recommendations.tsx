"use client";

import { useState } from "react";

export function GenerateRecommendations({ reportId }: { reportId: string }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    setStatus("Preparing product ideas from your saved scan…");
    try {
      const response = await fetch(`/reports/${reportId}/recommendations`, { method: "POST" });
      if (response.status === 503) throw new Error("Product ideas are unavailable right now. Try again in a moment.");
      if (!response.ok) throw new Error("Open this report from Glimpsea and try again.");
      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not prepare ideas. Try again.");
      setBusy(false);
    }
  }

  return (
    <>
      <p>Use your saved listings to get ideas for this search.</p>
      <button className="run-button" type="button" disabled={busy} onClick={generate}>Generate product ideas</button>
      <p role="status">{status}</p>
    </>
  );
}
