import { pilotDataStatus, pilotDateLabel, pilotDeadline, pilotTopics } from "@/lib/pilot-opportunities";
import { BriefCopy } from "../../brief-copy";
import { HeaderLogo } from "../../header-logo";
import { PilotBoard } from "./pilot-board";
import { PilotDetail } from "./pilot-detail";
import { PilotTransparency } from "./pilot-transparency";
import styles from "./research-report.module.css";

const cards = pilotTopics.map(({ id, title, category, decision, demand, competition, nextStep }) => ({
  id, title, category, decision, demand, competition, nextStep,
}));

export function EtsyResearchReport({ scan, keyword, pages, limit }: { scan: string; keyword: string; pages: number; limit: number }) {
  return (
    <div lang="id">
      <header className="masthead wrap">
        <HeaderLogo href="/" />
      </header>
      <main className={`wrap ${styles.report}`}>
        <header className={styles.reportHeader}>
          <h1>Hasil riset Etsy</h1>
          <p className={styles.scanScope}>Pencarian <strong lang="en">{keyword}</strong> · {pages} dari maksimal {limit} halaman dibaca</p>
          <a className={styles.textLink} href="#listing-scan">Lihat hasil scan Etsy <span aria-hidden="true">↓</span></a>
        </header>

        <section className={styles.reportSection} aria-labelledby="peluang-pilot">
          <h2 id="peluang-pilot">Peluang dari pilot</h2>
          <p className={styles.muted}>Pengamatan pilot dari Etsy Marketplace Insights · {pilotDateLabel} WITA · jendela 30 hari</p>
          <PilotBoard cards={cards} dataStatus={pilotDataStatus} deadline={pilotDeadline} />
        </section>

        <section className={styles.reportSection} aria-labelledby="detail-niche">
          <h2 id="detail-niche">Detail niche</h2>
          {pilotTopics.map((brief) => <PilotDetail key={brief.id} brief={brief} />)}
        </section>

        <section className={styles.reportSection} aria-labelledby="transparansi">
          <h2 id="transparansi">Transparansi</h2>
          <details className={styles.disclosure}>
            <summary>Listing dan harga dari scan Etsy</summary>
            <div className={styles.detail} id="listing-scan" lang="en">
              <BriefCopy markdown={scan} />
            </div>
          </details>
          <PilotTransparency />
        </section>
      </main>
    </div>
  );
}
