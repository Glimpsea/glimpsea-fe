import Link from "next/link";
import { HeaderLogo } from "../header-logo";
import DemoClient from "../demo-client";

export default function DevelopersPage() {
  return (
    <>
      <header className="masthead wrap">
        <HeaderLogo href="/" />
        <nav aria-label="Page"><Link href="/">Back to Glimpsea</Link></nav>
      </header>
      <main><DemoClient /></main>
      <footer className="footer">
        <div className="wrap footer-inner">
          <a href="https://testnet.nearblocks.io/txns/C9PGq3bSpWruYgwZMrrxzSFa7QbMh8h63Kg1MYV3Qcfe">NEAR testnet checkout receipt</a>
          <a href="https://github.com/Glimpsea/glimpsea-fe#run-the-web-demo">Agent integration guide</a>
        </div>
      </footer>
    </>
  );
}
