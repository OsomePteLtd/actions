import * as core from '@actions/core';
import { Context } from '@actions/github/lib/context';
import { EventPayloads } from '@octokit/webhooks';

import { toEnvironments, getProjectsFromInput } from '../utils';

export const on = async (event: EventPayloads.WebhookPayloadPush, context: Context) => {
  const {payload: { merge_group: {head_sha } }} = context
  const env = 'merge-queue-' + head_sha.substring(0,7)
  console.log('env--->', env)
  const projects = getProjectsFromInput();
  return core.setOutput('stages', toEnvironments([env], projects));
};
