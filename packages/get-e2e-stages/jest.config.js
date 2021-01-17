module.exports = {
  clearMocks: true,
  testEnvironment: 'node',
  transform: { '^.+\\.ts$': 'ts-jest' },
  verbose: true,
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};
