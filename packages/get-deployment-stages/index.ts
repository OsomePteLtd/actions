import * as core from '@actions/core';
import * as github from '@actions/github';
import { Webhooks } from '@octokit/webhooks';
import { promises as fs } from 'fs';

interface Stage {
  name: string;
  transient_environment: boolean;
  production_environment: boolean;
}

const STAGE_LABELS: Record<string, string> = {
  '': 'production',
  'deployed to stage': 'stage',
  'deployed to test-1': 'test-1',
  'deployed to test-2': 'test-2',
  'deployed to test-3': 'test-3',
  'deployed to test-4': 'test-4',
  'deployed to test-5': 'test-5',
  'deployed to test-6': 'test-6',
  'deployed to test-7': 'test-7',
  'deployed to test-8': 'test-8',
  'deployed to test-9': 'test-9',
};

const isMaster = (ref: string) => ref === 'refs/heads/master';
const isProductionEnv = (env: string) => env === 'production';
const isTransientEnv = (env: string) => Object.values(STAGE_LABELS).includes(env);

const toStages = (envs: string[]) =>
  JSON.stringify(
    envs.reduce(
      (envs, env) => [
        ...envs,
        {
          name: env,
          transient_environment: isTransientEnv(env),
          production_environment: isProductionEnv(env),
        },
      ],
      [] as Stage[],
    ),
  );

async function run() {
  try {
    const event: Webhooks.WebhookPayloadPullRequest = await fs
      .readFile(process.env.GITHUB_EVENT_PATH!)
      .then((buffer) => JSON.parse(buffer.toString()));

    const { eventName, ref } = github.context;

    if (eventName === 'workflow_dispatch') {
      // There are currently no types present for
      // workflow_dispatch in @octokit/webhooks package.
      const environment = (event as any).inputs.environment;
      const stages = Object.values(STAGE_LABELS).filter((label) => label === environment);

      if (!isMaster(ref) && isProductionEnv(environment)) {
        throw new Error('Can deploy to production from master branch only');
      }

      if (stages.length) {
        core.setOutput('stages', toStages(stages));
      }

      return;
    }

    // Workflows run on master branch should only deploy to stage.
    if (isMaster(ref)) {
      core.setOutput('stages', toStages(['stage']));
      return;
    }

    // Workflows run on pull request can deploy anywhere else.
    if (eventName === 'pull_request') {
      const {
        head: { ref: branchName },
        labels,
      } = event.pull_request;

      const stages = labels
        .map(({ name: labelName }) => STAGE_LABELS[labelName])
        .filter((stage) => !!stage && !isProductionEnv(stage));

      // If stage-specific labels are found, use them.
      if (stages.length) {
        core.setOutput('stages', toStages(stages));
        return;
      }

      // If no stage-specific labels are found, use task name or branch name.
      if (!stages.length) {
        const output = [branchName.replace(/[\/|=]/, '-').toLowerCase()];
        core.setOutput('stages', toStages(output));
        return;
      }
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

// Don't auto-execute in the test environment
if (process.env['NODE_ENV'] !== 'test') {
  run();
}

export default run;
