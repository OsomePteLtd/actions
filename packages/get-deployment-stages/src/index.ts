import * as core from '@actions/core';
import * as github from '@actions/github';

import { on as onPullRequest } from './events/pull_request';
import { on as onPush } from './events/push';
import { on as onRepositoryDispatch } from './events/repository_dispatch';
import { on as onWorkflowDispatch } from './events/workflow_dispatch';
import { on as onMergeGroup } from './events/merge_group';
import { getEvent } from './utils';

async function run() {
  try {
    const {
      context,
      context: { eventName },
    } = github;

    const event = await getEvent(eventName);

    switch (eventName) {
      case 'pull_request':
        return onPullRequest(event, context);
      case 'push':
        return onPush(event, context);
      case 'repository_dispatch':
        return onRepositoryDispatch(event, context);
      case 'workflow_dispatch':
        return onWorkflowDispatch(event, context);
      case 'merge_group':
        return onMergeGroup(event, context);
      default:
        throw new Error('Unsupported event type');
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

// Don't auto-execute in the test environment
// istanbul ignore next
if (process.env['NODE_ENV'] !== 'test') {
  run();
}

export default run;
