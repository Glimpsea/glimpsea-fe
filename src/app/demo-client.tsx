"use client";

import { useState } from "react";
import { domAnimation, LazyMotion, m, MotionConfig } from "framer-motion";
import { BriefCopy } from "./brief-copy";
import { CATEGORY_LABELS, PRODUCT_CATEGORIES, type ProductCategory } from "@/lib/a2a";

const steps = ["Get a quote", "Authorize demo payment", "Prepare the brief", "Receive the brief"];
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export default function DemoClient() {
  const [category, setCategory] = useState<ProductCategory>();
  const [progress, setProgress] = useState(0);
  const [artifact, setArtifact] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setRunning(true);
    setProgress(1);
    setArtifact("");
    setError("");

    try {
      const response = await fetch("/api/buyer-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
        signal: AbortSignal.timeout(15_000),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || typeof result?.markdown !== "string" || !result.markdown.trim()) {
        throw new Error("The sample brief is unavailable. Try again.");
      }
      setProgress(2);
      await delay(350);
      setProgress(3);
      await delay(550);
      setArtifact(result.markdown);
      setProgress(4);
    } catch (cause) {
      setError(cause instanceof Error && cause.name === "TimeoutError"
        ? "The sample brief took too long to load. Try again."
        : "The sample brief is unavailable. Try again.");
    } finally {
      setRunning(false);
    }
  }

  const jsonBlock = artifact.match(/^```json[^\S\n]*\n([\s\S]*?)\n```[^\S\n]*$/m);
  const markdown = jsonBlock ? artifact.replace(jsonBlock[0], "").trim() : artifact.trim();
  const state = error ? "Stopped" : running ? "In progress" : artifact ? "Complete" : "Ready";

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation}>
        <section className="demo-band" id="demo" aria-labelledby="demo-title">
          <div className="demo wrap">
            <div className="request">
              <h1 id="demo-title">Buyer agent demo</h1>
              <p>Follow a sample order for US cafe owners with four hours to make a prototype. The quote and payment are simulated.</p>
              <div className="landing-tabs demo-options" role="group" aria-label="Product category">
                <button type="button" aria-pressed={!category} disabled={running} onClick={() => setCategory(undefined)}>Compare all</button>
                {PRODUCT_CATEGORIES.map((value) => (
                  <button key={value} type="button" aria-pressed={category === value} disabled={running}
                    onClick={() => setCategory(value)}>{CATEGORY_LABELS[value]}</button>
                ))}
              </div>
              <button className="run-button" type="button" disabled={running} onClick={start}>
                {running ? "Preparing sample brief…" : artifact || error ? "Run the simulation again" : "Run the simulation"}
              </button>
            </div>

            <div className="order">
              <div className="section-heading">
                <h2>Order progress</h2>
                <span className="state">{state}</span>
              </div>
              <progress className="demo-progress" max={4} value={progress} aria-label="Simulation progress" />
              <ol className="order-steps" aria-label="Order steps">
                {steps.map((label, index) => (
                  <li key={label} data-reached={progress > index}><span className="step-name">{label}</span></li>
                ))}
              </ol>
              <p className="visually-hidden" role="status">{running ? steps[progress - 1] : state}</p>
              {artifact && <div className="receipt"><span>Simulated payment settled</span><strong>2.50 USDC</strong></div>}
            </div>
          </div>
        </section>

        <section className="brief wrap" id="brief" aria-labelledby="brief-title">
          <div className="brief-heading">
            <h2 id="brief-title">Research brief</h2>
            {artifact && <span>Sample research data</span>}
          </div>
          {error ? <p className="brief-status" role="alert">{error}</p> : artifact ? (
            <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .25 }}>
              <BriefCopy markdown={markdown} />
              {jsonBlock && (
                <details className="json-details">
                  <summary>View brief JSON</summary>
                  <pre><code>{jsonBlock[1]}</code></pre>
                </details>
              )}
            </m.div>
          ) : (
            <p className="brief-status">
              {running ? "Preparing your sample brief." : "Run the simulation to see the sample brief."}
            </p>
          )}
        </section>
      </LazyMotion>
    </MotionConfig>
  );
}
