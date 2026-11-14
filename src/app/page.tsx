import Image from "next/image";
import Link from "next/link";
import { opportunityTopic } from "@/lib/opportunity-brief";
import { HeaderLogo } from "./header-logo";
import { LandingHeroPhoto } from "./landing-hero-photo";
import { LandingInstall } from "./landing-install";
import { LandingMarket, type MarketPoint } from "./landing-market";

const extensionDownload = "https://github.com/Glimpsea/glimpsea-fe/releases/download/v0.1.6/glimpsea-chrome-v0.1.6.zip";
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
        </nav>
      </header>

      <main id="top">
        <div className="hero-frame">
          <LandingHeroPhoto />
          <section className="intro wrap" aria-labelledby="title">
            <h1 id="title">What should <em>you sell on Etsy?</em></h1>
            <p>Compare product ideas for your Etsy shop. See the listings and prices behind each idea before you spend time making it.</p>
            <div className="intro-actions">
              <a className="run-button intro-link" href={extensionDownload}>Download Glimpsea extension</a>
              <a className="intro-link" href="#install-extension">How to install <span aria-hidden="true">↓</span></a>
            </div>
          </section>
        </div>

        <section className="landing-workflow wrap" id="extension-demo" aria-labelledby="extension-title">
          <h2 id="extension-title">From a search to your next product.</h2>
          <ol className="workflow-images">
            <li>
              <Image src="/landing/maker-mug.webp" alt="A maker holding a ceramic mug with a floral design at a craft table" width={660} height={880}
                sizes="(max-width: 760px) 90vw, 22vw" />
              <h3>Search on Etsy</h3>
              <p>Start with a keyword or a product you could make.</p>
            </li>
            <li className="workflow-screen">
              <Image src="/extension-demo.webp" alt="Glimpsea beside a sample search, showing the listings it read and an Open your report button" width={1280} height={800}
                sizes="(max-width: 760px) 90vw, 45vw" />
              <h3>Read the listings</h3>
              <p>Watch Glimpsea collect titles, prices, and links from up to two pages.</p>
              <span className="workflow-caption">Extension walkthrough with a sample catalog</span>
            </li>
            <li>
              <Image src="/landing/product-prototypes.webp" alt="A maker comparing an embroidered pouch with a framed botanical print" width={660} height={880}
                sizes="(max-width: 760px) 90vw, 22vw" />
              <h3>Choose what to test</h3>
              <p>Use your private report to compare ideas before making a prototype.</p>
            </li>
          </ol>
          <p className="workflow-proof">In a live Etsy test, Glimpsea captured 115 unique listings across two pages.</p>
        </section>

        <LandingMarket points={points} />
        <LandingInstall downloadUrl={extensionDownload} />
      </main>

      <footer className="footer">
        <div className="wrap footer-inner">
          <a className="wordmark" href="#top">Glimpsea</a>
          <Link href="/developers" id="demo">For developers</Link>
        </div>
      </footer>
    </>
  );
}
