import * as core from '@actions/core';
import * as github from '@actions/github';

async function run() {
  try {
    const org = core.getInput('org') || 'OsomePteLtd';
    const token = core.getInput('token', { required: true });
    const octokit = github.getOctokit(token);
    const repos = await octokit.repos.listForOrg({ org, page: 1, per_page: 100 });
    core.setOutput('repos', JSON.stringify(repos.data.map((repo) => ({ owner: repo.owner.login, repo: repo.name }))));
  } catch (error) {
    console.error(error);
    core.setFailed(error.message);
  }
}

// Don't auto-execute in the test environment
// istanbul ignore next
if (process.env['NODE_ENV'] !== 'test') {
  run();
}

export default run;
