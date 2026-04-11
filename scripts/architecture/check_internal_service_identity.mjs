import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const ignoredDirectories = new Set([
  '.git',
  'node_modules',
  '.next',
  'dist',
  'coverage',
  'target',
]);
const ignoredFiles = new Set([
  path.join('scripts', 'architecture', 'check_internal_service_identity.mjs'),
]);
const forbiddenPatterns = [
  { label: 'INTERNAL_SERVICE_TOKEN', regex: /\bINTERNAL_SERVICE_TOKEN\b/ },
  { label: 'X-Internal-Auth', regex: /X-Internal-Auth/ },
];
const violations = [];

const scan = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scan(fullPath);
      continue;
    }
    const relativePath = path.relative(repoRoot, fullPath);
    if (ignoredFiles.has(relativePath)) {
      continue;
    }
    if (!/\.(java|py|ts|tsx|js|mjs|md|yml|yaml|conf|sh|properties)$/.test(entry.name)) {
      continue;
    }
    const contents = fs.readFileSync(fullPath, 'utf8');
    for (const pattern of forbiddenPatterns) {
      if (pattern.regex.test(contents)) {
        violations.push(`${relativePath}: found legacy token/header '${pattern.label}'`);
      }
    }
  }
};

scan(repoRoot);

if (violations.length > 0) {
  console.error('Legacy internal auth strings are not allowed.');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('Internal service identity check passed.');
