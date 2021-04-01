import * as core from "@actions/core";
import * as github from "@actions/github";
import { exec } from "@actions/exec";

const DEFAULT_USER_ID = "osome-bot";
const DEFAULT_USER_NAME = "Osome Bot";
const DEFAULT_USER_EMAIL = "67785357+osome-bot@users.noreply.github.com";

async function run() {
  try {
    const githubToken = core.getInput("token");
    const npmToken = core.getInput("npm");
    core.exportVariable('NPM_TOKEN', npmToken);

    const {
      ref,
      repo: { owner, repo },
    } = github.context;
    // Configure git
    const origin = `https://${DEFAULT_USER_ID}:${githubToken}@github.com/${owner}/${repo}.git`;
    await exec("git", ["remote", "set-url", "origin", origin]);
    await exec("git", ["config", "user.name", `"${DEFAULT_USER_NAME}"`]);
    await exec("git", ["config", "user.email", `"${DEFAULT_USER_EMAIL}"`]);

    await exec("npm", ["ci"]);

    // Update spec
    await exec("curl", ["-f", "-u", "ooo:some!", "https://docs.osome.club/api/stage/agent/openapi.json", "--output", "spec/core.json"]);
    await exec("curl", ["-f", "-u", "ooo:some!", "https://docs.osome.club/api/stage/seed/openapi.json", "--output", "spec/seed.json"]);
    // await exec("curl", ["-f", "-u", "ooo:some!", "https://docs.osome.club/api/stage/pablo/openapi.json", "--output", "spec/pablo.json"]);
    await exec("curl", ["-f", "-u", "ooo:some!", "https://docs.osome.club/api/stage/hero/openapi.json", "--output", "spec/hero.json"]);
    await exec("curl", ["-f", "-u", "ooo:some!", "https://docs.osome.club/api/stage/billy/openapi.json", "--output", "spec/billy.json"]);
    await exec("curl", ["-f", "-u", "ooo:some!", "https://docs.osome.club/api/stage/pechkin/openapi.json", "--output", "spec/pechkin.json"]);
    await exec("curl", ["-f", "-u", "ooo:some!", "https://docs.osome.club/api/stage/shiva/openapi.json", "--output", "spec/shiva.json"]);
    await exec("curl", ["-f", "-u", "ooo:some!", "https://docs.osome.club/api/stage/scrooge/openapi.json", "--output", "spec/scrooge.json"]);
    await exec("curl", ["-f", "-u", "ooo:some!", "https://docs.osome.club/api/stage/payot/openapi.json", "--output", "spec/payot.json"]);

    // Validate (try to build) the fresh spec
    await exec("npm", ["run", "build"]);

    // Commit changes
    await exec("git", ["add", "."]);
    await exec("git", ["commit", "-m Update Spec"]);
    await exec("git", ["push", "origin", `HEAD:${ref}`]);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
