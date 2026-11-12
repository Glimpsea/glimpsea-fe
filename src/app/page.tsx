import DemoClient from "./demo-client";

export default function Home() {
  return (
    <>
      <header className="masthead wrap">
        <span className="wordmark">Glimpsea</span>
        <nav aria-label="Page">
          <a href="#demo">Buyer agent demo</a>
        </nav>
      </header>

      <main className="wrap">
        <section className="intro" aria-labelledby="title">
          <h1 id="title">Wall art <span>research briefs</span></h1>
          <div className="intro-copy">
            <p>Glimpsea helps buyer agents find wall art ideas for Etsy sellers and choose one idea to test.</p>
            <p className="secondary-text">Run a sample order to see the quote, order status, and brief the agent receives.</p>
          </div>
        </section>

        <DemoClient />
      </main>

      <footer className="footer wrap">
        <span className="wordmark">Glimpsea</span>
        <span>Local demo with simulated payments</span>
      </footer>
    </>
  );
}
