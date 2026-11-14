"use client";

import { useEffect, useRef, useState } from "react";
import { SpotlightCard } from "./spotlight-card";
import styles from "./research-report.module.css";

import type { Recommendation } from "@/lib/etsy-recommendations";

type Disposition = "saved" | "hidden";
type Choices = Partial<Record<string, Disposition>>;

const all = "All categories";
const saved = "Saved to test";
const hidden = "Hidden";

export function RecommendationBoard({ cards, reportId }: { cards: Recommendation[]; reportId: string }) {
  const storageKey = `glimpsea-research-choice:${reportId}:`;
  const [filter, setFilter] = useState(all);
  const [choices, setChoices] = useState<Choices>({});
  const [message, setMessage] = useState("");
  const activeFilter = useRef<HTMLButtonElement>(null);
  const categories = [...new Set(cards.map(({ categoryLabel }) => categoryLabel))];
  const [first, second] = cards;
  const tied = second && first.score === second.score && first.hours === second.hours && first.setupUsd === second.setupUsd && first.searchRatio === second.searchRatio;

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
  }, [cards, storageKey]);

  function updateChoice(id: string, value: Disposition | undefined, feedback: string) {
    if (value === "hidden" || filter === saved || filter === hidden) activeFilter.current?.focus();
    setChoices((current) => ({ ...current, [id]: value }));
    try {
      if (value) localStorage.setItem(storageKey + id, value);
      else localStorage.removeItem(storageKey + id);
      setMessage(feedback);
    } catch {
      setMessage(`${feedback} This change lasts until you close the page.`);
    }
  }

  const visibleCards = cards.filter(({ id, categoryLabel }) => {
    if (filter === saved) return choices[id] === "saved";
    if (filter === hidden) return choices[id] === "hidden";
    return choices[id] !== "hidden" && (filter === all || categoryLabel === filter);
  });

  return (
    <>
      <div className={styles.boardHeader}>
        <div className={styles.filters} role="group" aria-label="Filter product ideas">
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
          <SpotlightCard key={card.id} className={styles.card} data-priority={card.id === first.id && !tied}>
            <div className={styles.cardLabels}>
              <span className={styles.decision}>{card.id === first.id && !tied ? "Test first" : "Test option"} · {card.score}/100 fit</span>
              <span className={styles.dataStatus}>{card.confidence}</span>
            </div>
            <div>
              <h3>{card.name}</h3>
              <p className={styles.category}>{card.categoryLabel} · {card.hours} {card.hours === 1 ? "hour" : "hours"} to mock up</p>
              <p>{card.product}</p>
              <p className={styles.category}>{card.whyThisSearch}</p>
            </div>

            <dl className={styles.signals}>
              <div><dt>Search interest</dt><dd>{card.searchRatio != null ? `About ${card.searchRatio} searches per 1,000 results.` : "Check this keyword in Etsy Marketplace Insights."}</dd></div>
              <div><dt>Similar products</dt><dd>{card.groupLabel ? `The scan includes ${card.groupLabel.toLowerCase()}.` : "The scan found no clear format to compare."}</dd></div>
            </dl>

            <div className={styles.cardEnd}>
              <p className={styles.nextStep}><strong>First step</strong> {card.nextStep}</p>
              {filter === saved && (
                <ul className={styles.checklist}>
                  <li>Check the keyword and tags.</li>
                  <li>Make one mockup.</li>
                  <li>Compare prices for similar products.</li>
                </ul>
              )}
              <a className={styles.button} href={`#niche-${card.id}`} aria-label={`See why: ${card.name}`} onClick={() => {
                const detail = document.getElementById(`niche-${card.id}`);
                if (detail instanceof HTMLDetailsElement) detail.open = true;
              }}>
                See why <span aria-hidden="true">↓</span>
              </a>
              <div className={styles.cardActions}>
                {choices[card.id] === "hidden" ? (
                  <button type="button" onClick={() => updateChoice(card.id, undefined, `${card.name} is visible again.`)}>Show again</button>
                ) : (
                  <>
                    <button type="button" onClick={() => {
                      if (choices[card.id] === "saved") {
                        updateChoice(card.id, undefined, `${card.name} was removed from your test list.`);
                      } else {
                        updateChoice(card.id, "saved", `${card.name} was saved to your test list.`);
                      }
                    }}>
                      {choices[card.id] === "saved" ? "Remove from test list" : "Save to test list"}
                    </button>
                    <button type="button" onClick={() => updateChoice(card.id, "hidden", `${card.name} was hidden.`)}>Hide</button>
                  </>
                )}
              </div>
            </div>
          </SpotlightCard>
        ))}
      </div>
      {visibleCards.length === 0 && (
        <p className={styles.empty}>
          {filter === saved ? "Your test list is empty." : filter === hidden ? "Belum ada niche yang was hidden." : "No ideas in this category."}
        </p>
      )}
      <p className={styles.status} role="status">{message}</p>
    </>
  );
}
