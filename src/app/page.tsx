import DemoClient from "./demo-client";
import Image from "next/image";

const gallery = [
  { file: "coffee-botanical", alt: "A framed coffee plant illustration beside a cafe window" },
  { file: "counter-print", alt: "A red botanical print above a cafe counter" },
  { file: "seating-print", alt: "A golden geometric print above a cafe table" },
];

export default function Home() {
  return (
    <>
      <header className="masthead wrap">
        <a className="wordmark" href="#top">Glimpsea</a>
        <nav aria-label="Page">
          <a href="#demo">Sample order</a>
          <a href="#brief">Research brief</a>
        </nav>
      </header>

      <main id="top">
        <section className="intro wrap" aria-labelledby="title">
          <h1 id="title">What should <em>you sell on Etsy?</em></h1>
          <p>Compare digital downloads, print-on-demand, and simple personalized products. Choose one idea to test with buyers.</p>
          <a className="intro-link" href="#demo">Try the buyer agent demo <span aria-hidden="true">↓</span></a>
        </section>

        <figure className="gallery">
          <div className="gallery-strip">
            {gallery.map(({ file, alt }, index) => (
              <div className="gallery-panel" key={file}>
                <Image src={`/cafe-art/${file}.webp`} alt={alt} fill
                  sizes={index === 1 ? "(max-width: 640px) 50vw, 42vw" : "(max-width: 640px) 25vw, 29vw"}
                  fetchPriority={index === 1 ? "high" : "auto"} loading="eager" />
              </div>
            ))}
          </div>
          <figcaption>Illustrative wall art for the sample cafe market</figcaption>
        </figure>

        <DemoClient />
      </main>

      <footer className="footer">
        <div className="wrap footer-inner">
          <a className="wordmark" href="#top">Glimpsea</a>
          <span>Local demo with simulated payments</span>
        </div>
      </footer>
    </>
  );
}
