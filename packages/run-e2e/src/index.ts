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

  if (repo === 'backend') {
    return defaultUrls;
  }

  const deploymentsList = await octokit.repos.listDeployments({
    owner,
    repo,
    ref,
  });

  if (repo === 'websome') {
    defaultUrls.WEBSOME_URL = getWebsomeUrl(deploymentsList);
  }

  if (repo === 'agent') {
    defaultUrls.ADMIN_URL = getAgentUrl(deploymentsList);
  }

  console.log({ deploymentsList, repo, ref, defaultUrls });

  return defaultUrls;
}

function getWebsomeUrl(deploymentsList: any) {
  if (deploymentsList.data.length === 0) {
    return 'https://stage.my.osome.club';
  }

  return `https://${deploymentsList.data[0].environment}.my.osome.club`;
}

function getAgentUrl(deploymentsList: any) {
  if (deploymentsList.data.length === 0) {
    return 'https://stage.agent.osome.club';
  }

  return 'https://stage.agent.osome.club';
}

// Don't auto-execute in the test environment
// istanbul ignore next
if (process.env['NODE_ENV'] !== 'test') {
  run();
}

export default run;
