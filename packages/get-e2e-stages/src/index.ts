import * as core from '@actions/core';
import * as github from '@actions/github';

const defaultUrls = {
  ADMIN_URL: 'https://stage.agent.osome.club',
  WEBSOME_URL: 'https://stage.my.osome.club',
  API_AGENT_URL: 'https://api.stage.osome.club/api/v2',
};

async function run() {
  const {
    repo: { owner, repo },
    ref,
  } = github.context;
  const token = core.getInput('token', { required: true });
  const octokit = github.getOctokit(token);

  const { data } = await octokit.repos.listDeployments({
    owner,
    repo,
    ref: ref.replace('refs/heads/', ''),
  });

  if (repo === 'websome') {
    defaultUrls.WEBSOME_URL = getWebsomeUrl(data);
  }
  if (repo === 'agent') {
    defaultUrls.ADMIN_URL = getAgentUrl(data);
  }
  if (repo === 'backend') {
    defaultUrls.API_AGENT_URL = getBackendUrl(data);
  }

  return core.setOutput('e2e', defaultUrls);
}

type Deployment = {
  environment: string;
}

function getBackendUrl(deploymentsList: Deployment[]) {
  if (deploymentsList.length === 0) {
    return defaultUrls.API_AGENT_URL;
  }

  return `https://api.${deploymentsList[0].environment}.osome.club/api/v2`;
}

function getWebsomeUrl(deploymentsList: Deployment[]) {
  if (deploymentsList.length === 0) {
    return defaultUrls.WEBSOME_URL;
  }

  return `https://${deploymentsList[0].environment}.my.osome.club`;
}

function getAgentUrl(deploymentsList: Deployment[]) {
  if (deploymentsList.length === 0) {
    return defaultUrls.ADMIN_URL;
  }

  return `https://${deploymentsList[0].environment}.agent.osome.club`;
}

// Don't auto-execute in the test environment
// istanbul ignore next
if (process.env['NODE_ENV'] !== 'test') {
  run();
}

export default run;
