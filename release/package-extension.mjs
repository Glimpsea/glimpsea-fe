import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [publicUrl, output, mode] = process.argv.slice(2);
const url = URL.parse(publicUrl ?? "");
if (url?.protocol !== "https:" || url.href !== url.origin + "/" || url.port || !output
    || (mode !== undefined && mode !== "etsy-live")) {
  throw new Error("Usage: node release/package-extension.mjs <https://host> <output.zip> [etsy-live]");
}
const live = mode === "etsy-live";
const source = fileURLToPath(new URL("../extension", import.meta.url));
const temporary = mkdtempSync(resolve(tmpdir(), "glimpsea-extension-"));
const directory = resolve(temporary, "glimpsea");
const destination = resolve(output);

try {
  cpSync(source, directory, { recursive: true });
  const path = resolve(directory, "manifest.json");
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  manifest.name = "Glimpsea Research";
  manifest.description = live
    ? "Read Etsy search results and compare product opportunities in a private report."
    : "Try Glimpsea product research with a sample catalog and private reports.";
  manifest.host_permissions = [url.origin + "/*"];
  manifest.content_scripts[0].matches = [url.origin + "/demo-catalog*"];
  if (!live) {
    manifest.permissions = manifest.permissions.filter((permission) => permission !== "scripting");
    delete manifest.optional_host_permissions;
  }
  writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n");

  writeFileSync(resolve(directory, "config.js"), `const GLIMPSEA_ORIGIN = ${JSON.stringify(url.origin)};\n`);
  const panel = resolve(directory, "panel.html");
  writeFileSync(panel, readFileSync(panel, "utf8").replace(
    '<script defer src="panel.js"></script>',
    '<script defer src="config.js"></script>\n  <script defer src="panel.js"></script>',
  ));

  rmSync(destination, { force: true });
  execFileSync("zip", ["-q", "-r", destination, "glimpsea"], { cwd: temporary });
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
