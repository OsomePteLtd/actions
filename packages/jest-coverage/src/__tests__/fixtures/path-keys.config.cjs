module.exports = {
  coverageThreshold: {
    global: { functions: 100 },
    'src/controllers/': { functions: 0 },
    'src/**/*.handler.ts': { functions: 0 },
  },
};
