import * as core from '@actions/core';
import { Context } from '@actions/github/lib/context';
import { EventPayloads } from '@octokit/webhooks';

import { isMaster, isTag, toEnvironments, getProjectsFromInput } from '../utils';

export const on = async (_: EventPayloads.WebhookPayloadPush, context: Context) => {
  const { ref } = context;
  const projects = getProjectsFromInput();
  if (isMaster(ref) || isTag(ref)) {
    return core.setOutput('stages', toEnvironments(['stage'], projects));
  }
  return core.setOutput('stages', toEnvironments([], projects));
};
