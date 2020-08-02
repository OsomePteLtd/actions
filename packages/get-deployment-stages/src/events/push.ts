import * as core from '@actions/core';
import { Context } from '@actions/github/lib/context';
import { EventPayloads } from '@octokit/webhooks';

import { isMaster, isTag, toEnvironments } from '../utils';

export const on = async (event: EventPayloads.WebhookPayloadPush, context: Context) => {
  const { ref } = context;

  if (isMaster(ref) || isTag(ref)) {
    // TODO: Check that tag is on master branch.
    return core.setOutput('stages', toEnvironments(['stage']));
  }

  return core.setOutput('stages', toEnvironments([]));
};
