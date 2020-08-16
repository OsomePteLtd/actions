import * as core from "@actions/core";
import * as github from "@actions/github";

const stages = [
  'test-1',
  'test-2',
  'test-3',
  'test-4',
  'test-5',
  'test-6',
  'test-7',
  'test-8',
  'test-9',
];

async function run() {
  try {
    const token = core.getInput("token");
    const {
      ref,
      repo: { owner, repo },
    } = github.context;

    const octokit = github.getOctokit(token)

    for (const environment of stages) {
      console.log({ owner, repo, ref, environment});
      const deployment = await octokit.repos.createDeployment({
        owner,
        repo,
        ref,
        environment,
        required_contexts: [],
      });
      console.log({ deployment: deployment.status });
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
