# Glimpsea

Glimpsea sells Etsy wall art research to AI agents that work for sellers. A buyer agent sends an order and receives a brief through A2A. A2A is a protocol that agents use to exchange messages and results.

The demo asks for printable wall art for cafe owners in the US. The seller has four hours to design the art and prepare the print files.

## Run the demo

Install Node.js 22.13 or later and Bun.

1. Run `bun install` in this directory.
2. Copy `.env.example` to `.env.local`.
3. Run `bun run dev`.
4. Open [the local demo](http://127.0.0.1:3000).

Select **Run buyer agent**. You can also run `bun run demo` in a second terminal. The command prints the brief and its JSON block to standard output.

The sample quote is 2.50 USDC. The payment simulator records authorization and settlement without moving funds. The starter configuration returns a labeled sample brief. It does not measure demand or call an AI model.

## Use NEAR AI Cloud for research

Set `GLIMPSEA_RESEARCH_MODE=near-ai-cloud` in `.env.local`. Add your `NEAR_AI_API_KEY` to the same file. Restart the server. Run `bun run demo --require-cloud` to make sure that NEAR AI Cloud produced the brief.

The API uses the sources listed in the brief. A concept and its estimated production time are hypotheses. The brief includes a small test to help the seller assess interest. [NEAR AI Cloud setup](https://docs.near.ai/cloud/quickstart)

Each concept must name a finished piece of wall art, where it hangs, and what the buyer receives. If the brief fails a check, Glimpsea can request one correction within the remaining token and time limits. If no brief passes, Glimpsea releases the simulated payment.

## Connect a buyer agent

Read the agent card at `/.well-known/agent-card.json`. Send JSON-RPC requests to `/a2a/v1`.

1. Call `SendMessage` with a new message UUID. Include the order in one data part.
2. Read the quote from the HTTP 402 response. Check the quote against the buyer's budget.
3. Send the same message with the simulator authorization in `X-PAYMENT`.
4. Poll `GetTask` with the task ID. Read the brief from the completed task's artifact.

Use `src/lib/buyer.ts` as the buyer example. The simulator issues an opaque quote ID. It binds the quote to the message and order, and retries return the same task ID. The task ID grants access to the brief, so keep it private.

SQLite stores the order, task status, brief, model usage, and simulated payment. A failed or rejected task releases the authorization. The demo runs on a local server. Agent Market listing and live USDC settlement are pilot work. [NEAR Agent Market A2A and x402](https://docs.market.near.ai/a2a/hire-agent-using-x402)

## Verify the demo

Run `bun run verify:demo` with the demo server running in fixture mode. The checks cover delivery, a rejected order, a budget limit, and repeated authorizations.

Run `bun scripts/verify-research.ts` to test the wall art filter with sample model responses.

If you start the server in Cloud mode without an API key, run `bun run verify:demo --missing-cloud-key`. This checks that a research failure releases the simulated authorization.
