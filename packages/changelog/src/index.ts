import * as core from '@actions/core';
import * as github from '@actions/github';
import { ReposCompareCommitsResponseData } from '@octokit/types';
import { KnownBlock } from '@slack/web-api';
import groupBy from 'lodash/groupBy';
import parse from 'parse-link-header';
import { getCoauthors, getEvent, getIcon, getJira, getOctokit, getSlack, getStatus, joinAuthors } from './utils';
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

  const firstMasterCommitSha = await getFirstCommitSha({owner, repo, sha: 'master'});
  if (firstMasterCommitSha) {
    return firstMasterCommitSha;
  }

  const firstMainCommitSha = await getFirstCommitSha({owner, repo, sha: 'main'});
  if (firstMainCommitSha) {
    return firstMainCommitSha;
  }

  throw new Error('Unable to find previous deployment or first commit');
}

async function getVersionFromCommit(sha: string) {
  const octokit = getOctokit();
  const { owner, repo } = github.context.repo;

  const { data: tags } = await octokit.repos.listTags({ owner, repo }); //repos.getCommit({ repo, owner, ref: sha });
  return tags.find((tag) => tag.commit.sha === sha)?.name ?? null;
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
  version: string | null,
): Promise<Changelog> {
  const jira = getJira();
  const { owner, repo } = github.context.repo;

  const changelog: Changelog = {
    title: [`${owner}/${repo}`, version].filter(Boolean).join(' '),
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
          link: ghCommit.html_url,
          message: commit.message.split('\n')[0],
          shortSha: ghCommit.sha.substring(0, 7),
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
  const status = getStatus();
  const blocks: KnownBlock[] = [];
  const slack_message = status != 'failed' ? `${changelog.title.toLowerCase()} is now live :party:` : `${changelog.title.toLowerCase()} tst`;
  console.log(slack_message);
  

  blocks.push({
    type: 'header',
    text: {
      type: 'plain_text',
      text: `${status}`,
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
        texts.push(`${icon} *<${item.commit.link}|${item.commit.shortSha}>* ${item.commit.message} ${authors}`);
      }
    }

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: texts.join('\n').slice(0, 3000),
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

  core.info('Sending the following blocks to Slack');
  core.info(JSON.stringify(blocks, null, '  '));

  await slack.chat.postMessage({
    text: `${status}`,
    blocks,
    channel: core.getInput('slack-channel', { required: true }),
    link_names: true,
  });
}

export function getFirstCommitSha({
  owner,
  repo,
  sha,
}: {
  owner: string;
  repo: string;
  sha: string;
}): Promise<string | undefined> {
  const request = async (page: number): Promise<string | undefined> => {
    const octokit = getOctokit();
    const {
      data,
      headers: { link },
    } = await octokit.repos.listCommits({ owner, repo, sha, page, per_page: 100 });

    if (!link || page !== 1) {
      return data[data.length - 1].sha;
    }

    const parsedLink = parse(link);
    if (!parsedLink) {
      return data[data.length - 1].sha;
    }

    return request(parseInt(parsedLink.last.page, 10));
  };

  return request(1);
}

// Don't auto-execute in the test environment
// istanbul ignore next
if (process.env['NODE_ENV'] !== 'test') {
  run();
}

export default run;
