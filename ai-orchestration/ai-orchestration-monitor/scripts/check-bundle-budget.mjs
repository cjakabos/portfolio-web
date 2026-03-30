import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const distDir = path.resolve(process.cwd(), process.env.VITE_DIST_DIR || "dist");
const assetsDir = path.join(distDir, "assets");
const budgetKb = Number(
  process.env.MONITOR_INITIAL_JS_GZIP_BUDGET_KB
    ?? process.env.BUNDLE_INITIAL_JS_GZIP_BUDGET_KB
    ?? "160",
);

if (!Number.isFinite(budgetKb) || budgetKb <= 0) {
  console.error(
    `Invalid monitor bundle budget=${
      process.env.MONITOR_INITIAL_JS_GZIP_BUDGET_KB
      ?? process.env.BUNDLE_INITIAL_JS_GZIP_BUDGET_KB
      ?? ""
    }`,
  );
  process.exit(1);
}

if (!fs.existsSync(assetsDir)) {
  console.error(`Missing Vite assets directory: ${assetsDir}`);
  process.exit(1);
}

const budgetBytes = Math.round(budgetKb * 1024);
const jsAssets = fs
  .readdirSync(assetsDir)
  .filter((file) => file.endsWith(".js"))
  .sort();

if (jsAssets.length === 0) {
  console.error(`No JavaScript assets found in ${assetsDir}`);
  process.exit(1);
}

let totalGzipBytes = 0;
for (const assetName of jsAssets) {
  const filePath = path.join(assetsDir, assetName);
  const raw = fs.readFileSync(filePath);
  const gzippedBytes = gzipSync(raw, { level: 9 }).length;
  totalGzipBytes += gzippedBytes;
  console.log(`[bundle-budget] assets/${assetName} gzip=${formatKb(gzippedBytes)}KB`);
}

console.log(
  `[bundle-budget] monitor-js-total gzip=${formatKb(totalGzipBytes)}KB budget=${formatKb(budgetBytes)}KB`,
);

if (totalGzipBytes > budgetBytes) {
  console.error("[bundle-budget] FAILED: monitor JS gzip size exceeded budget.");
  process.exit(1);
}

console.log("[bundle-budget] PASSED");

function formatKb(bytes) {
  return (bytes / 1024).toFixed(2);
}
