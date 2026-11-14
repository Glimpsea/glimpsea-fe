import DemoClient from "./demo-client";
import Image from "next/image";
import { HeaderLogo } from "./header-logo";

const extensionDownload = "https://github.com/Glimpsea/glimpsea-fe/releases/download/v0.1.4/glimpsea-chrome-v0.1.4.zip";
const liveReceipt = "https://testnet.nearblocks.io/txns/ENAZzTg8habtsBmvYbWvWM8KUs8kQF7jEhRUNT8xQiHn";
const extensionGuide = "https://github.com/Glimpsea/glimpsea-fe#test-basic-on-etsy-live-in-opera-gx";

export default function Home() {
  return (
    <>
      <header className="masthead wrap">
        <HeaderLogo href="#top" />
        <nav aria-label="Page">
          <a href="#extension-demo">Extension demo</a>
          <a href="#demo">Buyer agent demo</a>
        </nav>
      </header>

      <main id="top">
        <section className="intro wrap" aria-labelledby="title">
          <h1 id="title">What should <em>you sell on Etsy?</em></h1>
          <p>Compare product ideas for your Etsy shop. See the listings and prices behind each idea before you spend time making it.</p>
          <div className="intro-actions">
            <a className="run-button intro-link" href={extensionDownload}>Download Glimpsea extension</a>
            <a className="intro-link" href="#install-extension">How to install <span aria-hidden="true">↓</span></a>
          </div>
        </section>

        <section className="extension-demo wrap" id="extension-demo" aria-labelledby="extension-title">
          <div className="extension-summary">
            <h2 id="extension-title">A Basic search, from Etsy to report</h2>
            <p>Search for any keyword on Etsy and open Glimpsea beside the results. A Basic search reads up to two pages and gives you a private report.</p>
            <p>In our paid run, Glimpsea waited for payment verification, then read 115 unique listings across two pages for <strong>cafe owner supplies</strong>.</p>
            <ul>
              <li><a href={liveReceipt}>View the NEAR testnet receipt</a></li>
              <li><a href={extensionGuide}>Run a Basic search in Opera GX</a></li>
            </ul>
          </div>
          <figure className="extension-preview">
            <Image src="/extension-demo.webp" alt="Glimpsea panel beside search results, showing two pages read and the private report button" width={1280} height={800}
              sizes="(max-width: 760px) 92vw, 58vw" fetchPriority="high" loading="eager" />
            <figcaption>Extension walkthrough using a sample catalog.</figcaption>
          </figure>
        </section>

        <section className="chrome-install wrap" id="install-extension" aria-labelledby="install-title">
          <div>
            <h2 id="install-title">Install the Glimpsea extension</h2>
            <p>Use Chrome, Opera GX, or Brave on desktop. Your first two Basic searches are free. Connect a NEAR testnet wallet when you’re ready to pay.</p>
          </div>
          <ol>
            <li><a href={extensionDownload}>Download the ZIP</a> and extract it.</li>
            <li>Open <code>chrome://extensions</code> in Chrome, <code>opera://extensions</code> in Opera GX, or <code>brave://extensions</code> in Brave. Turn on <strong>Developer mode</strong>.</li>
            <li>Click <strong>Load unpacked</strong> and select the extracted <code>glimpsea</code> folder.</li>
            <li>Open an Etsy search. Choose <strong>Glimpsea Research</strong> from your browser’s extensions menu, then select <strong>Allow Etsy access</strong> when prompted.</li>
          </ol>
        </section>

        <DemoClient />
      </main>

      <footer className="footer">
        <div className="wrap footer-inner">
          <a className="wordmark" href="#top">Glimpsea</a>
          <span>Etsy research extension · NEAR testnet</span>
        </div>
      </footer>
    </>
  );
}
