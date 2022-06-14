import * as core from '@actions/core';
import * as github from '@actions/github';
import { GitHub } from '@actions/github/lib/utils';
import { EventPayloads } from '@octokit/webhooks';
import { WebClient } from '@slack/web-api';
import { promises as fs } from 'fs';
import JiraClient from 'jira-client';
import uniqBy from 'lodash/uniqBy';
import JobStatus from 'job-status';

let event: EventPayloads.WebhookPayloadDeployment | null = null;
export const getEvent = async (): Promise<EventPayloads.WebhookPayloadDeployment> => {
  if (event) return event;
  return (event = await fs.readFile(process.env.GITHUB_EVENT_PATH!).then((buffer) => JSON.parse(buffer.toString())));
};

export const getJira = () => {
  const host = core.getInput('jira-host', { required: true });
  const username = core.getInput('jira-username', { required: true });
  const password = core.getInput('jira-password', { required: true });
  return new JiraClient({ host, username, password });
};

let octokit: InstanceType<typeof GitHub> | null = null;
export const getOctokit = () => {
  if (octokit) return octokit;
  const token = core.getInput('token', { required: true });
  return (octokit = github.getOctokit(token));
};

let slack: WebClient | null = null;
export const getSlack = () => {
  if (slack) return slack;
  const token = core.getInput('slack-token', { required: true });
  return (slack = new WebClient(token));
};

export const getStatus = () => {
  const status = core.getInput('job-status' , { required: false });
  return new JobStatus({status})
};

export const getIcon = (type: string) => {
  switch (type) {
    case 'Story':
      return '📗';
    case 'Task':
    case 'Subtask':
      return '📘';
    case 'Bug':
      return '📕';
    default:
      return '📙';
  }
};

export const getCoauthors = (message: string): { email: string }[] => {
  const emails = message
    .split('\n')
    .map((line) => line.match(/Co-authored-by:.*<(?<email>.*)>/)?.groups?.email)
    .filter((email) => email?.endsWith('osome.com')) as string[];
  return [...new Set(emails)].map((email) => ({ email }));
};

export const joinAuthors = async (authors: { email: string; login?: string }[]) => {
  const slack = getSlack();

  const uniqueAuthors = uniqBy(authors, 'email');
  const enrichedAuthors = await Promise.all(
    uniqueAuthors.map(async (author) => {
      const slackUser = await slack.users.lookupByEmail({ email: author.email }).catch(() => null);
      if (slackUser?.ok) return `<@${(slackUser as any).user.id}>`;
      if (author.login) return `*<https://github.com/${author.login}|${author.login}>*`;
      return null;
    }),
  );

  if (enrichedAuthors.length === 1) {
    const [author] = enrichedAuthors;
    return `by ${author}`;
  }

  const lastAuthor = enrichedAuthors.splice(-1, 1);
  return `by ${enrichedAuthors.join(', ')} and ${lastAuthor}`;
};
