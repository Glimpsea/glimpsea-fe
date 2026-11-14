export const marketReportsSchema = `
  CREATE TABLE IF NOT EXISTS market_reports (
    id TEXT PRIMARY KEY, assignment_id TEXT UNIQUE NOT NULL, buyer TEXT NOT NULL,
    order_json TEXT NOT NULL, brief_json TEXT NOT NULL, settled_at INTEGER
  );
`;

export const reportIdPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
export const marketBuyerPattern = /^(?!.*\.testnet$)[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

export function reportLine(url: string) {
  return `[Buka laporan Glimpsea](${url})`;
}

export function reportOrigin() {
  const url = new URL(process.env.GLIMPSEA_REPORT_ORIGIN || "http://127.0.0.1:3000");
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))) {
    throw new Error("Set GLIMPSEA_REPORT_ORIGIN to the report app's HTTPS or loopback origin.");
  }
  return url.origin;
}
