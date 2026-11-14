// React Bits Spotlight Card adapted for the extension's native form.
// https://reactbits.dev/components/spotlight-card
const spotlightCard = document.querySelector(".spotlight-card");
const spotlightMotion = matchMedia("(any-hover: hover) and (prefers-reduced-motion: no-preference)");

spotlightCard.addEventListener("pointermove", (event) => {
  if (event.pointerType !== "mouse" || !spotlightMotion.matches) return;
  const { left, top } = spotlightCard.getBoundingClientRect();
  spotlightCard.style.setProperty("--spotlight-x", `${event.clientX - left}px`);
  spotlightCard.style.setProperty("--spotlight-y", `${event.clientY - top}px`);
  spotlightCard.dataset.spotlight = "active";
});

function clearSpotlight() {
  delete spotlightCard.dataset.spotlight;
}

spotlightCard.addEventListener("pointerleave", clearSpotlight);
spotlightCard.addEventListener("pointercancel", clearSpotlight);
spotlightMotion.addEventListener("change", clearSpotlight);
