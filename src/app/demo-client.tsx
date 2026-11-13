"use client";

import { useState } from "react";
import { BriefCopy } from "./brief-copy";
import { runBuyer, sampleOrder, type BuyerEvent } from "@/lib/buyer";

const steps = [
  { key: "quote", label: "Get a quote" },
  { key: "authorized", label: "Authorize demo payment" },
  { key: "working", label: "Prepare the brief" },
  { key: "completed", label: "Receive the brief" },
] as const;

const paymentStates = {
  authorized: "Authorized",
  settled: "Settled",
  released: "Released",
};

const usdcAmount = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });

const market = new Intl.DisplayNames(["en"], { type: "region" }).of(sampleOrder.country);
const audience = sampleOrder.audience.replace(/^US cafe/, "Cafe");

type BuyerTask = Awaited<ReturnType<typeof runBuyer>>;

function briefFromTask(task: BuyerTask) {
  return (task.artifacts ?? []).flatMap((artifact) => artifact.parts)
    .flatMap((part) => part.text ? [part.text] : [])
    .join("\n\n");
}

export default function DemoClient() {
  const [events, setEvents] = useState<BuyerEvent[]>([]);
  const [task, setTask] = useState<BuyerTask>();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setRunning(true);
    setEvents([]);
    setTask(undefined);
    setError("");

    try {
      const result = await runBuyer({
        onEvent: (event) => setEvents((previous) => [...previous, event]),
      });
      setTask(result);

      if (result.status.state !== "TASK_STATE_COMPLETED") {
        const message = result.status.message?.parts.map((part) => part.text).filter(Boolean).join(" ");
        setError(message || "The order ended before Glimpsea delivered a brief. Run the demo again to retry.");
      } else if (!briefFromTask(result)) {
        setError("The order finished without a brief. Run the demo again to retry.");
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The buyer agent could not finish the order.";
      setError(`${message} Run the demo again to retry.`);
    } finally {
      setRunning(false);
    }
  }

  const latest = events.at(-1);
  const artifact = task?.status.state === "TASK_STATE_COMPLETED" ? briefFromTask(task) : "";
  const jsonBlock = artifact.match(/^```json[^\S\n]*\n([\s\S]*?)\n```[^\S\n]*$/m);
  const markdown = jsonBlock ? artifact.replace(jsonBlock[0], "").trim() : artifact.trim();
  const research = task?.metadata.research?.provider;
  const payment = task?.metadata.payment;
  const state = error ? "Stopped" : running ? "In progress" : artifact ? "Complete" : "Ready";

  return (
    <>
      <section className="demo-band" id="demo" aria-labelledby="demo-title">
        <div className="demo wrap">
        <div className="request">
          <h2 id="demo-title">Sample order</h2>
          <dl className="request-details">
            <div><dt>Category</dt><dd>Open to all three</dd></div>
            <div><dt>Buyers</dt><dd>{audience}</dd></div>
            <div><dt>Market</dt><dd>{market}</dd></div>
            <div><dt>Seller work</dt><dd>{sampleOrder.productionHours} hours max</dd></div>
          </dl>
          <button className="run-button" type="button" disabled={running} onClick={start}>
            {running ? "Buyer agent is running" : task || error ? "Run buyer agent again" : "Run buyer agent"}
          </button>
        </div>

        <div className="order">
          <div className="section-heading">
            <h2>Order progress</h2>
            <span className="state">{state}</span>
          </div>
          <ol className="order-steps" aria-label="Order steps">
            {steps.map((step) => {
              const event = events.find((item) => item.step === step.key);
              return (
                <li key={step.key} data-reached={Boolean(event)}>
                  <span className="step-name">{step.label}</span>
                  {event && <p>{event.detail}</p>}
                </li>
              );
            })}
          </ol>
          <p className="visually-hidden" role="status">
            {latest ? latest.detail : running ? "The buyer agent is requesting a quote." : ""}
          </p>
          {payment && (
            <div className="receipt">
              <span>Simulated payment</span>
              <strong>{paymentStates[payment.state]} · {usdcAmount.format(Number(payment.amount) / 1_000_000)} USDC</strong>
            </div>
          )}
        </div>
        </div>
      </section>

      <section className="brief wrap" id="brief" aria-labelledby="brief-title">
        <div className="brief-heading">
          <h2 id="brief-title">Research brief</h2>
          {artifact && research && (
            <span>{research === "near-ai-cloud" ? "Prepared with NEAR AI Cloud" : "Sample research data"}</span>
          )}
        </div>

        {error ? (
          <p className="brief-status" role="alert">{error}</p>
        ) : artifact ? (
          <>
            <BriefCopy markdown={markdown} />
            {jsonBlock && (
              <details className="json-details">
                <summary>View brief JSON</summary>
                <pre><code>{jsonBlock[1]}</code></pre>
              </details>
            )}
          </>
        ) : (
          <p className="brief-status">
            {running ? "The brief appears here after the buyer agent receives it." : "Run the buyer agent to get a brief for this sample order."}
          </p>
        )}
        {task && <p className="task-id">Order ID <code>{task.id}</code></p>}
      </section>
    </>
  );
}
