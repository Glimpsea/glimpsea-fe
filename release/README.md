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

Upload the packaged ZIP as an asset on a public GitHub Release and use its
direct download link on the landing page and in the README. In desktop
Chrome, extract the ZIP, open `chrome://extensions`, turn on **Developer mode**,
then choose **Load unpacked** and select the extracted `glimpsea` folder. Open
**Glimpsea Research** from Chrome’s extension menu. Updates require downloading
and reloading the new package.

The Dalang ingress should expose the following routes on the same HTTPS origin.

- `/api/near-auth` and `/api/extension-demo` handle wallet and research requests. Route `/api/extension-demo/session` to the same backend for private report links.
- `/wallet`, `/reports/<id>`, and `/demo-catalog` serve browser flows.
- `/_next/static/`, `/_next/image`, and `/cafe-art/` serve their assets.

The backend can stay bound to the loopback interface behind Nginx. Keep
`Host` and `X-Forwarded-Proto` in the proxy configuration.

The current download for the Vercel landing page is the [v0.1.4 GitHub Release ZIP](https://github.com/Glimpsea/glimpsea-fe/releases/download/v0.1.4/glimpsea-chrome-v0.1.4.zip).
Use **Download Glimpsea extension** as the button label.
