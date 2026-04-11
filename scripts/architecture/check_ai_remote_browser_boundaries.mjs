import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const files = [
  'frontend/remote/chatllm/pages/index.tsx',
  'frontend/remote/jira/pages/index.tsx',
];

const disallowedPatterns = [
  {
    name: 'client-side DOCKER_HOST_IP usage',
    regex: /process\.env\.DOCKER_HOST_IP/,
  },
  {
    name: 'browser-direct Ollama tags endpoint',
    regex: /\/api\/tags\b/,
  },
  {
    name: 'hard-coded localhost Ollama endpoint',
    regex: /localhost:11434/,
  },
  {
    name: 'hard-coded localhost chat endpoint',
    regex: /localhost:5333\/api\/chat/,
  },
];

const violations = [];

for (const relativePath of files) {
  const fullPath = path.join(repoRoot, relativePath);
  const contents = fs.readFileSync(fullPath, 'utf8');

  for (const pattern of disallowedPatterns) {
    if (pattern.regex.test(contents)) {
      violations.push(`${relativePath}: ${pattern.name}`);
    }
  }
}

if (violations.length > 0) {
  console.error('AI remotes must use remote-owned API boundaries instead of browser-local AI endpoints.');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('AI remote browser boundary check passed.');
