import { insightLink, opportunitySnapshot, opportunitySnapshotDate } from "@/lib/opportunity-brief";
import { pilotDateLabel, pilotPeriodLabel, pilotTopics } from "@/lib/pilot-opportunities";
import styles from "./research-report.module.css";

const { observedOn, start, end } = opportunitySnapshot;
const rows = [
  ["topic", "candidate", "keyword", "searches", "search_results", "conversion_label", "median_purchase_price",
    "source_type", "related_to", "source_url", "observed_on_wita", "period_start", "period_end", "geographic_coverage"],
  ...pilotTopics.flatMap(({ id, topic }) => topic.candidates.map(({ name, keyword, counts }) => [
    id, name, keyword, counts?.searches ?? "", counts?.results ?? "", counts?.conversion ?? "",
    counts?.medianPurchasePrice ?? "", counts?.relatedTo ? "related" : counts ? "direct" : "unavailable",
    counts?.relatedTo ?? "", counts ? insightLink(counts.relatedTo ?? keyword) : "",
    observedOn, start, end, "unverified",
  ])),
];
const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n");
const csvUrl = `data:text/csv;charset=utf-8,${encodeURIComponent(`\uFEFF${csv}\r\n`)}`;

export function PilotTransparency() {
  return (
    <details className={styles.disclosure}>
      <summary>Data dan metode pilot</summary>
      <div className={styles.detail}>
        <section className={styles.panel} aria-labelledby="metode">
          <h3 id="metode">Cara membaca hasil</h3>
          <dl className={styles.detailFacts}>
            <div><dt>Sumber dan periode</dt><dd>Etsy Marketplace Insights, {pilotPeriodLabel}. Lima keyword diperiksa langsung, enam muncul sebagai istilah terkait, dan empat belum punya data.</dd></div>
            <div><dt>Prioritas uji</dt><dd>Pilot menilai kecocokan keyword dengan ide produk, bukti pembanding, dan perkiraan usaha untuk mockup. Skor angka menunggu data pembanding yang memadai.</dd></div>
            <div><dt>Keterbatasan</dt><dd>Cakupan geografis metrik belum terverifikasi. AS adalah target pembeli. Jumlah hasil dipakai sebagai gambaran penawaran per keyword. Nilai mengikuti pembulatan Etsy dan keyword yang tumpang tindih dicatat terpisah.</dd></div>
          </dl>
          <a className={styles.textLink} href="https://help.etsy.com/hc/en-us/articles/35122361353239-How-Do-I-Use-Etsy-s-Marketplace-Insights-Tool">Panduan Marketplace Insights <span aria-hidden="true">↗</span></a>
        </section>

        <section className={styles.panel} aria-labelledby="data">
          <div className={styles.sectionHeader}>
            <h3 id="data">Data pengamatan</h3>
            <a className={styles.button} href={csvUrl} download={`glimpsea-pilot-${observedOn}.csv`}>Unduh CSV</a>
          </div>
          {pilotTopics.map(({ id, category, topic }) => (
            <div key={id} className={styles.candidateGroup}>
              <h4>{category}</h4>
              <ul className={styles.candidates}>
                {topic.candidates.map(({ keyword, counts }) => (
                  <li key={keyword}>
                    <div>
                      {counts ? (
                        <a className={styles.textLink} href={insightLink(counts.relatedTo ?? keyword)} lang="en">{keyword}</a>
                      ) : <span lang="en">{keyword}</span>}
                      <p className={styles.muted}>{counts?.relatedTo ? <>Terkait <span lang="en">{counts.relatedTo}</span></> : counts ? "Pencarian langsung" : "Belum ada data"}</p>
                    </div>
                    {counts && (
                      <div>
                        <p>{counts.searches} pencarian · {counts.results} hasil</p>
                        {counts.conversion && <p className={styles.muted}>Konversi Etsy <span lang="en">{counts.conversion}</span></p>}
                        {counts.medianPurchasePrice && <p className={styles.muted}>Harga pembelian median {counts.medianPurchasePrice}</p>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className={styles.panel} aria-labelledby="riwayat">
          <h3 id="riwayat">Riwayat rekomendasi</h3>
          <p><time dateTime={opportunitySnapshotDate}>{pilotDateLabel} WITA</time> · Pengamatan pertama</p>
          <ul className={styles.references}>
            {pilotTopics.map(({ id, title, decision }) => (
              <li key={id}>{title} · {decision}</li>
            ))}
          </ul>
        </section>
      </div>
    </details>
  );
}
