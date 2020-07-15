import * as core from "@actions/core";
import * as github from "@actions/github";
import { Webhooks } from "@octokit/webhooks";
import { promises as fs } from "fs";

const STAGE_LABELS: Record<string, string> = {
  "deployed to stage": "stage",
  "deployed to test-1": "test-1",
  "deployed to test-2": "test-2",
  "deployed to test-3": "test-3",
  "deployed to test-4": "test-4",
  "deployed to test-5": "test-5",
  "deployed to test-6": "test-6",
  "deployed to test-7": "test-7",
  "deployed to test-8": "test-8",
  "deployed to test-9": "test-9",
};

async function run() {
  try {
    const { eventName, ref, repo } = github.context;
    const event: Webhooks.WebhookPayloadPullRequest = await fs
      .readFile(process.env.GITHUB_EVENT_PATH!)
      .then((buffer) => JSON.parse(buffer.toString()));

    if (eventName === "tag") {
      if (ref !== "refs/heads/master") {
        core.setFailed("Only tags on master branch are supported");
        return;
      }

      const stages = [{ name: "stage", transient_environment: false }];
      core.setOutput("matrix", JSON.stringify({ stages }));
      return;
    }

    if (eventName === "pull_request") {
      const token = core.getInput("token");
      const octokit = github.getOctokit(token);

      const {
        head: { ref: branchName },
        number: pull_number,
      } = event.pull_request;

      const {
        data: { labels },
      } = await octokit.pulls.get({ pull_number, ...repo });

      const stages = labels
        .map(({ name }) =>
          STAGE_LABELS[name]
            ? { name: "stage", transient_environment: false }
            : null
        )
        .filter(Boolean);

      if (stages.length) {
        core.setOutput("stages", JSON.stringify({ stages }));
        return;
      } else {
        const stages = [
          {
            name: branchName.replace(/.*\/(.*)/, "$1").toLowerCase(),
            transient_environment: true,
          },
        ];
        core.setOutput("stages", JSON.stringify({ stages }));
        return;
      }
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
