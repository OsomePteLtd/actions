import * as core from '@actions/core';
import * as github from '@actions/github';
import { ReposCompareCommitsResponseData } from '@octokit/types';
import { KnownBlock } from '@slack/web-api';
import groupBy from 'lodash/groupBy';
import {
  getCoauthors,
  getEvent,
  getIcon,
  getJira,
  getOctokit,
  getSlack,
  joinAuthors,
} from './utils';
import { Changelog } from './types';

async function run() {
  try {
    const { eventName, sha } = github.context;

    if (eventName !== 'deployment') {
      throw new Error(`This action only works with depoyment events`);
    }

    const deploymentSha = await getLastDeploymentSha();
    const version = await getVersionFromCommit(sha);
    const commits = await getCommitsBetween(deploymentSha, sha);
    const changelog = await buildChangelog(commits, version);

    await sendChangelogToSlack(changelog);
  } catch (err) {
    console.error(err);
  }
}

async function getLastDeploymentSha() {
  const octokit = getOctokit();
  const event = await getEvent();
  const { owner, repo } = github.context.repo;

  const { data: deployments } = await octokit.repos.listDeployments({
    owner,
    repo,
    environment: event.deployment.environment,
  });

  for (const deployment of deployments.filter(({ sha }) => sha != github.context.sha)) {
    const { data: statuses } = await octokit.repos.listDeploymentStatuses({
      owner,
      repo,
      deployment_id: deployment.id,
    });

    if (statuses.some((status) => status.state === 'success')) {
      return deployment.sha;
    }
  }

  throw new Error('Unable to find previous deployment');
}

async function getVersionFromCommit(sha: string) {
  const octokit = getOctokit();
  const { owner, repo } = github.context.repo;

  const {
    data: { tag },
  } = await octokit.git.getTag({ owner, repo, tag_sha: sha }); //repos.getCommit({ repo, owner, ref: sha });

  return tag ?? null;
}

async function getCommitsBetween(base: string, head: string) {
  const octokit = getOctokit();
  const { owner, repo } = github.context.repo;

  const {
    data: { commits },
  } = await octokit.repos.compareCommits({ repo, owner, base, head });

  return commits.filter((commit) => commit.author.login !== 'osome-bot');
}

async function buildChangelog(
  commits: ReposCompareCommitsResponseData['commits'],
  version: string,
): Promise<Changelog> {
  const jira = getJira();
  const { owner, repo } = github.context.repo;

  const changelog: Changelog = {
    title: [`@${owner}/${repo}`, version].filter(Boolean).join(' '),
    items: [],
  };

  for (const ghCommit of commits) {
    const { commit } = ghCommit;
    const author = { email: commit.author.email, login: ghCommit.author.login };
    const [issueKey] = commit.message.match(/\w+\-\d+/) ?? [];
    const issueExistsInChangelog = !!issueKey && changelog.items.some((item) => item.issue?.key === issueKey);

    if (issueExistsInChangelog) {
      const item = changelog.items.find((item) => item.issue?.key === issueKey);
      if (item) item.coauthors = [...item.coauthors, author, ...getCoauthors(commit.message)];
    } else {
      const issue = issueKey ? await jira.findIssue(issueKey).catch(() => null) : null;

      changelog.items.push({
        author,
        coauthors: getCoauthors(commit.message),
        commit: {
          message: commit.message,
          shortSha: commit.tree.sha.substring(0, 8),
        },
        issue: issue
          ? {
              key: issue.key,
              link: `https://reallyosome.atlassian.net/browse/${issue.key}`,
              text: issue.fields.summary,
            }
          : null,
        type: issue ? issue.fields.issuetype.name : 'Other',
      });
    }
  }

  return changelog;
}

async function sendChangelogToSlack(changelog: Changelog) {
  const slack = getSlack();
  const blocks: KnownBlock[] = [];

  blocks.push({
    type: 'header',
    text: {
      type: 'plain_text',
      text: `${changelog.title.toLowerCase()} is now live :party:`,
    },
  });

  const itemsByType = groupBy(changelog.items, 'type');
  for (const [type, items] of Object.entries(itemsByType)) {
    const icon = getIcon(type);
    const texts = [];

    for (const item of items) {
      const authors = await joinAuthors([item.author, ...item.coauthors]);

      if (item.issue) {
        texts.push(`${icon} *<${item.issue.link}|${item.issue.key}>* ${item.issue.text} ${authors}`);
      } else {
        texts.push(`${icon} *${item.commit.shortSha}* ${item.commit.message} ${authors}`);
      }
    }

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: texts.join('\n'),
      },
    });
  }

  blocks.push(
    {
      type: 'section',
      text: {
        type: 'plain_text',
        text: '\n',
      },
    },
    { type: 'divider' },
    {
      type: 'context',
      elements: [
        {
          type: 'plain_text',
          text: `By the way, :green_book: are stories, :closed_book: are bugfixes, :blue_book: are subtasks and :orange_book: are all other issue types.`,
        },
      ],
    },
  );

  await slack.chat.postMessage({
    text: `${changelog.title} is live :party:`,
    blocks,
    channel: core.getInput('slack-channel', { required: true }),
    link_names: true,
  });
}

// Don't auto-execute in the test environment
// istanbul ignore next
if (process.env['NODE_ENV'] !== 'test') {
  run();
}

export default run;
