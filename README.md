# Glimpsea

Glimpsea is a browser extension that helps Etsy sellers decide what to make. Its research demo compares digital downloads, print-on-demand products, and simple personalized items using a synthetic catalog. The authorized Etsy pilot reads live search results in Opera GX. Sellers can sign in with a NEAR testnet wallet, run two Basic trials, and pay for more research. Glimpsea also has an A2A endpoint for agents that exchange orders and briefs.

The demo compares a digital download, a print-on-demand product, and a personalized product for cafe owners in the US. The seller has four hours to prepare a first product. The brief compares the three ideas and picks one to test.

## Install the Chrome extension

Install Chrome, Node.js 22.22.2 or later, and Bun.

1. Clone this repository. Run `bun install` in its root directory.
2. If `.env.local` is missing, copy `.env.example` to `.env.local`.
3. Set `GLIMPSEA_NEAR_TESTNET_RECEIVER` in `.env.local` to a payment receiver on NEAR testnet. Use a different funded testnet account to pay.
4. Start the local extension server on port 3045.

   ```sh
   GLIMPSEA_EXTENSION_NEAR_TESTNET=1 GLIMPSEA_RESEARCH_MODE=fixture bun run dev --port 3045
   ```

5. Open `chrome://extensions`. Turn on **Developer mode** and select **Load unpacked**.
6. Select the `extension` folder in the repository. Open **Glimpsea Research Demo** from the Chrome extensions menu.

## Testnet wallet and checkout

1. In the side panel, select **Connect NEAR testnet wallet**. Choose a wallet and sign the login message in the new tab.
2. Return to the side panel. Keep the sample keyword, US cafe owners, and four-hour limit in fixture mode.
3. Choose **Basic** and **Use one Basic trial**. Start research and open the private report. Run a second Basic trial.
4. With zero trials left, select **Pay on NEAR testnet** and start a third order. Select **Open testnet checkout** and approve the quoted transfer in your wallet.
5. After Glimpsea verifies the transfer, select **Resume research** in the side panel. Open the report when it is ready.

Each NEAR account gets two Basic trials. Signing in again keeps the same quota and report history. Only the signed-in owner can open a private report. The third job stays locked until the server verifies a final transfer from that account for the exact quote.

Basic, Medium, and Deep scan up to 2, 5, and 10 pages. Their testnet prices start at 0.01, 0.03, and 0.06 NEAR. Each quote adds a small unique amount. If your wallet redirects after payment, paste the transaction hash in checkout. The same hash can confirm the same order again.

