# Glimpsea browser beta

Deploy the Dockerfile from the repository root. The app listens on port 3417.
Set `GLIMPSEA_PUBLIC_ORIGIN` to the HTTPS origin served by the VPS. Mount a
persistent directory writable by UID 1000 at `/data` and set
`GLIMPSEA_DB_PATH=/data/glimpsea.sqlite`.

Enable NEAR testnet checkout with `GLIMPSEA_EXTENSION_NEAR_TESTNET=1` and
configure `GLIMPSEA_NEAR_TESTNET_RECEIVER` with a testnet account. For a sample
catalog beta, use `GLIMPSEA_RESEARCH_MODE=fixture` and leave
`GLIMPSEA_ETSY_LIVE_BASIC` off. The downloadable sample build requests access to
its backend only.

Build the downloadable ZIP from a clean release checkout.

```sh
node release/package-extension.mjs https://your-dalang-host glimpsea-chrome-v0.1.4-sample.zip
```

For the Etsy live release, set `GLIMPSEA_ETSY_LIVE_BASIC=1` and include the Etsy permissions in the ZIP.

```sh
node release/package-extension.mjs https://your-dalang-host glimpsea-chrome-v0.1.4.zip etsy-live
```

Host the ZIP over HTTPS and link the download from the landing page. In desktop
Chrome, extract the ZIP, open `chrome://extensions`, turn on **Developer mode**,
then choose **Load unpacked** and select the extracted `glimpsea` folder. Open
**Glimpsea Research** from Chrome’s extension menu. Updates require downloading
and reloading the new package.

The Dalang ingress should expose the following routes on the same HTTPS origin.

- A versioned path such as `/downloads/glimpsea-chrome-v0.1.4.zip` serves the ZIP with an attachment header. Use a new filename for each release to avoid cached copies.
- `/api/near-auth` and `/api/extension-demo` handle wallet and research requests. Route `/api/extension-demo/session` to the same backend for private report links.
- `/wallet`, `/reports/<id>`, and `/demo-catalog` serve browser flows.
- `/_next/static/`, `/_next/image`, and `/cafe-art/` serve their assets.

The backend can stay bound to the loopback interface behind Nginx. Keep
`Host` and `X-Forwarded-Proto` in the proxy configuration.

The current Dalang beta download URL for the Vercel landing page is
`https://10e0ff54-f828-44de-a965-5671328a08d3.svc.dalang.io/downloads/glimpsea-chrome-v0.1.4.zip`.
Use **Download Glimpsea extension** as the button label.
