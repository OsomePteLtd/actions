import { EventPayloads } from '@octokit/webhooks';
import { promises as fs } from 'fs';

import { STAGE_LABELS } from './constants';
import { Environment } from './types';

export const getEvent = async (eventName: string) => {
  const event = await fs.readFile(process.env.GITHUB_EVENT_PATH!).then((buffer) => JSON.parse(buffer.toString()));

  if (eventName === 'pull_request') {
    return event as EventPayloads.WebhookPayloadPullRequest;
  }

  if (eventName === 'push') {
    return event as EventPayloads.WebhookPayloadPush;
  }

  if (eventName === 'repository_dispatch') {
    return event as EventPayloads.WebhookPayloadRepositoryDispatch;
  }

  if (eventName === 'workflow_dispatch') {
    return event as EventPayloads.WebhookPayloadWorkflowDispatch;
  }

  return event;
};

export const toEnvironments = (envs: string[]) => {
  const environments = envs.reduce(
    (envs, env) => [
      ...envs,
      {
        name: env,
        transient_environment: isTransientEnv(env),
        production_environment: isProductionEnv(env),
      },
    ],
    [] as Environment[],
  );

  return JSON.stringify(environments);
};

export const isOsomeBot = (actor: string) => actor === 'osome-bot';

export const isMaster = (ref: string) => ref === 'refs/heads/master';
export const isTag = (ref: string) => ref.startsWith('refs/tags');

export const isProductionEnv = (env: string) => env === 'production';
export const isTransientEnv = (env: string) => Object.values(STAGE_LABELS).includes(env);
