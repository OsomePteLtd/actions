import * as core from '@actions/core';
import { Context } from '@actions/github/lib/context';
import { EventPayloads } from '@octokit/webhooks';

import { isOsomeBot, toEnvironments, isProductionEnv } from '../utils';

export const on = async (event: EventPayloads.WebhookPayloadRepositoryDispatch, context: Context) => {
  const { client_payload } = event;
  const { environment } = client_payload as any;
  const { actor } = context;

  if (!isOsomeBot(actor) && isProductionEnv(environment)) {
    return core.setFailed('Only osome-bot can deploy to production');
  }

  return core.setOutput('stages', toEnvironments(['production']));
};
