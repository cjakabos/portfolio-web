import fs from 'fs';
import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const resolveWorkspaceModule = (modulePath: string) => {
  const candidates = [
    path.resolve(__dirname, '../../node_modules', modulePath),
    path.resolve(__dirname, 'node_modules', modulePath),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
};

export default defineConfig({
  server: {
    port: 5010,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': path.resolve(__dirname, '.'),
      react: resolveWorkspaceModule('react'),
      'react-dom': resolveWorkspaceModule('react-dom'),
      'react/jsx-runtime': resolveWorkspaceModule('react/jsx-runtime.js'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    css: true,
    setupFiles: ['./tests/setup.ts'],
  },
});
