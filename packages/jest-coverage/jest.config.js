module.exports = {
  clearMocks: true,
  testEnvironment: 'node',
  transform: { '^.+\\.ts$': 'ts-jest' },
  verbose: true,
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
    'src/': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
};
