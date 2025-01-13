module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  testMatch: ['<rootDir>/tests/**/*.test.ts', '**/__tests__/**/*.test.ts', '**/__tests__/**/*.spec.ts'],
  collectCoverage: true,
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {
      tsconfig: '<rootDir>/tsconfig.json', // Specify TypeScript config
    }],
  },
};