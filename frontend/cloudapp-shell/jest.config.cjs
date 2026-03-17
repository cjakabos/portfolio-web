module.exports = {
  testEnvironment: "jsdom",
  roots: ["<rootDir>/src"],
  testMatch: [
    "**/__tests__/**/*.test.ts",
    "**/__tests__/**/*.test.tsx",
    "**/mobile/**/*.smoke.test.ts",
  ],
  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.jest.json" }],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@portfolio/auth$": "<rootDir>/../../packages/auth/src/index.ts",
    "^@portfolio/api-clients$": "<rootDir>/../../packages/api-clients/src/index.ts",
    "^@portfolio/contracts$": "<rootDir>/../../packages/contracts/src/index.ts",
    "^@portfolio/ui$": "<rootDir>/../../packages/ui/src/index.ts",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  clearMocks: true,
};
