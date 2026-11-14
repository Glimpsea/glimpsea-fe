import { insightLink } from "@/lib/opportunity-brief";
import { pilotDataStatus, pilotDeadline, pilotPeriodLabel, pilotTopics } from "@/lib/pilot-opportunities";
import styles from "./research-report.module.css";

function formatCount(value: string) {
  return value.replace(".", ",").replace(/k$/, " ribu");
}

export function PilotDetail({ brief }: { brief: (typeof pilotTopics)[number] }) {
  return (
    <details className={styles.disclosure}>
      <summary>{brief.title}</summary>
      <div className={styles.detail} id={`niche-${brief.id}`}>
        <p className={styles.detailMeta}>{brief.decision} · {pilotDataStatus} · Target pembeli AS</p>

        <section className={styles.panel}>
          <h3>Uji berikutnya</h3>
          <p>{brief.test}</p>
          <p>{brief.concept}</p>
          <p className={styles.muted}>Perkiraan awal · {brief.estimate}</p>
        </section>

        <section className={styles.panel}>
          <h3>Minat dan persaingan di Etsy</h3>
          <p className={styles.muted}>Etsy Marketplace Insights · {pilotPeriodLabel}</p>
          <p>{brief.comparison}</p>
          <ul className={styles.evidence}>
            {brief.evidenceIndices.map((index) => {
              const { keyword, counts } = brief.topic.candidates[index];
              if (!counts) return null;
              return (
                <li key={keyword}>
                  <a className={styles.textLink} href={insightLink(counts.relatedTo ?? keyword)} lang="en">{keyword}</a>
                  <p>{formatCount(counts.searches)} pencarian · {formatCount(counts.results)} hasil listing</p>
                  {counts.conversion && <p>Label konversi Etsy <span lang="en">{counts.conversion}</span></p>}
                  {counts.medianPurchasePrice && <p>Rentang harga pembelian median {counts.medianPurchasePrice.replaceAll(".", ",").replace(" to ", "–")}</p>}
                  {counts.relatedTo && <p>Istilah terkait dari <span lang="en">{counts.relatedTo}</span></p>}
                </li>
              );
            })}
          </ul>
          <p>{brief.gap} Posisi jumlah listing terhadap kategori belum dapat dihitung.</p>
          <ul className={styles.references}>
            {brief.topic.references.map(({ url }, index) => (
              <li key={url}><a className={styles.textLink} href={url}>{brief.referenceLabels[index]} <span aria-hidden="true">↗</span></a></li>
            ))}
          </ul>
        </section>

        <section className={styles.panel}>
          <h3>Tren dan waktu produksi</h3>
          <p>{pilotDeadline} Grafik 12 minggu, ramalan, dan kalender musiman menunggu riwayat yang cukup.</p>
        </section>

        <section className={styles.panel}>
          <h3>Keyword, tag, dan ide pembeda</h3>
          <dl className={styles.detailFacts}>
            <div><dt>Keyword untuk dicek</dt><dd lang="en">{brief.keywords.join(" · ")}</dd></div>
            <div><dt>Contoh tag untuk diuji</dt><dd lang="en">{brief.tags.join(" · ")}</dd></div>
            <div><dt>Hipotesis pembeda</dt><dd>{brief.differentiation}</dd></div>
            <div><dt>Risiko produk</dt><dd>{brief.risk}</dd></div>
            <div><dt>Lisensi dan merek</dt><dd>Periksa hak pakai font dan aset, serta penggunaan merek pihak ketiga di judul atau tag sebelum menerbitkan listing.</dd></div>
          </dl>
        </section>
      </div>
    </details>
  );
}
