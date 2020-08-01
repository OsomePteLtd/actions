import * as core from "@actions/core";
import * as github from "@actions/github";
import { exec } from "@actions/exec";

const DEFAULT_USER_ID = "osome-bot";
const DEFAULT_USER_NAME = "Osome Bot";
const DEFAULT_USER_EMAIL = "67785357+osome-bot@users.noreply.github.com";

async function run() {
  try {
    const token = core.getInput("token");
    const {
      ref,
      repo: { owner, repo },
    } = github.context;

    // Configure git
    const origin = `https://${DEFAULT_USER_ID}:${token}@github.com/${owner}/${repo}.git`;
    await exec("git", ["remote", "set-url", "origin", origin]);
    await exec("git", ["config", "user.name", `"${DEFAULT_USER_NAME}"`]);
    await exec("git", ["config", "user.email", `"${DEFAULT_USER_EMAIL}"`]);

    await exec(`echo ::set-env name=NPM_TOKEN::${token}`);
    await exec("npm", ["ci"]);

    // Update spec
    await exec("curl", ["-f", "-u ooo:some!", "https://docs.osome.club/api/stage/agent/openapi.json > spec/core.json"]);
    await exec("curl", ["-f", "-u ooo:some!", "https://docs.osome.club/api/stage/seed/openapi.json > spec/seed.json"]);
    await exec("curl", ["-f", "-u ooo:some!", "https://docs.osome.club/api/stage/pablo/openapi.json > spec/pablo.json"]);
    await exec("curl", ["-f", "-u ooo:some!", "https://docs.osome.club/api/stage/hero/openapi.json > spec/hero.json"]);

    // Validate the fresh spec
    await exec("npm", ["run", "generate"]);
    await exec("npm", ["run", "build"]);

    await exec("git", ["add", "."]);
    await exec("git", ["commit", "-m \"Update Spec\""]);
    await exec("git", ["push", "origin", `HEAD:${ref}`]);

    // Bump version and push the commit and tag
    // await exec("npm", ["version", "minor"]);
    // await exec("git", ["push", "origin", `HEAD:${ref}`, "--tags"]);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
