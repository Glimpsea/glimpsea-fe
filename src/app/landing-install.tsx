"use client";

import { useState } from "react";

const browsers = {
  "Chrome": "chrome://extensions",
  "Opera GX": "opera://extensions",
  "Brave": "brave://extensions",
};

export function LandingInstall({ downloadUrl }: { downloadUrl: string }) {
  const [browser, setBrowser] = useState<keyof typeof browsers>("Chrome");

  return (
    <section className="landing-install wrap" id="install-extension" aria-labelledby="install-title">
      <div className="install-summary">
        <h2 id="install-title">Get Glimpsea</h2>
        <p className="install-price"><strong>2 free searches</strong><span>Then 0.01 NEAR per Basic search on testnet.</span></p>
        <a className="run-button install-download" href={downloadUrl}>Download the extension</a>
      </div>
      <div className="install-guide">
        <div className="landing-tabs" role="group" aria-label="Choose your desktop browser">
          {(Object.keys(browsers) as (keyof typeof browsers)[]).map((name) => (
            <button type="button" key={name} onClick={() => setBrowser(name)} aria-pressed={name === browser}>{name}</button>
          ))}
        </div>
        <ol>
          <li>Download and extract the ZIP.</li>
          <li>Open <code>{browsers[browser]}</code> and turn on <strong>Developer mode</strong>.</li>
          <li>Choose <strong>Load unpacked</strong> and select the extracted <code>glimpsea</code> folder.</li>
          <li>Open Etsy, then open Glimpsea from your extensions menu.</li>
        </ol>
        <details>
          <summary>What can Glimpsea read?</summary>
          <p>When you allow Etsy access, Glimpsea reads the titles, displayed prices, and links on up to two results pages. Your reports stay private.</p>
        </details>
      </div>
    </section>
  );
}
