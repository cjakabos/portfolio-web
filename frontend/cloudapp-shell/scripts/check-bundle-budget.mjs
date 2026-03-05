import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const nextDir = path.resolve(process.cwd(), process.env.NEXT_DIST_DIR || ".next");
const manifestPath = path.join(nextDir, "build-manifest.json");
const budgetKb = Number(process.env.BUNDLE_INITIAL_JS_GZIP_BUDGET_KB ?? "450");

if (!Number.isFinite(budgetKb) || budgetKb <= 0) {
  console.error(
    `Invalid BUNDLE_INITIAL_JS_GZIP_BUDGET_KB=${process.env.BUNDLE_INITIAL_JS_GZIP_BUDGET_KB ?? ""}`,
  );
  process.exit(1);
}

if (!fs.existsSync(manifestPath)) {
  console.error(`Missing Next.js build manifest: ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const pages = manifest?.pages ?? {};
const budgetBytes = Math.round(budgetKb * 1024);

const preferredPages = ["/_app", "/", "/login", "/_error"];
const initialJsAssets = collectInitialJsAssets(pages, preferredPages);

if (initialJsAssets.length === 0) {
  console.error("No initial JS assets found in .next/build-manifest.json");
  process.exit(1);
}

let totalGzipBytes = 0;
for (const relativeAssetPath of initialJsAssets) {
  const filePath = path.join(nextDir, relativeAssetPath);
  if (!fs.existsSync(filePath)) {
    console.error(`Referenced asset not found: ${relativeAssetPath} -> ${filePath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath);
  const gzippedBytes = gzipSync(raw, { level: 9 }).length;
  totalGzipBytes += gzippedBytes;
  console.log(`[bundle-budget] ${relativeAssetPath} gzip=${formatKb(gzippedBytes)}KB`);
}

console.log(
  `[bundle-budget] initial-js-total gzip=${formatKb(totalGzipBytes)}KB budget=${formatKb(budgetBytes)}KB`,
);

if (totalGzipBytes > budgetBytes) {
  console.error("[bundle-budget] FAILED: initial JS gzip size exceeded budget.");
  process.exit(1);
}

console.log("[bundle-budget] PASSED");

function collectInitialJsAssets(pagesMap, pageOrder) {
  const selectedPages = pageOrder.filter((page) => Array.isArray(pagesMap[page]));
  if (selectedPages.length === 0) {
    const fallbackPage = Object.keys(pagesMap)[0];
    if (!fallbackPage) {
      return [];
    }
    selectedPages.push(fallbackPage);
  }

  const files = new Set();
  for (const page of selectedPages) {
    for (const file of pagesMap[page]) {
      if (typeof file === "string" && file.endsWith(".js")) {
        files.add(file.replace(/^\//, ""));
      }
    }
  }

  return [...files].sort();
}

function formatKb(bytes) {
  return (bytes / 1024).toFixed(2);
}
