module.exports = {
  coverageThreshold: {
    global: { functions: 100 },
    'src/@(jobs|workers)/a.ts': { functions: 50 },
  },
};
