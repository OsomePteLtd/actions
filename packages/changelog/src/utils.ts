import * as core from '@actions/core';
import * as github from '@actions/github';
import { GitHub } from '@actions/github/lib/utils';
import { EventPayloads } from '@octokit/webhooks';
import { WebClient } from '@slack/web-api';
import { promises as fs } from 'fs';
import JiraClient from 'jira-client';
import uniqBy from 'lodash/uniqBy';
import { ChangelogAuthor } from './types';

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
  return status;
};

export const getIcon = (type: string) => {
  switch (type) {
    case 'Story':
      return '📗';
    case 'Task':
    case 'Sub-task':
    case 'Subtask':
    case 'Agent Task':
      return '📘';
    case 'Bug':
      return '📕';
    case 'Epic':
    case 'Initiative':
      return '📓';
    case 'Spike':
      return '📔';
    default:
      return '📙';
  }
};

// Short probes like "abc" would match half of the directory.
const MIN_MATCH_LENGTH = 4;

type SlackMember = {
  id: string;
  deleted?: boolean;
  is_bot?: boolean;
  real_name?: string;
  profile?: { email?: string; real_name?: string; display_name?: string };
};

let slackMembersRequest: Promise<SlackMember[]> | null = null;

const fetchSlackMembers = async (): Promise<SlackMember[]> => {
  const slack = getSlack();
  const members: SlackMember[] = [];

  try {
    let cursor: string | undefined;
    do {
      const page = await slack.users.list({ limit: 200, cursor });
      members.push(...((page.members as SlackMember[] | undefined) || []));
      cursor = page.response_metadata?.next_cursor || undefined;
    } while (cursor);
  } catch (err) {
    // The app needs the users:read scope to list members. Without it we keep the GitHub link.
    core.warning(`Unable to read the Slack directory: ${err}`);
  }

  return members;
};

const getSlackMembers = () => (slackMembersRequest = slackMembersRequest || fetchSlackMembers());

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const getMemberKeys = (member: SlackMember) =>
  [member.profile?.email?.split('@')[0], member.profile?.real_name, member.profile?.display_name, member.real_name]
    .map((value) => normalize(value || ''))
    .filter((value) => value.length >= MIN_MATCH_LENGTH);

const covers = (key: string, probe: string) => key.includes(probe) || probe.includes(key);

export const matchSlackMember = (members: SlackMember[], probes: (string | undefined)[]): string | null => {
  const normalizedProbes = probes
    .map((probe) => normalize(probe || ''))
    .filter((probe) => probe.length >= MIN_MATCH_LENGTH);

  if (!normalizedProbes.length) return null;

  const matchedIds = new Set(
    members
      .filter((member) => !member.deleted && !member.is_bot)
      .filter((member) => getMemberKeys(member).some((key) => normalizedProbes.some((probe) => covers(key, probe))))
      .map((member) => member.id),
  );

  // Two candidates mean we cannot tell the people apart, so we do not guess.
  return matchedIds.size === 1 ? [...matchedIds][0] : null;
};

export const getCoauthors = (message: string): ChangelogAuthor[] => {
  const emails = message
    .split('\n')
    .map((line) => line.match(/Co-authored-by:.*<(?<email>.*)>/)?.groups?.email)
    .filter((email) => email?.endsWith('osome.com')) as string[];
  return [...new Set(emails)].map((email) => ({ email }));
};

export const joinAuthors = async (authors: ChangelogAuthor[]) => {
  const slack = getSlack();

  const uniqueAuthors = uniqBy(authors, 'email');
  const enrichedAuthors = await Promise.all(
    uniqueAuthors.map(async (author) => {
      const slackUser = await slack.users.lookupByEmail({ email: author.email }).catch(() => null);
      if (slackUser?.ok) return `<@${(slackUser as any).user.id}>`;

      const memberId = matchSlackMember(await getSlackMembers(), [author.login, author.name]);
      if (memberId) return `<@${memberId}>`;

      if (author.login) {
        core.info(`No Slack user found for ${author.login} <${author.email}>, linking GitHub profile instead`);
        return `*<https://github.com/${author.login}|${author.login}>*`;
      }
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
