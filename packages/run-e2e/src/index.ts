import AdmZip from 'adm-zip';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { exec } from '@actions/exec';

async function run() {
  await downloadE2ERepo('./e2e');

  await exec('cd ./e2e');
  await exec('yarn install');
  // await exec('yarn install');
}

async function downloadE2ERepo(path: string) {
  const {
    repo: { owner },
    ref,
  } = github.context;
  const e2eRepo = 'e2e';
  const token = core.getInput('token', { required: true });
  const octokit = github.getOctokit(token);

  let downloadedRepo = null;
  try {
    await octokit.repos.getBranch({
      owner,
      repo: e2eRepo,
      branch: ref,
    });
    console.log(`Using branch ${ref} for tests`);
    downloadedRepo = await octokit.repos.downloadZipballArchive({
      owner,
      repo: e2eRepo,
      ref: 'master',
    });
  } catch (e) {
    console.log(`Can't branch ${ref} in https://github.com/OsomePteLtd/e2e, using master`);
    downloadedRepo = await octokit.repos.downloadZipballArchive({
      owner,
      repo: e2eRepo,
      ref: 'master',
    });
  }

  const zip = new AdmZip(Buffer.from(downloadedRepo.data as ArrayBuffer));
  zip.extractAllTo(path, true);
}

// Don't auto-execute in the test environment
// istanbul ignore next
if (process.env['NODE_ENV'] !== 'test') {
  run();
}

export default run;
