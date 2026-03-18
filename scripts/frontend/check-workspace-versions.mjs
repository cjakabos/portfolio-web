import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const WORKSPACE_DIRS = [
  'frontend/cloudapp-shell',
  'ai-orchestration/ai-orchestration-monitor',
  ...fs.readdirSync(path.join(ROOT, 'frontend/remote'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join('frontend/remote', entry.name)),
  ...fs.readdirSync(path.join(ROOT, 'packages'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join('packages', entry.name)),
];

const EXPECTATIONS = [
  {
    name: 'react',
    expected: '19.1.2',
    sections: ['dependencies', 'peerDependencies'],
  },
  {
    name: 'react-dom',
    expected: '19.1.2',
    sections: ['dependencies', 'peerDependencies'],
  },
  {
    name: 'next',
    expected: '15.3.8',
    sections: ['dependencies'],
  },
  {
    name: 'eslint',
    expected: '^9.29.0',
    sections: ['devDependencies'],
  },
  {
    name: 'eslint-config-next',
    expected: '15.3.8',
    sections: ['devDependencies'],
  },
  {
    name: 'typescript',
    expected: '5.9.2',
    sections: ['devDependencies'],
  },
  {
    name: '@types/node',
    expected: '24.3.1',
    sections: ['devDependencies'],
  },
  {
    name: '@types/react',
    expected: '^19.1.8',
    sections: ['devDependencies'],
  },
  {
    name: '@types/react-dom',
    expected: '^19.1.8',
    sections: ['devDependencies'],
  },
];

const INTENTIONAL_SKEWS = [
  'vite, vitest, and typescript-eslint are operator-app specific',
  'cypress remains only in legacy remotes until those surfaces are consolidated',
  'module-federation packages remain shared across the Next-based shell and remotes',
];

const mismatches = [];

for (const workspaceDir of WORKSPACE_DIRS) {
  const packageJsonPath = path.join(ROOT, workspaceDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  for (const expectation of EXPECTATIONS) {
    for (const section of expectation.sections) {
      const actual = pkg[section]?.[expectation.name];
      if (!actual) {
        continue;
      }

      if (actual !== expectation.expected) {
        mismatches.push({
          workspaceDir,
          packageName: pkg.name,
          section,
          dependency: expectation.name,
          actual,
          expected: expectation.expected,
        });
      }
    }
  }
}

if (mismatches.length > 0) {
  console.error('Frontend workspace dependency drift detected:');
  for (const mismatch of mismatches) {
    console.error(
      `- ${mismatch.workspaceDir} (${mismatch.packageName}) ${mismatch.section}.${mismatch.dependency}: expected ${mismatch.expected}, found ${mismatch.actual}`,
    );
  }
  process.exit(1);
}

console.log('Frontend workspace versions are aligned for shared core tooling.');
console.log('Intentional skew policy:');
for (const note of INTENTIONAL_SKEWS) {
  console.log(`- ${note}`);
}
