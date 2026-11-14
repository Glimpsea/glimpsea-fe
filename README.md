# Glimpsea

Glimpsea is a browser extension that helps Etsy sellers decide what to make. It reads live Etsy search results and saves the listings and displayed prices in a private report. Sellers get two Basic trials per browser profile and can use a NEAR testnet wallet to pay for more research. Glimpsea also has an A2A endpoint for agents that exchange orders and briefs.

The demo compares a digital download, a print-on-demand product, and a personalized product for cafe owners in the US. The seller has four hours to prepare a first product. The brief compares the three ideas and picks one to test.

The team's other NEAR HACKATHON project is [AgSurance](https://github.com/AgSurance/agsurance-fe), an independent entry.

## Install the Glimpsea extension

1. [Download the Glimpsea v0.1.4 extension ZIP](https://10e0ff54-f828-44de-a965-5671328a08d3.svc.dalang.io/downloads/glimpsea-chrome-v0.1.4.zip) and extract it.
2. On desktop, open `chrome://extensions` in Chrome, `opera://extensions` in Opera GX, or `brave://extensions` in Brave. Turn on **Developer mode**.
3. Click **Load unpacked** and select the extracted `glimpsea` folder.
4. Open **Glimpsea Research** from your browser’s extensions menu.

Search on Etsy, then open Glimpsea beside the search results. Select **Etsy live search** and **Allow Etsy access** if prompted. The panel reads the keyword from your active tab. Add your target buyers and the hours available to make a first product. Select **Use one Basic trial** and **Start analysis**. Glimpsea reads up to two pages. When it finishes, select **Open your report**. To update an existing installation, extract the new ZIP over the installation folder and reload Glimpsea from your browser’s extensions page. This keeps your trials and reports in the same browser profile.

## Run the extension locally

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

## Find product opportunities

In the side panel, expand **Find product opportunities**, choose **Cafe operations** or **Small events and micro weddings**, and select **Open private brief**. In wallet mode, you can reopen each brief from your research history.

The pilot compares 15 candidates from the Etsy Marketplace Insights snapshot recorded November 14, 2026. It labels direct lookups, related terms, and missing data. The two briefs show a decision and a small product test. Opening a brief uses the saved snapshot and does not consume a Basic trial.

To research a new topic, enter your target buyers and available hours before starting a Basic **Etsy live search**. After the scan, choose **My own topic** under **Find product opportunities**. Add your skills, setup budget, and an optional topic, then select **Generate private brief**. The scan and brief share the target buyers and hours you entered for the scan. With `NEAR_AI_API_KEY` configured on the server, NEAR AI Cloud uses these inputs and the search keyword to propose three to five ideas. Glimpsea checks their exact keywords against the saved Marketplace Insights snapshot. It flags missing and related-term evidence and links to the Etsy scan for listing and price comparisons. The scan uses the usual trial or checkout.

In Opera GX, a NEAR testnet account used one Basic trial for `dog daycare report card`. Glimpsea read 111 unique listings from two live Etsy pages. Both private reports showed the same seller input, **Independent dog daycare owners in the US**, with a four-hour limit. NEAR AI Cloud returned three ideas. The brief flagged all three keywords as missing from the saved Marketplace Insights snapshot and deferred ranking. Both reports returned HTTP 404 without a session.

If you already have Etsy keywords, enter three to five exact terms in **Etsy keywords to compare**. Glimpsea flags ideas over your time or setup budget and ideas that still need a cost quote. When at least two options in the same category fit and have direct Marketplace Insights figures, Glimpsea can suggest which mockup to try first based on estimated work time and setup cost. Verify that the keyword results match the proposed product before testing it with buyers.

In Opera GX, a NEAR testnet account used a Basic trial to search Etsy live for `wedding day timeline template`. Glimpsea read 111 unique listings from two pages. The private brief matched all three keywords to direct figures in the saved Marketplace Insights snapshot. It suggested testing a one-page wedding timeline first. The seller estimated one hour and $0 in setup costs with existing tools. Both the brief and the scan report returned HTTP 404 without a session.

## Testnet wallet and checkout

1. Open the side panel. Keep the sample keyword, US cafe owners, and four-hour limit in fixture mode.
2. Choose **Basic** and **Use one Basic trial**. Start research and open the private report. Run a second Basic trial.
3. Select **Pay on NEAR testnet**, then **Connect wallet**. Choose a wallet in the panel and sign the login message. If you already connected your wallet, select **Open checkout**. Some wallets open their own approval window.
4. Review the quote and approve the transfer. The order stays locked until Glimpsea verifies the exact finalized transfer.
5. Select **Resume research** in the side panel. Open the report when it is ready.

The two Basic trials and their private reports belong to this browser profile. The panel keeps the Glimpsea session for later payments until it expires or you disconnect from Glimpsea. Paid orders and reports belong to the NEAR testnet account that paid.

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

Load or reload the repository’s `extension` folder as described in [Run the extension locally](#run-the-extension-locally). Open the [local Etsy search simulation](http://127.0.0.1:3045/demo-catalog?keyword=cafe+owner+supplies&page=1), then click the Glimpsea toolbar icon to open the side panel beside it. Choose **Basic** and click **Start analysis**. Glimpsea highlights cards as it reads them, follows **Next page**, and updates the panel with titles, active prices, and links. Basic stops after two pages or when results end. A listing repeated on another page counts once. Open the private report from the panel to see the analysis.

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
3. Choose **Etsy live search**. If prompted, select **Allow Etsy access** so the panel can show the keyword from the active tab. Enter your target buyers and available hours. Etsy live uses Basic with up to two results pages. Use a Basic trial or select **Simulate payment**, then click **Start analysis**.
4. Watch the scan highlight cards and move to page 2. When the panel shows **Report ready**, select **Open your report**. The report shows the title, active price when available, and one Etsy URL per listing ID. For the cafe search, it also groups matching titles, summarizes prices by currency, and compares three product ideas against the seller's time limit.

For the paid pilot, set `GLIMPSEA_EXTENSION_NEAR_TESTNET=1` and configure the testnet receiver as shown under **Testnet wallet and checkout**. Keep `GLIMPSEA_ETSY_LIVE_BASIC=1`. Connect your testnet wallet, select **Pay on NEAR testnet**, and verify the exact quote in checkout. Return to the Etsy search tab and select **Resume research**.

The recorded Opera GX run for `cafe owner supplies` read **78 listing cards across two pages** and saved **69 unique listings**. All 69 had a displayed price. Basic stopped at page 2 with a page 3 link still available. Counts and prices can vary between runs. Glimpsea reads the browser DOM without using the Etsy API and assembles this report locally.

After the pagination fix, three Etsy live Basic runs in Opera GX each reached **Report ready** after one click on **Start analysis** without using **Resume research**. Each private report opened successfully. These runs used simulated payment.

| Keyword | Pages read | Unique listings |
| --- | ---: | ---: |
| `barista apron` | 2 | 109 |
| `digital wedding planner` | 2 | 108 |
| `personalized dog collar` | 2 | 109 |

Of the 69 unique listings, 53 titles matched cafe-related terms. Cafe and menu signs were the largest group the brief identified, with 17 matching titles. Displayed prices ranged from IDR 56,464 to 6,939,163 across product types, with a median of IDR 357,113. These are offers shown in the browser session.

The brief compared three ideas for US cafe owners with a four-hour limit for seller work:

| Idea | Estimated seller work | What to check |
| --- | ---: | --- |
| Editable opening and closing shift checklist | 2.5 hours | Whether the tasks match an actual cafe shift |
| Cafe staff apron with the shop name | 3 hours | Supplier pricing, sample quality, and US delivery |
| Custom storefront print | 3.5 hours | Photo quality and time for revisions |

The brief picked the **shift checklist** for the first test. The sample contains a comparable operations checklist, and the mockup takes the least seller time of the three. A manager can try the editable US Letter mockup on the next shift without waiting for a supplier or providing a storefront photo. Show it to three US cafe owners or managers. Proceed if at least two agree to try it and their feedback identifies a concrete improvement.

### Paid Basic checkout results

- **Hosted extension v0.1.4 in Opera GX.** Downloaded the ZIP from [the live landing page](https://glimpsea.vercel.app/). **Connect wallet** opened NEAR Connect inside the panel. The NEAR CLI wallet signed the login message and Glimpsea verified a finalized transfer of **0.010000420771632847 NEAR testnet** from the designated Glimpsea test account. The order stayed at zero pages until payment verification. The paid scan then read **4 unique listings from 2 sample catalog pages**. The private report opened for the payer and returned HTTP 404 after disconnecting. [v0.1.4 testnet receipt](https://testnet.nearblocks.io/txns/HVqvS1Zf6g5caz4MGwYDPDRRFE5D4gNs29a2XR56TnoJ)
- **Hosted extension v0.1.2.** Downloaded from [the live landing page](https://glimpsea.vercel.app/) and installed in a fresh Chromium profile. Both Basic trials and the trial report worked without a wallet. The wallet picker and checkout stayed in the side panel. The third job stayed at zero pages until the panel verified **0.010000495322186445 NEAR testnet**. After **Resume research**, it read **4 unique listings from 2 pages of Glimpsea’s synthetic sample catalog**. A fresh browser session could not open either report, and disconnecting the wallet revoked access to the paid report. [v0.1.2 testnet receipt](https://testnet.nearblocks.io/txns/9MLaeEJDTe1kMHDCZ3JbQRG5dboVFSB11xvNtr76WjMr)
- **Hosted Chrome beta from Vercel.** Starting at [the live landing page](https://glimpsea.vercel.app/), a fresh NEAR testnet account used both Basic trials. The third order stayed at zero pages until checkout verified a transfer of **0.010000264068962464 NEAR**. After **Resume research**, the beta read **4 unique listings from 2 pages of Glimpsea’s synthetic sample catalog**. [Hosted checkout receipt](https://testnet.nearblocks.io/txns/J8qfg44W2EAVJKYGqff1YbspyLoipMxoNtZrpL7XEnuY)
- **Live Etsy in Opera GX.** A test account paid **0.010000925400199157 NEAR** on testnet to research `cafe owner supplies`. The order recorded zero pages before payment verification. After **Resume research**, Basic saved **115 unique live listings from 2 pages** and stopped before page 3. [Live Etsy checkout receipt](https://testnet.nearblocks.io/txns/ENAZzTg8habtsBmvYbWvWM8KUs8kQF7jEhRUNT8xQiHn)
- **Checkout retest with simulated pages in Chromium.** The revised panel used a new NEAR testnet transfer and verified its transaction hash before scanning. After **Resume research**, Basic saved **3 unique sample listings from 2 simulated Etsy pages**. [Simulated-pages checkout receipt](https://testnet.nearblocks.io/txns/GQyvdPtdMoVTEncaKUKHXSFB4UrrCDS27eN4Wezw97FT)

In every run, the signed-in wallet owner opened the private report. The same URLs returned HTTP 404 without a wallet session.

## Verify checkout with a test transfer

To run the checkout test, use a fresh database and two disposable accounts with faucet funds. Set `GLIMPSEA_TEST_PAYER_FILE` and `GLIMPSEA_TEST_OTHER_FILE` to local JSON files with `id` and `secret`. The second account must match the configured receiver. Run `bun scripts/verify-testnet-checkout.ts`. The test sends one payment on NEAR testnet.
