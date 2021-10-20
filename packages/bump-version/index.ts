import * as core from '@actions/core';
import * as github from '@actions/github';
import { exec } from '@actions/exec';

const DEFAULT_USER_ID = 'osome-bot';
const DEFAULT_USER_NAME = 'Osome Bot';
const DEFAULT_USER_EMAIL = '67785357+osome-bot@users.noreply.github.com';

async function run() {
  try {
    const token = core.getInput('token');
    const workingDirectory = core.getInput('working-directory', { required: false });
    const {
      ref,
      repo: { owner, repo },
    } = github.context;

    // Configure git
    const origin = `https://${DEFAULT_USER_ID}:${token}@github.com/${owner}/${repo}.git`;
    await exec('git', ['remote', 'set-url', 'origin', origin]);
    await exec('git', ['config', 'user.name', `"${DEFAULT_USER_NAME}"`]);
    await exec('git', ['config', 'user.email', `"${DEFAULT_USER_EMAIL}"`]);

    // Why create the directory? https://github.com/npm/npm/issues/9111#issuecomment-126279242
    if (workingDirectory) {
      await exec('mkdir', ['.git'], { cwd: workingDirectory });
    }

    // Bump version and push the commit and tag
    let tag = '';
    await exec('npm', ['version', 'patch'], {
      listeners: {
        stdout: (data: Buffer) => {
          tag += data.toString();
        },
      },
      cwd: workingDirectory,
    });


    await exec('git', ['push', 'origin', `HEAD:${ref}`]);
    await exec('git', ['push', 'origin', `refs/tags/${tag.trim()}`]);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
