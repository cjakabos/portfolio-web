import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const controllerRoot = path.join(
  repoRoot,
  'backend',
  'cloudapp',
  'src',
  'main',
  'java',
  'com',
  'example',
  'demo',
  'controllers'
);

const guardedControllers = [
  'NoteController.java',
  'FileController.java',
  'CartController.java',
  'ItemController.java',
  'OrderController.java',
  'RoomController.java',
  'MessageController.java',
];

const forbiddenPatterns = [
  {
    description: 'direct repository import',
    regex: /import\s+com\.example\.demo\.model\.persistence\.repositories\./,
  },
  {
    description: 'legacy generic service package import',
    regex: /import\s+com\.example\.demo\.model\.service\./,
  },
];

const violations = [];

for (const controller of guardedControllers) {
  const fullPath = path.join(controllerRoot, controller);
  const contents = fs.readFileSync(fullPath, 'utf8');
  for (const pattern of forbiddenPatterns) {
    if (pattern.regex.test(contents)) {
      violations.push(`${path.relative(repoRoot, fullPath)}: ${pattern.description}`);
    }
  }
}

if (violations.length > 0) {
  console.error('CloudApp module controllers must stay behind service boundaries.');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('CloudApp controller boundary check passed.');
