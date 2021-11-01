import * as core from '@actions/core';
import * as github from '@actions/github';
import { Context } from '@actions/github/lib/context';
import { EventPayloads } from '@octokit/webhooks';

import { previews, STAGE_LABELS } from '../constants';
import { isProductionEnv, toEnvironments, getProjectsFromInput } from '../utils';

export const on = async (event: EventPayloads.WebhookPayloadPullRequest, context: Context) => {
  const { action } = event;

  if (action === 'closed') {
    return onPullRequestClosed(event, context);
  }

  return onPullRequest(event, context);
};

const onPullRequest = async (event: EventPayloads.WebhookPayloadPullRequest, context: Context) => {
  const withTransient = JSON.parse(core.getInput('with-transient') || 'true');
  const projects = getProjectsFromInput();
  const {
    pull_request: {
      head: { ref },
      labels,
    },
  } = event;

  const stages = labels
    .map(({ name: labelName }) => STAGE_LABELS[labelName])
    .filter((stage) => !!stage && !isProductionEnv(stage));

  // If stage-specific labels are found, use them.
  if (stages.length) {
    return core.setOutput('stages', toEnvironments(stages, projects));
  }

  if (!withTransient) {
    return core.setOutput('stages', toEnvironments([], projects));
  }

  // If no stage-specific labels are found, use task name or branch name.
  const output = [ref.replace(/[\/|=|_|\.]/g, '-').toLowerCase().substring(0, 63)];
  return core.setOutput('stages', toEnvironments(output, projects));
};

const onPullRequestClosed = async (event: EventPayloads.WebhookPayloadPullRequest, context: Context) => {
  const {
    pull_request: {
      head: { ref },
    },
  } = event;
  const { repo } = context;

  const token = core.getInput('token', { required: true });
  const octokit = github.getOctokit(token);
  const projects = getProjectsFromInput();

  const stages: string[] = [];
  const { data: deployments } = await octokit.repos.listDeployments({
    mediaType: { previews },
    ref,
    ...repo,
  });
  const transientEnvironments = deployments.filter((deployment) => deployment.transient_environment);

  for (const { id: deployment_id, environment } of transientEnvironments) {
    const { data: statuses } = await octokit.repos.listDeploymentStatuses({
      mediaType: { previews },
      deployment_id,
      ref,
      ...repo,
    });

    const [status] = statuses;
    if (status.state !== 'inactive') {
      stages.push(environment);
    }
  }

  return core.setOutput('stages', toEnvironments(stages, projects));
};
