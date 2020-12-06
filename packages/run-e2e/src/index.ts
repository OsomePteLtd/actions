import AdmZip from 'adm-zip';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { exec } from "@actions/exec";

async function run() {
  const {
    ref,
    repo: { owner },
  } = github.context;
  const token = core.getInput('token', { required: true });
  const octokit = github.getOctokit(token);

  const downloadUrl = await octokit.repos.downloadZipballArchive({
    owner,
    repo: 'e2e',
    ref,
  });

  const zip = new AdmZip(Buffer.from((downloadUrl.data as ArrayBuffer)));
  zip.extractAllTo('./e2e',true);

  await exec('cd ./e2e && ls -R');

  console.log({ downloadUrl });
}

// Don't auto-execute in the test environment
// istanbul ignore next
if (process.env['NODE_ENV'] !== 'test') {
  run();
}

export default run;
