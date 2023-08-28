import * as core from '@actions/core';
import { Context } from '@actions/github/lib/context';
import { EventPayloads } from '@octokit/webhooks';

import { toEnvironments, getProjectsFromInput } from '../utils';

export const on = async (event: EventPayloads.WebhookPayloadPush, context: Context) => {
  const { ref } = context;
  const projects = getProjectsFromInput();

  return core.setOutput(ref.split("refs/heads/")[1], toEnvironments([], projects));
};
