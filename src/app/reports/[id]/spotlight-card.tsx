"use client";

import type { ComponentPropsWithoutRef, PointerEvent } from "react";
import styles from "./research-report.module.css";

// Adapted from React Bits Spotlight Card. See the React Bits license in this directory.
export function SpotlightCard({ children, className, ...props }: ComponentPropsWithoutRef<"article">) {
  function moveSpotlight(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== "mouse" || !matchMedia("(any-hover: hover) and (prefers-reduced-motion: no-preference)").matches) return;
    const card = event.currentTarget;
    const bounds = card.getBoundingClientRect();
    card.style.setProperty("--spotlight-x", `${event.clientX - bounds.left}px`);
    card.style.setProperty("--spotlight-y", `${event.clientY - bounds.top}px`);
    card.dataset.spotlight = "active";
  }

  function clearSpotlight(event: PointerEvent<HTMLElement>) {
    delete event.currentTarget.dataset.spotlight;
  }

  return (
    <article {...props} className={`${styles.spotlight} ${className ?? ""}`}
      onPointerMove={moveSpotlight} onPointerLeave={clearSpotlight} onPointerCancel={clearSpotlight}>
      <span className={styles.spotlightLight} aria-hidden="true" />
      {children}
    </article>
  );
}
