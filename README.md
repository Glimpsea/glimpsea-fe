# Glimpsea

Glimpsea is a browser extension that helps Etsy sellers decide what to make. It reads live Etsy search results and saves the listings and displayed prices in a private report. Sellers get two Basic trials per browser profile and can use a NEAR testnet wallet to pay for more research. Glimpsea also has an A2A endpoint for agents that exchange orders and briefs.

The demo compares a digital download, a print-on-demand product, and a personalized product for cafe owners in the US. The seller has four hours to prepare a first product. The brief compares the three ideas and picks one to test.

The team's other NEAR HACKATHON project is [AgSurance](https://github.com/AgSurance/agsurance-fe), an independent entry.

## Install the Glimpsea extension

The [Glimpsea landing page](https://glimpsea.vercel.app/#install-extension) has separate install steps for Chrome, Opera GX, and Brave. Its interactive chart uses five directly checked keywords from the saved Etsy Marketplace Insights pilot described below.

1. [Download the Glimpsea v0.1.7 extension ZIP](https://github.com/Glimpsea/glimpsea-fe/releases/download/v0.1.7/glimpsea-chrome-v0.1.7.zip) and extract it.
2. On desktop, open `chrome://extensions` in Chrome, `opera://extensions` in Opera GX, or `brave://extensions` in Brave. Turn on **Developer mode**.
3. Click **Load unpacked** and select the extracted `glimpsea` folder.
4. Open **Glimpsea Research** from your browser’s extensions menu.

Search on Etsy, then open Glimpsea beside the search results. Allow Etsy access if prompted. Use the keyword from your active tab or enter a different one in **Etsy keyword**. Add your target buyers and the hours available to make a first product. Select **Use Basic trial** and **Start analysis**. Glimpsea reads up to two pages. When it finishes, select **Open your report**. To keep your trials and reports, replace the files in your existing installation folder with the files from the new ZIP. Then select **Reload** on the existing Glimpsea entry in your browser’s extensions page. You can still open saved pilot briefs from **Research history**.

## Run the extension locally

Install Chrome, Node.js 22.22.2 or later, and Bun.

1. Clone this repository. Run `bun install` in its root directory.
2. If `.env.local` is missing, copy `.env.example` to `.env.local`.
3. For contract checkout, set `GLIMPSEA_NEAR_CHECKOUT_CONTRACT` to your testnet checkout account and `GLIMPSEA_NEAR_QUOTE_KEY_FILE` to the matching issuer key's PEM file. Legacy checkout also uses `GLIMPSEA_NEAR_TESTNET_RECEIVER`. Use a different funded testnet account to pay.
4. Start the local extension server on port 3045.

   ```sh
   GLIMPSEA_EXTENSION_NEAR_TESTNET=1 GLIMPSEA_ETSY_LIVE_BASIC=1 GLIMPSEA_RESEARCH_MODE=fixture bun run dev --port 3045
   ```

5. Open `chrome://extensions`. Turn on **Developer mode** and select **Load unpacked**.
6. Select the `extension` folder in the repository. Open **Glimpsea Research Demo** from the Chrome extensions menu.

In the current source, type any keyword in **Etsy keyword** or use the keyword from your Etsy search tab. Enter a **Target buyer**, then choose **Use Basic trial** or **Pay on NEAR testnet**. Glimpsea opens the matching Etsy results when research starts.

## Seller Agent chat on NEAR testnet

Enable `GLIMPSEA_EXTENSION_CHAT=1` and `GLIMPSEA_EXTENSION_NEAR_TESTNET=1`, configure the Basic checkout contract or set a direct-transfer receiver with `GLIMPSEA_NEAR_TESTNET_RECEIVER`, and set `GLIMPSEA_SELLER_GEMINI_API_KEY`. The seller defaults to `gemini-3.1-flash-lite`. Reload the unpacked extension and start a chat, for example: *Research cafe owner supplies for independent US coffee shop owners. I have four hours and a $20 setup budget.*

Review the Basic scope, then use an available trial or approve the payment in your testnet wallet. The panel shows scan and report progress. Open the private report to download its PDF. A failed scan or brief gets one retry on the existing order. A failure after retry appears in the owner queue. Set `GLIMPSEA_EXTENSION_OWNER_ACCOUNT` and use that account's authenticated NEAR session to call `POST /api/extension-demo` with `{"action":"owner-exceptions"}`.

The local chat demo uses the sample catalog. Live Etsy evidence in chat requires `GLIMPSEA_ETSY_LIVE_BASIC=1` and `GLIMPSEA_ETSY_AI_EVIDENCE=1` when Etsy authorization covers collection and AI use.

### Verified chat run · Wedding planner templates for Germany

On November 15, 2026 (WITA), the Seller Agent chat in Opera GX completed Basic order `39b71c0f-f696-4a61-a188-43a42f778cee`. The chat scoped a digital wedding planner template for Germany with three prototype hours and a USD 5 setup budget. Glimpsea verified a final direct payment of `0.010000569058912145 NEAR` from `killerbie.testnet` to the configured seller wallet on NEAR testnet. The hash, signer, receiver, and exact amount matched the checkout record. [Testnet payment receipt](https://testnet.nearblocks.io/txns/71zRgkmqLkY7WG2qu9J6JXx1igG1nHkAfc92s9yun3ik)

The extension saved **108 unique live Etsy listings from two search results pages** for `digital wedding planner template`. Gemini produced the report on the first attempt. The private report exported as a nine-page English PDF with **Limited data**, three digital product ideas, a recommendation to test a **Minimalist Wedding Timeline Tracker Template**, and the saved listing titles, displayed prices, links, and methodology. Germany was the requested audience market. The scan did not record the Etsy **Ship to** setting, so the listing sample does not establish Germany-specific demand. The proposed EUR 5 buyer test was a hypothesis. See the [PRD](docs/prd-etsy-research-agent.md#hasil-uji-chat-seller-agent--wedding-planner-germany) for the test scope.

## Reopen a saved Etsy report

1. Open Glimpsea in the browser profile you used for the search. For a paid report, connect the same NEAR testnet wallet that paid if it is disconnected.
2. Under **Research history**, select the keyword marked **Report ready**.
3. Select **Open your report**. Glimpsea opens the private report with its saved listings and prices. This uses the existing order without a new scan, trial, or payment.

## Product recommendations

The private Etsy report uses the Glimpsea logo and colors from the landing page. With NEAR AI Cloud configured, it opens with one idea to test first. **See the test plan** jumps to the buyer test, price test, and checks to run before publishing. **Compare all 3 ideas** jumps to the idea cards. The first card is open, and the other two expand for more detail. The ease score combines mockup time, setup cost, and available evidence. New Year searches include a suggested schedule.

Before scanning, use **Set product limits** to add a product type, a setup budget in USD, or what you can make. These fields are optional. If an older report has saved listings and no cards, select **Generate product ideas** to use the existing scan.

**What the scan shows** groups the original listings by title signals and gives USD estimates using the dated ECB reference rates. The footer has **Show all listings**, **Download CSV** for the original displayed prices, and **How the score works**.

The report can also use a saved Etsy Marketplace Insights snapshot. The November 14, 2026 snapshot covers October 14 through November 12, 2026. Of the 15 candidate keywords, five were checked directly, six appeared as related terms, and four had missing data. The snapshot covers 30 days. Weekly growth rates, opportunity scores, and production deadlines need more evidence. Opening a pilot brief uses the saved snapshot and does not consume a Basic trial.

### Earlier pilot tests

In Opera GX, a NEAR testnet account used one Basic trial for `dog daycare report card`. Glimpsea read 111 unique listings from two live Etsy pages. Both private reports showed the same seller input, **Independent dog daycare owners in the US**, with a four-hour limit. NEAR AI Cloud returned three ideas. The brief flagged all three keywords as missing from the saved Marketplace Insights snapshot and deferred ranking. Both reports returned HTTP 404 without a session.

In Opera GX, a NEAR testnet account used a Basic trial to search Etsy live for `wedding day timeline template`. Glimpsea read 111 unique listings from two pages. The private brief matched all three keywords to direct figures in the saved Marketplace Insights snapshot. It suggested testing a one-page wedding timeline first. The seller estimated one hour and $0 in setup costs with existing tools. Both the brief and the scan report returned HTTP 404 without a session.

## Testnet wallet and checkout

1. Open the side panel and enter your Etsy keyword, target buyer, and production time.
2. Choose **Use Basic trial** to run a search without a wallet.
3. Select **Pay on NEAR testnet**, then **Connect wallet**. Choose a wallet in the panel and sign the login message. If you already connected your wallet, select **Open checkout**. Some wallets open their own approval window.
4. Review the quote and select **Pay with testnet NEAR**. Approve the 0.01 NEAR contract call in your wallet. The order stays locked until Glimpsea verifies the finalized payment.
5. The side panel starts research after verification. Select **Open your report** when it is ready.

The two Basic trials and their private reports belong to this browser profile. The panel keeps the Glimpsea session for later payments until it expires or you disconnect from Glimpsea. Paid orders and reports belong to the NEAR testnet account that paid.

Basic reads up to two Etsy results pages and costs exactly 0.01 testnet NEAR with contract checkout. NEAR Connect calls `pay()` with a quote for the order. Glimpsea unlocks research once `get_payment` returns the matching payment at finality. **Check payment** can recover a submitted order without a transaction hash. Earlier orders created as direct transfers can still use **Already paid?**.

The checkout test completed two Basic trials, then used a transfer of `0.010000333482111037 NEAR` on testnet to unlock the third job. [Third research payment on NEAR testnet](https://testnet.nearblocks.io/txns/P93USZtc2iAbELrBuKoy1ddjSm9w4jnmARF6PncqehJ)

If NearBlocks asks for a browser check, use the NEAR testnet RPC with hash `P93USZtc2iAbELrBuKoy1ddjSm9w4jnmARF6PncqehJ` and sender `glimpsea-d15aafd4df.testnet`. [NEAR transaction lookup](https://docs.near.org/api/rpc/transactions)

## Run the web demo

Open the [developer demo](https://glimpsea.vercel.app/developers) from **For developers** on the landing page. To run it locally, start `bun run dev` and open [the local developer demo](http://127.0.0.1:3000/developers).

Choose **Compare all** or a product category, then select **Run the simulation**. The web demo retrieves a sample brief and shows a simulated 2.50 USDC quote and payment. It runs without a wallet, database, or NEAR AI Cloud credentials.

To exercise the A2A quote, authorization, and settlement against the local server, run `bun run demo` in a second terminal. The command prints the brief and its JSON block to standard output.

### Run an A2A demo with a natural-language request

Set these values in the gitignored `.env.local` file. The buyer and seller use separate Gemini keys.

```dotenv
GLIMPSEA_A2A_RESEARCH_MODE=gemini
GLIMPSEA_BUYER_GEMINI_API_KEY=
GLIMPSEA_SELLER_GEMINI_API_KEY=
```

Start the seller with `bun run dev`. In a second terminal in the same project, run `bun --env-file=.env.local run demo:agents` and type a request such as:

> Cari ide produk Etsy untuk pemilik kafe di AS. Saya bisa membuat prototipe dalam empat jam, punya modal produksi $20, dan mau bayar maksimal 2,50 USDC untuk risetnya.

Gemini on the buyer side turns the request into an order and asks for missing details. The buyer reads Glimpsea's Agent Card, takes the A2A URL from the card, and submits the order. The buyer caps the fee at the lower of the requested amount and `GLIMPSEA_BUYER_MAX_USDC` (default 2.50). The buyer prints the quote and A2A activity in the terminal. The seller uses its own model call to generate the brief. The model calls and HTTP messages are real. The USDC payment is simulated, and the brief uses curated references.

Set `GLIMPSEA_AGENT_ORIGIN` if the seller listens on a port other than 3000. To demonstrate Gemini on the buyer and NEAR AI Cloud on the seller, set `GLIMPSEA_A2A_RESEARCH_MODE=near-ai-cloud` and configure the seller's `NEAR_AI_API_KEY`, then set `GLIMPSEA_EXPECT_SELLER=near-ai-cloud` for the buyer.

### A2A demo with on-chain NEAR testnet payments

The buyer and seller use separate Gemini keys. For the recorded demo, the buyer gets a quote, checks its NEAR budget, and sends faucet NEAR from the configured buyer to the configured seller. Glimpsea checks the final transfer before preparing the brief. Every agent order is paid. The report keeps the three Glimpsea layers, **Limited data**, and **Download PDF**.

1. Set `GLIMPSEA_A2A_TESTNET_BUYER_ACCOUNT` and `GLIMPSEA_A2A_TESTNET_SELLER_ACCOUNT` to your named or implicit accounts. Fund both on testnet so they exist on-chain, and set `GLIMPSEA_A2A_TESTNET_BUYER_FILE` to the buyer's local JSON credential file. The seller needs no signing key. Set `GLIMPSEA_A2A_NEAR_TESTNET=1` on the server and populate both Gemini keys locally.
2. Start `bun run dev`. For a custom port, set both `GLIMPSEA_AGENT_ORIGIN` and `GLIMPSEA_REPORT_ORIGIN` to the app origin.
3. Run `bun --env-file=.env.local run demo:agents --testnet` for a quote. Use a research budget of at least `0.010001 NEAR testnet` to cover the quote's order-specific fraction, or quote a lower budget to show rejection.
4. Run `bun --env-file=.env.local run demo:agents --testnet --pay-testnet` to place a paid order. Keep the local receipt path printed with the explorer link. If verification or polling stops, use `bun --env-file=.env.local run demo:agents --recover-testnet <receipt-path>` to resume using the same transfer.
5. Open **Open the Glimpsea report**, sign in with the paying testnet wallet, and click **Download PDF**.

The demo uses a direct transfer. If research fails after final payment, keep the receipt for manual resolution. The paid testnet A2A flow uses its own quote and proof fields.

### Optional NEAR Agent Market and x402 integration

The integration below targets NEAR mainnet USDC. Its live paid flow has yet to be verified. The recorded testnet demo uses the flow above.

1. Create a self-hosted draft listing with a per-call price and an SLA in [Agent Market](https://market.near.ai/). State that Glimpsea takes a JSON research brief in the A2A text part. Use `{"country":"US","audience":"US cafe owners","productionHours":4}` as a free draft test order in the marketplace UI.
2. In the worker's local environment, set `GLIMPSEA_MARKET_AGENT_TOKEN` to the listing's agent token and set `GLIMPSEA_SELLER_GEMINI_API_KEY`. Run `bun --env-file=.env.local run market:worker` before starting the test. The worker polls assignments and stores prepared briefs in SQLite before submitting. A retry after a submission error reuses the saved brief. `--once` runs a single polling cycle.
3. Once the listing is live, set `GLIMPSEA_MARKET_AGENT_HANDLE` and the buyer's Gemini key. Run `bun --env-file=.env.local run demo:agents --market` for a free quote. The buyer searches the catalog, reads the listing's Agent Card, and calls its A2A endpoint.
4. To place a paid order, set `GLIMPSEA_MARKET_BUYER_ACCOUNT` and `GLIMPSEA_MARKET_BUYER_KEY` for a dedicated funded NEAR mainnet account. Set `GLIMPSEA_MARKET_USDC_CONTRACT` and `GLIMPSEA_MARKET_TREASURY` from the marketplace's [published x402 recipients](https://market.near.ai/.well-known/x402). Run `bun --env-file=.env.local run demo:agents --market --pay-mainnet` when ready to spend real USDC. The buyer checks the quote against those recipient settings and its spending cap before signing. Check the marketplace ledger for delivery and settlement.

For private x402 reports, run the Next.js app alongside the seller worker (`bun run dev` locally). Set `GLIMPSEA_REPORT_ORIGIN` to the browser-facing app origin and configure the same `GLIMPSEA_MARKET_DB_PATH` for the app and worker. The app needs `GLIMPSEA_MARKET_AGENT_HANDLE` to verify the completed task. After settlement the CLI shows **Open the Glimpsea report**. Sign in on that page with the wallet that funded the order, then select **Download PDF**. Agent orders are paid per order and never use the extension's Basic trials. The marketplace Draft test run is for development. Wallet imports and signing keys stay in local configuration.

Agent Market hosts the public A2A endpoint. The Glimpsea worker submits the brief over the marketplace assignment API. The x402 flow uses USDC on NEAR mainnet, with the seller's share credited through Agent Market. [Listing and test runs](https://docs.market.near.ai/list-your-agent) · [Marketplace settlement](https://market.near.ai/skill/flows/a2a-x402.md)

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

## Test the sample catalog API

Run the local server from this directory:

```sh
GLIMPSEA_EXTENSION_DEMO=1 GLIMPSEA_RESEARCH_MODE=fixture bun run dev --port 3045
```

With the fixture server running on port 3045, run `bun scripts/verify-extension.ts` to check page limits, trial use, and report access.

## Test Basic on Etsy live in Opera GX

Use this pilot only with Etsy's permission for live collection. Start the local server with the pilot enabled and the NEAR checkout flow disabled for this test.

```sh
GLIMPSEA_EXTENSION_NEAR_TESTNET=0 GLIMPSEA_EXTENSION_DEMO=1 GLIMPSEA_ETSY_LIVE_BASIC=1 GLIMPSEA_RESEARCH_MODE=fixture bun run dev --port 3045
```

1. Open `opera://extensions` in Opera GX. Turn on **Developer mode**, select **Load unpacked**, and choose this repository's `extension` folder. If Glimpsea is already installed from that folder, select **Reload**.
2. Open [Etsy search for cafe owner supplies](https://www.etsy.com/search?q=cafe+owner+supplies). From the Opera GX extensions menu, open **Glimpsea Research Demo** beside the search results.
3. Enter or edit **Etsy keyword**, add your target buyer and available hours, then click **Start analysis**. Allow Etsy access when your browser prompts you. Use a Basic trial or select **Simulate payment**.
4. Watch the scan highlight cards and move to page 2. When the panel shows **Report ready**, select **Open your report**. The report shows the title, displayed price when available, and one Etsy URL per listing ID. When NEAR AI Cloud is configured, the report also lists ideas that fit the seller’s time limit.

For the paid pilot, set `GLIMPSEA_EXTENSION_NEAR_TESTNET=1` and configure the checkout contract as shown under **Testnet wallet and checkout**. Keep `GLIMPSEA_ETSY_LIVE_BASIC=1`. Choose **Pay on NEAR testnet**, select **Connect wallet**, and approve the 0.01 testnet NEAR payment. The panel starts research after final verification. If Etsy restricts access, wait until your Etsy tab shows the search results, then select **Resume research** on the same order.

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

- **Contract checkout v0.1.5 in Opera GX.** NEAR Connect used a dedicated test wallet to call `pay()` for exactly **0.01 testnet NEAR**. Before the payment, the order had zero captured pages and requests to read and analyze pages returned HTTP 402. Glimpsea verified the finalized contract payment by order ID without a transaction hash from the wallet. Etsy live returned HTTP 403. We resumed the same order with two simulated Etsy result pages and saved two fixture listings without a second payment. The private report opened for the payer and returned HTTP 404 without a session. [v0.1.5 testnet receipt](https://testnet.nearblocks.io/txns/C9PGq3bSpWruYgwZMrrxzSFa7QbMh8h63Kg1MYV3Qcfe)

- **Hosted extension v0.1.4 in Opera GX.** Downloaded the ZIP from [the live landing page](https://glimpsea.vercel.app/). **Connect wallet** opened NEAR Connect inside the panel. The NEAR CLI wallet signed the login message and Glimpsea verified a finalized transfer of **0.010000420771632847 NEAR testnet** from the designated Glimpsea test account. The order stayed at zero pages until payment verification. The paid scan then read **4 unique listings from 2 sample catalog pages**. The private report opened for the payer and returned HTTP 404 after disconnecting. [v0.1.4 testnet receipt](https://testnet.nearblocks.io/txns/HVqvS1Zf6g5caz4MGwYDPDRRFE5D4gNs29a2XR56TnoJ)
- **Hosted extension v0.1.2.** Downloaded from [the live landing page](https://glimpsea.vercel.app/) and installed in a fresh Chromium profile. Both Basic trials and the trial report worked without a wallet. The wallet picker and checkout stayed in the side panel. The third job stayed at zero pages until the panel verified **0.010000495322186445 NEAR testnet**. After **Resume research**, it read **4 unique listings from 2 pages of Glimpsea’s synthetic sample catalog**. A fresh browser session could not open either report, and disconnecting the wallet revoked access to the paid report. [v0.1.2 testnet receipt](https://testnet.nearblocks.io/txns/9MLaeEJDTe1kMHDCZ3JbQRG5dboVFSB11xvNtr76WjMr)
- **Hosted Chrome beta from Vercel.** Starting at [the live landing page](https://glimpsea.vercel.app/), a fresh NEAR testnet account used both Basic trials. The third order stayed at zero pages until checkout verified a transfer of **0.010000264068962464 NEAR**. After **Resume research**, the beta read **4 unique listings from 2 pages of Glimpsea’s synthetic sample catalog**. [Hosted checkout receipt](https://testnet.nearblocks.io/txns/J8qfg44W2EAVJKYGqff1YbspyLoipMxoNtZrpL7XEnuY)
- **Live Etsy in Opera GX.** A test account paid **0.010000925400199157 NEAR** on testnet to research `cafe owner supplies`. The order recorded zero pages before payment verification. After **Resume research**, Basic saved **115 unique live listings from 2 pages** and stopped before page 3. [Live Etsy checkout receipt](https://testnet.nearblocks.io/txns/ENAZzTg8habtsBmvYbWvWM8KUs8kQF7jEhRUNT8xQiHn)
- **Checkout retest with simulated pages in Chromium.** The revised panel used a new NEAR testnet transfer and verified its transaction hash before scanning. After **Resume research**, Basic saved **3 unique sample listings from 2 simulated Etsy pages**. [Simulated-pages checkout receipt](https://testnet.nearblocks.io/txns/GQyvdPtdMoVTEncaKUKHXSFB4UrrCDS27eN4Wezw97FT)

In the checkout runs, the signed-in wallet owner opened the private report. The same URLs returned HTTP 404 without a wallet session.

## Verify checkout with a test transfer

To run the checkout test, use a fresh database and two disposable accounts with faucet funds. Set `GLIMPSEA_TEST_PAYER_FILE` and `GLIMPSEA_TEST_OTHER_FILE` to local JSON files with `id` and `secret`. The second account must match the configured receiver. Run `bun scripts/verify-testnet-checkout.ts`. The test sends one payment on NEAR testnet.
