"use client";

import Image from "next/image";
import { domAnimation, LazyMotion, m, MotionConfig } from "framer-motion";

export function LandingHeroPhoto() {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation}>
        <m.div className="hero-photo" initial={{ scale: 1.035 }} animate={{ scale: 1 }}
          transition={{ duration: 1.25, ease: "easeOut" }} aria-hidden="true">
          <Image src="/landing/hero.webp" alt="" fill sizes="100vw" fetchPriority="high" loading="eager" unoptimized />
        </m.div>
      </LazyMotion>
    </MotionConfig>
  );
}
