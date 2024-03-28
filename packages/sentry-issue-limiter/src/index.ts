import * as core from '@actions/core';

type StatsPeriod = '24h' | '14h';
type StatTimestamp = number;
type StatCount = number;
type Stat = [StatTimestamp, StatCount];
type Issue = {
  title: string,
  stats: Record<StatsPeriod, Stat[]>;
};

const sentryApiToken = core.getInput('sentryApiToken');
const organizationSlug = core.getInput('organizationSlug');
const projectSlug = core.getInput('projectSlug');
const thresholdStr = core.getInput('threshold');
const statsPeriod = core.getInput('statsPeriod') as StatsPeriod;
const environment = core.getInput('environment');
const query = core.getInput('query');

function makeSentryIssueUrl() {
  const sentryUrlApi = 'https://sentry.io/api/0';
  const url = new URL(`${sentryUrlApi}/projects/${organizationSlug}/${projectSlug}/issues/`);
  const searchParams = new URLSearchParams();
  searchParams.append('environment', environment);
  searchParams.append('statsPeriod', statsPeriod);
  searchParams.append('query', query);
  url.search = searchParams.toString();
  return url;
}

async function fetchIssues(): Promise<Issue[] | null> {
  const url = makeSentryIssueUrl();
  const options = {
    headers: {
      Authorization: `Bearer ${sentryApiToken}`,
      'Content-Type': 'application/json',
    },
  };
  try {
    const response = await fetch(url.toString(), options);
    if (!response.ok) {
      core.setFailed(`Failed to fetch issues: ${response.statusText}`);
      return null;
    }
    const data = await response.json();
    return data as Issue[];
  } catch (error) {
    return null;
  }
}

function addStatValue(sum: number, stat: Stat): number {
  return sum + stat[1];
}

function getCountOfIssueEvents(issue: Issue): number {
  return issue.stats[statsPeriod]?.reduce(addStatValue, 0);
}

function isEveythingGood(issues: Issue[]): boolean {
  const threshold = parseInt(thresholdStr || '', 10);
  const issuesbyPeriod = issues.filter((issue) => getCountOfIssueEvents(issue) > 0);
  return issuesbyPeriod.length <= threshold;
}

async function checkNewErrors() {
  const issues = await fetchIssues();
  if (!issues) {
    core.setFailed('Failed to fetch issues. Please check your Sentry credentials and try again.');
    return;
  }
  if (!isEveythingGood(issues)) {
    printIssues(issues);
    core.setFailed(`The unresolved issue limit has been lifted. Please, resolve all issues in project.`);
  }
}

function printIssues(issues: Issue[]) {
  console.log(`Number of issues: ${issues.length}`);
  console.log('Current issues:');
  issues.forEach((issue) => {
    console.log(`- ${issue.title}`);
  });
}

checkNewErrors();
