"use client";

import { useEffect, useRef, useState } from "react";
import { SpotlightCard } from "./spotlight-card";
import styles from "./research-report.module.css";

type Card = {
  id: string;
  title: string;
  category: string;
  decision: string;
  demand: string;
  competition: string;
  nextStep: string;
};

type Disposition = "saved" | "hidden";
type Choices = Partial<Record<string, Disposition>>;

const storageKey = "glimpsea-pilot-choice-v1:";
const all = "Semua kategori";
const saved = "Daftar uji";
const hidden = "Disembunyikan";

export function PilotBoard({ cards, dataStatus, deadline }: {
  cards: Card[];
  dataStatus: string;
  deadline: string;
}) {
  const [filter, setFilter] = useState(all);
  const [choices, setChoices] = useState<Choices>({});
  const [message, setMessage] = useState("");
  const activeFilter = useRef<HTMLButtonElement>(null);
  const categories = [...new Set(cards.map(({ category }) => category))];

  useEffect(() => {
    function restore() {
      try {
        const choices: Choices = {};
        for (const { id } of cards) {
          const value = localStorage.getItem(storageKey + id);
          if (value === "saved" || value === "hidden") choices[id] = value;
        }
        setChoices(choices);
      } catch {
        setChoices({});
      }
    }

    restore();
    window.addEventListener("storage", restore);
    return () => window.removeEventListener("storage", restore);
  }, [cards]);

  function updateChoice(id: string, value: Disposition | undefined, feedback: string) {
    if (value === "hidden" || filter === saved || filter === hidden) activeFilter.current?.focus();
    setChoices((current) => ({ ...current, [id]: value }));
    try {
      if (value) localStorage.setItem(storageKey + id, value);
      else localStorage.removeItem(storageKey + id);
      setMessage(feedback);
    } catch {
      setMessage(`${feedback} Perubahan berlaku selama halaman ini terbuka.`);
    }
  }

  const visibleCards = cards.filter(({ id, category }) => {
    if (filter === saved) return choices[id] === "saved";
    if (filter === hidden) return choices[id] === "hidden";
    return choices[id] !== "hidden" && (filter === all || category === filter);
  });

  return (
    <>
      <div className={styles.boardHeader}>
        <div className={styles.filters} role="group" aria-label="Filter peluang">
          {[all, ...categories, saved, hidden].map((name) => (
            <button key={name} ref={filter === name ? activeFilter : null} type="button"
              aria-pressed={filter === name} onClick={() => setFilter(name)}>
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.cards}>
        {visibleCards.map((card) => (
          <SpotlightCard key={card.id} className={styles.card} data-priority={card.id === cards[0].id}>
            <div className={styles.cardLabels}>
              <span className={styles.decision}>{card.decision}</span>
              <span className={styles.dataStatus}>{dataStatus}</span>
            </div>
            <div>
              <h3>{card.title}</h3>
              <p className={styles.category}>{card.category} · Template digital</p>
            </div>

            <dl className={styles.signals}>
              <div><dt>Minat pencarian</dt><dd>{card.demand}</dd></div>
              <div><dt>Persaingan</dt><dd>{card.competition}</dd></div>
              <div><dt>Tenggat produksi</dt><dd>{deadline}</dd></div>
            </dl>

            <div className={styles.cardEnd}>
              <p className={styles.nextStep}><strong>Langkah berikutnya</strong> {card.nextStep}</p>
              {filter === saved && (
                <ul className={styles.checklist}>
                  <li>Cek keyword dan tag.</li>
                  <li>Siapkan mockup dan gambar listing.</li>
                  <li>Bandingkan harga produk sejenis.</li>
                </ul>
              )}
              <a className={styles.button} href={`#niche-${card.id}`} aria-label={`Lihat alasan untuk ${card.title}`}>
                Lihat alasan <span aria-hidden="true">↓</span>
              </a>
              <div className={styles.cardActions}>
                {choices[card.id] === "hidden" ? (
                  <button type="button" onClick={() => updateChoice(card.id, undefined, `${card.title} ditampilkan kembali.`)}>Tampilkan lagi</button>
                ) : (
                  <>
                    <button type="button" onClick={() => {
                      if (choices[card.id] === "saved") {
                        updateChoice(card.id, undefined, `${card.title} dikeluarkan dari daftar uji.`);
                      } else {
                        updateChoice(card.id, "saved", `${card.title} disimpan ke daftar uji.`);
                      }
                    }}>
                      {choices[card.id] === "saved" ? "Keluarkan dari daftar uji" : "Simpan ke daftar uji"}
                    </button>
                    <button type="button" onClick={() => updateChoice(card.id, "hidden", `${card.title} disembunyikan.`)}>Sembunyikan</button>
                  </>
                )}
              </div>
            </div>
          </SpotlightCard>
        ))}
      </div>
      {visibleCards.length === 0 && (
        <p className={styles.empty}>
          {filter === saved ? "Daftar uji masih kosong." : filter === hidden ? "Belum ada niche yang disembunyikan." : "Tidak ada niche yang tampil untuk kategori ini."}
        </p>
      )}
      <p className={styles.status} role="status">{message}</p>
    </>
  );
}
