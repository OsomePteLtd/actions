import * as core from '@actions/core';
import * as github from '@actions/github';
import { EventPayloads } from '@octokit/webhooks';
import { promises as fs } from 'fs';

const defaultUrls = {
  ADMIN_URL: 'https://stage.agent.osome.club',
  WEBSOME_URL: 'https://stage.my.osome.club',
  API_AGENT_URL: 'https://api.stage.osome.club/api/v2',
};

async function run() {
  const {
    eventName,
    repo: { owner, repo },
  } = github.context;
  const event = await getEvent(eventName);
  const token = core.getInput('token', { required: true });
  const octokit = github.getOctokit(token);

  const {
    pull_request: {
      head: { ref },
    },
  } = event;

  if (repo === 'backend') {
    return core.setOutput('e2e', defaultUrls);
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

  return core.setOutput('e2e', defaultUrls);
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

async function getEvent(eventName: string): Promise<EventPayloads.WebhookPayloadPullRequest> {
  const event = await fs.readFile(process.env.GITHUB_EVENT_PATH!).then((buffer) => JSON.parse(buffer.toString()));

  return event as EventPayloads.WebhookPayloadPullRequest;
}

// Don't auto-execute in the test environment
// istanbul ignore next
if (process.env['NODE_ENV'] !== 'test') {
  run();
}

export default run;
