import * as core from '@actions/core';

async function run() {
  const name = core.getInput('name', { required: true })
  const environment = core.getInput('environment', { required: true });

  const dev = core.getInput('dev');
  const staging = core.getInput('staging', { required: true });
  const production = core.getInput('production', { required: true })

  if (environment === 'production') {
    return core.exportVariable(name, production)
  }

  if (environment === 'stage') {
    return core.exportVariable(name, staging);
  }

  return core.exportVariable(name, dev || staging);
}

// Don't auto-execute in the test environment
// istanbul ignore next
if (process.env['NODE_ENV'] !== 'test') {
  run();
}

export default run;
