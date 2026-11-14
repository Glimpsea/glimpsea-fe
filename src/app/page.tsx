import Image from "next/image";
import Link from "next/link";
import { opportunityTopic } from "@/lib/opportunity-brief";
import { HeaderLogo } from "./header-logo";
import { LandingHeroPhoto } from "./landing-hero-photo";
import { LandingInstall } from "./landing-install";
import { LandingMarket, type MarketPoint } from "./landing-market";

const extensionDownload = "https://github.com/Glimpsea/glimpsea-fe/releases/download/v0.1.8/glimpsea-chrome-v0.1.8.zip";
const asCount = (value: string) => parseFloat(value) * (value.endsWith("k") ? 1_000 : 1);
const plotPosition = (value: string, min: number, max: number) => 10 + 77 * (Math.log(asCount(value) / min) / Math.log(max / min));

const points: MarketPoint[] = (["cafe", "micro-wedding"] as const).flatMap((topic) =>
  (opportunityTopic(topic)?.candidates ?? []).flatMap(({ keyword, counts }) => counts && !counts.relatedTo ? [{
    name: keyword, searches: counts.searches, results: counts.results,
    x: plotPosition(counts.results, 2_000, 50_000), y: plotPosition(counts.searches, 2, 4_000),
  }] : []),
);

export default function Home() {
  return (
    <>
      <header className="masthead wrap">
        <HeaderLogo href="#top" />
        <nav aria-label="Page">
          <a href="#extension-demo">How it works</a>
          <a href="#install-extension">Install</a>
          <a href="#for-agents">For agents</a>
        </nav>
      </header>

      <main id="top">
        <div className="hero-frame">
          <LandingHeroPhoto />
          <section className="intro wrap" aria-labelledby="title">
            <h1 id="title">What should <em>you sell on Etsy?</em></h1>
            <p>Tell Glimpsea what you want to make. Compare product ideas using live Etsy listings, then download your private report as a PDF.</p>
            <div className="intro-actions">
              <a className="run-button intro-link" href={extensionDownload}>Download Glimpsea extension</a>
              <a className="intro-link" href="#install-extension">How to install <span aria-hidden="true">↓</span></a>
            </div>
          </section>
        </div>

        <section className="landing-workflow wrap" id="extension-demo" aria-labelledby="extension-title">
          <h2 id="extension-title">From chat to a private research report.</h2>
          <ol className="workflow-images">
            <li>
              <Image src="/landing/maker-mug.webp" alt="A maker holding a ceramic mug with a floral design at a craft table" width={660} height={880}
                sizes="(max-width: 760px) 90vw, 22vw" />
              <h3>Chat with Glimpsea</h3>
              <p>Tell the Seller Agent what you want to make, who it’s for, and how much time you have. It asks for missing details and gives you a quote.</p>
            </li>
            <li className="workflow-screen">
              <Image src="/landing/seller-agent-chat.webp" alt="Glimpsea Seller Agent chat showing a Basic quote for digital wedding planner templates for buyers in Germany" width={888} height={916}
                sizes="(max-width: 760px) 90vw, 45vw" />
              <h3>Review the research scope</h3>
              <p>Allow Etsy access, then use a Basic trial or approve a 0.01 NEAR testnet payment. Glimpsea confirms your trial or verifies payment, then scans up to two live Etsy results pages.</p>
              <span className="workflow-caption">Seller Agent in Glimpsea v0.1.8</span>
            </li>
            <li>
              <Image src="/landing/product-prototypes.webp" alt="A maker comparing an embroidered pouch with a framed botanical print" width={660} height={880}
                sizes="(max-width: 760px) 90vw, 22vw" />
              <h3>Get your private report</h3>
              <p>Glimpsea turns the listings into product ideas and tells you when your private report is ready. See what to test first, check the evidence, and download the PDF. The report shows “Limited data”.</p>
            </li>
          </ol>
          <div className="workflow-recovery">
            <h3>If research fails</h3>
            <p>The Seller Agent tries the scan or report again once on the same order, with no extra charge. If it still fails, Glimpsea tells you in chat and logs the order for the owner to review.</p>
          </div>
          <p className="workflow-proof">In a Seller Agent test for wedding planner templates, Glimpsea read 108 unique Etsy listings across two pages and delivered a PDF. Germany was the target market.</p>
        </section>

        <LandingMarket points={points} />
        <LandingInstall downloadUrl={extensionDownload} />

        <section className="landing-agents wrap" id="for-agents" aria-labelledby="agents-title">
          <h2 id="agents-title">Etsy research for buyer agents.</h2>
          <div>
            <p>Buyer agents can order a research brief from Glimpsea over agent-to-agent messaging (A2A). Send a target market, buyer audience, and time to make a prototype.</p>
            <ol>
              <li>The buyer agent reads the Glimpsea Agent Card to find the order endpoint and request a quote.</li>
              <li>The buyer agent checks its budget and pays by direct transfer in the NEAR testnet demo. Agent orders are paid per report.</li>
              <li>Glimpsea verifies the transfer, builds the brief from curated references, and returns a private report link with a PDF download.</li>
            </ol>
            <div className="agent-links">
              <Link className="run-button" href="/developers">Watch two agents trade</Link>
              <a href="https://github.com/Glimpsea/glimpsea-fe#a2a-demo-with-on-chain-near-testnet-payments">NEAR testnet setup</a>
            </div>
            <p className="workflow-caption">The web simulation uses sample research and simulated payment.</p>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="wrap footer-inner">
          <a className="wordmark" href="#top">Glimpsea</a>
          <a href="#for-agents" id="demo">For agents</a>
        </div>
      </footer>
    </>
  );
}
