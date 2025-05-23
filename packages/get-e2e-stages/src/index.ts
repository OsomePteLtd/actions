import * as core from '@actions/core';
import * as github from '@actions/github';

type Repo = 'websome' | 'agent' | 'backend';

const defaultUrls = {
  ADMIN_URL: 'https://stage.agent.osome.club',
  WEBSOME_URL: 'https://stage.my.osome.club',
  API_AGENT_URL: 'https://stage.agent.osome.club/api/v2',
  API_WEBSOME_URL: 'https://stage.my.osome.club/api/v2',
};

export const testEnvs = ['test-1', 'test-2', 'test-3'];

async function run() {
  const repo = github.context.repo.repo as Repo;
  const { ref } = github.context;
  const environment = core.getInput('environment', { required: false });

  const urls = getLinks(repo, environment);

  core.info(`Repo: ${repo}`);
  core.info(`Ref: ${ref}`);
  core.info(`Urls: ${JSON.stringify(urls)}`);

  return core.setOutput('e2e', urls);
}

function getLinks(repo: Repo, environment?: string) {
  if (!environment || environment === 'stage') {
    return defaultUrls;
  }

  if (testEnvs.includes(environment)) {
    return {
      ADMIN_URL: `https://${environment}.agent.osome.club`,
      WEBSOME_URL: `https://${environment}.my.osome.club`,
      API_AGENT_URL: `https://${environment}.agent.osome.club/api/v2`,
      API_WEBSOME_URL: `https://${environment}.api.osome.club/api/v2`,
    };
  }

  switch (repo) {
    case 'agent':
      return {
        ...defaultUrls,
        ADMIN_URL: `https://${environment}.agent.osome.club`,
      };
    case 'websome':
      return {
        ...defaultUrls,
        WEBSOME_URL: `https://${environment}.my.osome.club`,
      };
    default:
      return defaultUrls;
  }
}

// Don't auto-execute in the test environment
// istanbul ignore next
if (process.env['NODE_ENV'] !== 'test') {
  run();
}

export default run;
