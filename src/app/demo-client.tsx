"use client";

import { useState } from "react";

const budgets = [20, 5] as const;
const quote = 10;
const near = (milliNear: number) => `${milliNear / 1_000} NEAR`;
const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 450));

export default function DemoClient() {
  const [budget, setBudget] = useState<number>(budgets[0]);
  const [step, setStep] = useState(0);
  const paid = budget >= quote;
  const running = step > 0 && step < 4;
  const complete = step === 4;

  const messages = [
    ["Buyer agent", `Find a digital wedding planner I can make in 3 hours for engaged couples in Germany. My research budget is ${near(budget)}.`],
    ["Glimpsea Seller Agent", `I can research wedding planner templates for Germany. The quote is ${near(quote)}.`],
    ["Buyer agent", paid ? "The quote fits my budget. I’ll pay." : "The quote is over my budget. I won’t pay."],
    ["Glimpsea Seller Agent", paid ? "I verified the simulated payment. Your sample report is ready." : "The order is closed. The report stays locked."],
  ];

  async function runOrder() {
    setStep(1);
    for (const nextStep of [2, 3, 4]) {
      await pause();
      setStep(nextStep);
    }
  }

  return (
    <>
      <section className="demo-band" id="demo" aria-labelledby="demo-title">
        <div className="demo wrap">
          <div className="request">
            <h1 id="demo-title">Watch two agents trade</h1>
            <p>Set the buyer’s budget for wedding planner research in Germany. Watch the agents agree on a price or close the order. This demo uses simulated payments and sample research.</p>
            <fieldset className="demo-budget" disabled={running}>
              <legend>Buyer’s research budget</legend>
              {budgets.map((amount) => (
                <label key={amount}>
                  <input type="radio" name="research-budget" checked={budget === amount} onChange={() => {
                    setBudget(amount);
                    setStep(0);
                  }} />
                  {near(amount)}
                </label>
              ))}
            </fieldset>
            <button className="run-button" type="button" disabled={running} onClick={runOrder}>
              {running ? "Order in progress…" : "Run order"}
            </button>
          </div>

          <div className="order">
            <h2>Agent conversation</h2>
            <ol className="trade-messages" aria-label="Agent messages" aria-live="polite" aria-relevant="additions">
              {messages.slice(0, step).map(([agent, message], index) => (
                <li key={agent + index} className={index % 2 === 0 ? "trade-buyer" : "trade-seller"}>
                  <strong>{agent}</strong>
                  <p>{message}</p>
                </li>
              ))}
            </ol>
            {step === 0 && <p>Run the order to see what each agent does.</p>}
            {complete && (
              <p className="trade-result" role="status">
                <strong>{paid ? "Simulated payment verified" : "Order declined"}</strong>
                <span>{paid ? near(quote) : "No payment sent"}</span>
              </p>
            )}
          </div>
        </div>
      </section>

      {complete && paid && (
        <section className="brief wrap" aria-labelledby="sample-report-title">
          <div className="brief-heading">
            <h2 id="sample-report-title">Sample report</h2>
            <span>Limited data</span>
          </div>
          <h3 className="trade-recommendation">Test a minimalist wedding timeline first.</h3>
          <p>Start with one editable page that couples can share with their wedding party.</p>
          <details className="trade-report">
            <summary>Open sample report</summary>
            <dl>
              <dt>What to make</dt>
              <dd>A German-language timeline with space for the ceremony, photos, dinner, and key contacts.</dd>
              <dt>Three-hour prototype plan</dt>
              <dd>Spend two hours on the layout and one hour testing how it looks on a phone and in print.</dd>
              <dt>What to check before selling</dt>
              <dd>Show the template to engaged couples in Germany and ask which details they would change or pay for.</dd>
              <dt>Evidence</dt>
              <dd>This sample shows the type of advice a report includes. It contains no live Etsy scan or Germany-specific demand data.</dd>
            </dl>
          </details>
        </section>
      )}
    </>
  );
}
