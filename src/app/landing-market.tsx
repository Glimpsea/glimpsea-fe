"use client";

import { useState } from "react";

export type MarketPoint = {
  name: string;
  searches: string;
  results: string;
  x: number;
  y: number;
};

export function LandingMarket({ points }: { points: MarketPoint[] }) {
  const [active, setActive] = useState(0);
  const selected = points[active];

  return (
    <section className="market-band" aria-labelledby="market-heading">
      <div className="market-section wrap">
        <div className="market-explain">
          <h2 id="market-heading">See where an idea fits.</h2>
          <p>Compare searches with competing listings for five example keywords.</p>
          <p className="market-source">Etsy Marketplace Insights · Oct 14 to Nov 12, 2026 · Log scale</p>
        </div>
        <div className="market-figure">
          <div className="market-plot" aria-label="Select a keyword to compare searches and search results">
            <span className="market-axis-y">Searches ↑</span>
            {points.map((point, index) => (
              <button key={point.name} aria-label={point.name} aria-pressed={index === active}
                title={point.name} type="button" style={{ left: `${point.x}%`, bottom: `${point.y}%` }}
                onPointerEnter={() => setActive(index)} onFocus={() => setActive(index)} onClick={() => setActive(index)}>
                {index + 1}
              </button>
            ))}
            <span className="market-axis-x">Search results →</span>
          </div>
          <div className="market-selection" aria-live="polite">
            <strong>{selected.name}</strong>
            <span>{selected.searches} searches · {selected.results} results</span>
          </div>
        </div>
      </div>
    </section>
  );
}
