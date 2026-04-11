import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const hooksDir = path.join(repoRoot, 'frontend', 'cloudapp-shell', 'src', 'hooks');
const violations = [];

const patterns = [
  { name: 'axios import', regex: /from ['"]axios['"]/ },
  { name: 'axios usage', regex: /\baxios\./ },
  { name: 'fetch usage', regex: /\bfetch\s*\(/ },
];

const scanDir = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) {
      continue;
    }
    const contents = fs.readFileSync(fullPath, 'utf8');
    for (const pattern of patterns) {
      if (pattern.regex.test(contents)) {
        violations.push(`${path.relative(repoRoot, fullPath)}: ${pattern.name}`);
      }
    }
  }
};

scanDir(hooksDir);

if (violations.length > 0) {
  console.error('Raw HTTP client usage is not allowed in frontend/cloudapp-shell/src/hooks.');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('Frontend hook HTTP client check passed.');
