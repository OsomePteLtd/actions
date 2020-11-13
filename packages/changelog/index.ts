import * as core from '@actions/core';
import * as github from '@actions/github';
import { promises as fs } from 'fs';
import { EventPayloads } from '@octokit/webhooks';

async function run() {
  try {
    // Get current commit and branch (if push/merge event).
    // Get last successful deployment.
    // Build a graph of commits between last successful deployment and current commit.
    // Form a changelog by calling JIRA and return it as markdown.
    const {
      context,
      context: {
        eventName,
        repo: { owner, repo },
      },
    } = github;

    const event: EventPayloads.WebhookPayloadDeployment = await fs
      .readFile(process.env.GITHUB_EVENT_PATH!)
      .then((buffer) => JSON.parse(buffer.toString()));

    if (eventName !== 'deployment' || event.action !== 'created') {
      throw new Error(`This action only works when creating depoyments`);
    }

    const token = core.getInput('token', { required: true });
    const octokit = github.getOctokit(token);

    let sha = null;
    const { data: deployments } = await octokit.repos.listDeployments({
      owner,
      repo,
      environment: event.deployment.environment,
    });

    for (const deployment of deployments.filter(({ sha }) => sha != context.sha)) {
      const { data: statuses } = await octokit.repos.listDeploymentStatuses({
        owner,
        repo,
        deployment_id: deployment.id,
      });

      if (statuses.find((status) => status.state === 'success')) {
        sha = deployment.sha;
        break;
      }
    }

    if (!sha) {
      // TODO: Take first commit SHA.
      throw new Error(`Could not find last deployment`);
    }

    const {
      data: { commits },
    } = await octokit.repos.compareCommits({ repo, owner, base: sha!, head: context.sha });
    for (const { commit } of commits) {
      console.log(commit.message);
    }
  } catch (err) {
    console.error(err);
  }
}

// Don't auto-execute in the test environment
// istanbul ignore next
if (process.env['NODE_ENV'] !== 'test') {
  run();
}

export default run;