The checkout test completed two Basic trials, then used a transfer of `0.010000333482111037 NEAR` on testnet to unlock the third job. [Third research payment on NEAR testnet](https://testnet.nearblocks.io/txns/P93USZtc2iAbELrBuKoy1ddjSm9w4jnmARF6PncqehJ)

If NearBlocks asks for a browser check, use the NEAR testnet RPC with hash `P93USZtc2iAbELrBuKoy1ddjSm9w4jnmARF6PncqehJ` and sender `glimpsea-d15aafd4df.testnet`. [NEAR transaction lookup](https://docs.near.org/api/rpc/transactions)

## Run the web demo

Run `bun run dev` in this directory. Open [the local demo](http://127.0.0.1:3000).

Select **Run buyer agent**. You can also run `bun run demo` in a second terminal. The command prints the brief and its JSON block to standard output.

The sample quote is 2.50 USDC. The payment simulator records authorization and settlement without moving funds. The starter configuration returns a labeled sample brief. It does not measure demand or call an AI model.

## Use NEAR AI Cloud for research

Set `GLIMPSEA_RESEARCH_MODE=near-ai-cloud` in `.env.local`. Add your `NEAR_AI_API_KEY` to the same file. Restart the server. Run `bun run demo --require-cloud` to make sure that NEAR AI Cloud produced the brief.

The API uses the sources listed in the brief. A concept and its estimated production time are hypotheses. The brief includes a small test to help the seller assess interest. [NEAR AI Cloud setup](https://docs.near.ai/cloud/quickstart)

Each concept names the product, what the buyer receives, the time estimate, and which costs to check. If a check fails, Glimpsea can request one correction within the remaining token and time limits. If no brief passes, Glimpsea releases the simulated payment.

## Connect a buyer agent

Read the agent card at `/.well-known/agent-card.json`. Send JSON-RPC requests to `/a2a/v1`.

Send `country`, `audience`, and `productionHours` in the order. You can include `sellerNotes` and a setup limit in USD as `budgetUsd`. Omit `category` to compare all three categories. To focus the order, set it to `digital`, `pod`, or `personalized`. These orders return brief schema 2. Legacy wall art orders with `format` still return schema 1.

1. Call `SendMessage` with a new message UUID. Include the order in one data part.
2. Read the quote from the HTTP 402 response. Check the quote against the buyer's budget.
3. Send the same message with the simulator authorization in `X-PAYMENT`.
4. Poll `GetTask` with the task ID. Read the brief from the completed task's artifact.

Use `src/lib/buyer.ts` as the buyer example. The simulator issues an opaque quote ID. It binds the quote to the message and order, and retries return the same task ID. The task ID grants access to the brief, so keep it private.

SQLite stores the order, task status, brief, model usage, and simulated payment. A failed or rejected task releases the authorization. The demo runs on a local server. Agent Market listing and live USDC settlement are pilot work. [NEAR Agent Market A2A and x402](https://docs.market.near.ai/a2a/hire-agent-using-x402)

## Verify the demo

Run `bun run verify:demo` with the demo server running in fixture mode. The checks cover delivery, a rejected order, a budget limit, and repeated authorizations.

Run `bun scripts/verify-research.ts` to test the wall art and cross-category checks with sample model responses.

If you start the server in Cloud mode without an API key, run `bun run verify:demo --missing-cloud-key`. This checks that a research failure releases the simulated authorization.

## Test the extension in simulation mode

Run the local server from this directory:

```sh
GLIMPSEA_EXTENSION_DEMO=1 GLIMPSEA_RESEARCH_MODE=fixture bun run dev --port 3045
```

Load or reload the extension as described above. Open the [local Etsy search simulation](http://127.0.0.1:3045/demo-catalog?keyword=cafe+owner+supplies&page=1), then click the Glimpsea toolbar icon to open the side panel beside it. Choose **Basic** and click **Start analysis**. Glimpsea highlights cards as it reads them, follows **Next page**, and updates the panel with titles, active prices, and links. Basic stops after two pages or when results end. A listing repeated on another page counts once. Open the private report from the panel to see the analysis.

Select **Simulate payment** to try Medium (up to five pages) or Deep (up to ten pages). The simulation uses synthetic listings and runs on localhost.

For NEAR AI Cloud research with the synthetic catalog, use `GLIMPSEA_RESEARCH_MODE=near-ai-cloud` and set `NEAR_AI_API_KEY` in `.env.local`. The simulation assigns two trials to a browser identity.

With the fixture server running on port 3045, run `bun scripts/verify-extension.ts` to check page limits, trial use, and report access.

## Test Basic on Etsy live in Opera GX

Use this pilot only with Etsy's permission for live collection. Start the local server with the pilot enabled and the NEAR checkout flow disabled for this test.

```sh
GLIMPSEA_EXTENSION_NEAR_TESTNET=0 GLIMPSEA_EXTENSION_DEMO=1 GLIMPSEA_ETSY_LIVE_BASIC=1 GLIMPSEA_RESEARCH_MODE=fixture bun run dev --port 3045
```

1. Open `opera://extensions` in Opera GX. Turn on **Developer mode**, select **Load unpacked**, and choose this repository's `extension` folder. If Glimpsea is already installed from that folder, select **Reload**.
2. Open [Etsy search for cafe owner supplies](https://www.etsy.com/search?q=cafe+owner+supplies). From the Opera GX extensions menu, open **Glimpsea Research Demo** beside the search results.
3. Choose **Etsy live search** and **Basic**. Use a Basic trial or select **Simulate payment**, then click **Start analysis**. Allow access to `www.etsy.com` when Opera prompts you.
4. Watch the scan highlight cards and move to page 2. Click **Open private demo report** when the panel shows **Report ready**. The report shows the title, active price when available, and one Etsy URL per listing ID.

The recorded Opera GX run for `cafe owner supplies` read **78 listing cards across two pages** and saved **69 unique listings**. All 69 had a displayed price. Basic stopped at page 2 with a page 3 link still available. Counts and prices can vary between runs. Glimpsea reads the browser DOM without using the Etsy API and assembles this report locally.

## Verify checkout with a test transfer

To run the checkout test, use a fresh database and two disposable accounts with faucet funds. Set `GLIMPSEA_TEST_PAYER_FILE` and `GLIMPSEA_TEST_OTHER_FILE` to local JSON files with `id` and `secret`. The second account must match the configured receiver. Run `bun scripts/verify-testnet-checkout.ts`. The test sends one payment on NEAR testnet.
