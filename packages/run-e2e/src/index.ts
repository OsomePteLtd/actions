import * as core from '@actions/core';
import * as github from '@actions/github';

async function run() {
  const {
    ref,
    repo: { owner, repo },
  } = github.context;
  const token = core.getInput('token', { required: true });
  const octokit = github.getOctokit(token);

  const downloadUrl = await octokit.repos.downloadArchive({
    owner,
    repo,
    ref,
    archive_format: 'tar',
  });

  console.log({ downloadUrl });
}

// Don't auto-execute in the test environment
// istanbul ignore next
if (process.env['NODE_ENV'] !== 'test') {
  run();
}

export default run;
