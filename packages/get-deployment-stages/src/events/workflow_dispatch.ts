import * as core from '@actions/core';
import { Context } from '@actions/github/lib/context';
import { EventPayloads } from '@octokit/webhooks';

import { STAGE_LABELS } from '../constants';
import { isOsomeBot, isMaster, isProductionEnv, toEnvironments } from '../utils';

export const on = async (event: EventPayloads.WebhookPayloadWorkflowDispatch, context: Context) => {
  const { actor, ref } = context;
  const { environment } = (event.inputs as { environment: string });
  const stages = Object.values(STAGE_LABELS).filter((label) => label === environment);

  if (!isOsomeBot(actor) && isProductionEnv(environment)) {
    return core.setFailed('Only osome-bot can deploy to production');
  }

  if (!isMaster(ref) && isProductionEnv(environment)) {
    return core.setFailed('Can deploy to production from master branch only');
  }

  if (stages.length) {
    return core.setOutput('stages', toEnvironments(stages));
  }

  return core.setOutput('stages', toEnvironments([]));
};
