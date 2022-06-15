import * as core from '@actions/core';
import { Context } from '@actions/github/lib/context';
import { EventPayloads } from '@octokit/webhooks';

import { isOsomeBot, toEnvironments, isProductionEnv, getProjectsFromInput } from '../utils';

export const on = async (event: EventPayloads.WebhookPayloadRepositoryDispatch, context: Context) => {
  const { environment } = event.client_payload as { environment: string };
  const { actor } = context;
  const projects = getProjectsFromInput();

  if (!isOsomeBot(actor) && isProductionEnv(environment)) {
    return core.setFailed('Only osome-bot can deploy to production');
  }

  if (!isProductionEnv(environment)) {
    return core.setFailed('Can use repository_dispatch only to deploy to production');
  }

  return core.setOutput('stages', toEnvironments(['production'], projects));
};
