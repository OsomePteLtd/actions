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
    const event: Webhooks.WebhookPayloadPullRequest = await fs
      .readFile(process.env.GITHUB_EVENT_PATH!)
      .then((buffer) => JSON.parse(buffer.toString()));

    const { eventName, ref } = github.context;

    // Workflows run on master branch should only deploy to stage.
    if (ref === "refs/heads/master") {
      core.setOutput("stages", JSON.stringify(['stage']));
      return;
    }

    // Workflows run on pull request can deploy anywhere else.
    if (eventName === "pull_request") {
      const {
        head: { ref: branchName },
        labels,
      } = event.pull_request;

      const stages = labels
        .map(({ name: labelName }) => STAGE_LABELS[labelName])
        .filter(Boolean);

      // If stage-specific labels are found, use them.
      if (stages.length) {
        core.setOutput("stages", JSON.stringify(stages));
        return;
      }

      // If no stage-specific labels are found, use task name or branch name.
      if (!stages.length) {
        const output = [branchName.replace(/.*\/(.*)/, "$1").toLowerCase()];
        core.setOutput("stages", JSON.stringify(output));
        return;
      }
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
