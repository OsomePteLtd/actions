import { promises as fs } from 'fs';
import * as core from '@actions/core';
import { CoverageMap, CoverageSummary, createCoverageMap } from 'istanbul-lib-coverage';
import * as istanbulReport from 'istanbul-lib-report';
import { resolve as pathResolve, join as pathJoin, isAbsolute as isAbsolutePath, sep as pathSeparator } from 'path';
import * as process from 'process';
import minimatch from 'minimatch';

import JsonReport from 'istanbul-reports/lib/json';
import TextReport from 'istanbul-reports/lib/text';

async function run() {
  try {
    core.info(`Checking code coverage with jest thresholds`);
    const coveragePath = core.getInput('coverage-directory', { required: true });
    const summaryDest = core.getInput('summary-destination', { required: true });

    const coverage = await getCoverageMap(coveragePath);
    const coverageThresholds = getCoverageThresholds();

    const context = istanbulReport.createContext({ coverageMap: coverage });

    context.getTree().visit(new JsonReport({}), context);
    context.getTree().visit(new TextReport({}), context);

    const report = buildSummaryReport(coverage, coverageThresholds);

    core.info(`[jest-coverage] Saving summary to ${summaryDest}`);
    await fs.writeFile(summaryDest, JSON.stringify(report, null, 2));
  } catch (error) {
    core.setFailed(error.message);
  }
}

async function getCoverageMap(coveragePath: string): Promise<CoverageMap> {
  const coverageMap = createCoverageMap();
  const coverageFilePattern = new RegExp(core.getInput('coverage-file-pattern', { required: true }));

  core.info(`[jest-coverage] Looking for jest coverage results: ${coveragePath}/${coverageFilePattern.source}`);
  const fileNames = (await fs.readdir(coveragePath)).filter((fileName) => coverageFilePattern.test(fileName));
  core.info(`[jest-coverage] Found files: [${fileNames}]`);

  for (const fileName of fileNames) {
    const coverageData = JSON.parse(await fs.readFile(pathJoin(coveragePath, fileName), 'utf-8'));
    coverageMap.merge(coverageData);
  }

  return coverageMap;
}

interface CoverageThreshold {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

function getCoverageThresholds(): Record<string, CoverageThreshold> {
  const jestConfigPathStr = core.getInput('jest-config-path', { required: true });
  const workspace = process.env.GITHUB_WORKSPACE as string;
  const jestConfigPath = isAbsolutePath(jestConfigPathStr) ? jestConfigPathStr : pathJoin(workspace, jestConfigPathStr);

  core.info(`[jest-coverage] Getting jest coverageThreshold from ${jestConfigPath}`);
  // eslint-disable-next-line @typescript-eslint/no-var-requires,global-require
  const { coverageThreshold } = require(jestConfigPath) as {
    coverageThreshold: Record<string, CoverageThreshold>;
  };

  return coverageThreshold;
}

// Mirrors Jest's coverageThreshold check (@jest/reporters CoverageReporter._checkThreshold):
// a key first matches files by its resolved literal path prefix; only when no file matches
// that way is it treated as a glob. Path groups are checked in aggregate, glob groups per
// file, and files matched by any non-global key are excluded from "global".
type ThresholdGroupType = 'path' | 'glob';

interface ThresholdGroup {
  key: string;
  type?: ThresholdGroupType;
  files: string[];
}

interface ThresholdResult {
  summaryKey: string;
  summary: CoverageSummary;
  passed: boolean;
}

function buildSummaryReport(coverageMap: CoverageMap, thresholds: Record<string, CoverageThreshold>) {
  const files = coverageMap.files();
  const groups = Object.keys(thresholds)
    .filter((key) => key !== 'global')
    .map((key) => getThresholdGroup(files, key));
  const groupedFiles = new Set(groups.flatMap((group) => group.files));

  const results = Object.entries(thresholds).map(([key, threshold]) =>
    key === 'global'
      ? checkGlobalThreshold(coverageMap, groupedFiles, groups, threshold)
      : checkThresholdGroup(coverageMap, groups.find((group) => group.key === key) as ThresholdGroup, threshold),
  );

  if (results.every((result) => result.passed)) {
    core.info('\x1b[32m[jest-coverage] Coverage thresholds have been met');
  } else {
    core.setFailed('\x1b[31m[jest-coverage] Coverage thresholds have not been met');
  }

  return Object.fromEntries(results.map((result) => [result.summaryKey, result.summary.toJSON()]));
}

function resolveThresholdKey(key: string): string {
  const absoluteKey = pathResolve(key);
  // Keep the trailing separator, so './src/controllers/' does not match 'src/controllers-extra/'.
  const hasTrailingSeparator = key.endsWith('/') || key.endsWith(pathSeparator);
  return hasTrailingSeparator && !absoluteKey.endsWith(pathSeparator) ? absoluteKey + pathSeparator : absoluteKey;
}

function getThresholdGroup(files: string[], key: string): ThresholdGroup {
  const absoluteKey = resolveThresholdKey(key);
  const pathFiles = files.filter((filename) => filename.startsWith(absoluteKey));
  if (pathFiles.length > 0) {
    return { key, type: 'path', files: pathFiles };
  }
  const globFiles = files.filter((filename) => matchesGlob(filename, absoluteKey));
  return { key, type: globFiles.length > 0 ? 'glob' : undefined, files: globFiles };
}

function matchesGlob(filename: string, absoluteKey: string): boolean {
  return minimatch(filename, absoluteKey);
}

function summarizeFiles(coverageMap: CoverageMap, files: string[]): CoverageSummary {
  const included = new Set(files);
  const scopedCoverage = createCoverageMap(coverageMap.toJSON());
  scopedCoverage.filter((filename) => included.has(filename));
  return scopedCoverage.getCoverageSummary();
}

function checkThresholdGroup(
  coverageMap: CoverageMap,
  group: ThresholdGroup,
  threshold: CoverageThreshold,
): ThresholdResult {
  const summary = summarizeFiles(coverageMap, group.files);
  if (group.type !== 'glob') {
    return { summaryKey: group.key, summary, passed: assertCoverageThresholdMet(group.key, summary, threshold) };
  }
  // Jest checks every file matched by a glob key against the threshold on its own.
  const passed = group.files.map((filename) => checkFileThreshold(coverageMap, filename, threshold)).every(Boolean);
  return { summaryKey: group.key, summary, passed };
}

function checkFileThreshold(coverageMap: CoverageMap, filename: string, threshold: CoverageThreshold): boolean {
  const fileSummary = coverageMap.fileCoverageFor(filename).toSummary();
  return assertCoverageThresholdMet(filename, fileSummary, threshold);
}

function checkGlobalThreshold(
  coverageMap: CoverageMap,
  groupedFiles: Set<string>,
  groups: ThresholdGroup[],
  threshold: CoverageThreshold,
): ThresholdResult {
  const allFiles = coverageMap.files();
  const globalFiles = allFiles.filter((filename) => !groupedFiles.has(filename));
  const summary = summarizeFiles(coverageMap, globalFiles);
  const excluded = groups.length
    ? groups.map((group) => `"${group.key}" (${group.type ?? 'no match'})`).join(', ')
    : 'none';
  core.info(
    `[jest-coverage] global: ${globalFiles.length}/${allFiles.length} files ` +
      `(excluded keys: ${excluded}): ${formatSummary(summary)}`,
  );
  return { summaryKey: 'total', summary, passed: assertCoverageThresholdMet('global', summary, threshold) };
}

function assertCoverageThresholdMet(path: string, summary: CoverageSummary, threshold: CoverageThreshold) {
  const failedThresholds = Object.keys(threshold).flatMap((key) => {
    const value = threshold[key as keyof CoverageThreshold];
    const actual = summary.data[key as keyof CoverageThreshold].pct;
    if (actual < value) {
      core.error(`\x1b[31m[jest-coverage] "${path}" coverage threshold for ${key} (${value}%) not met: ${actual}%`);
      return [{ key, actual, value }];
    }
    return [];
  });

  return failedThresholds.length <= 0;
}

function formatSummary(summary: CoverageSummary): string {
  const { statements, branches, functions, lines } = summary.data;
  return `statements ${statements.pct}%, branches ${branches.pct}%, functions ${functions.pct}%, lines ${lines.pct}%`;
}

// Don't auto-execute in the test environment
// istanbul ignore next
if (process.env['NODE_ENV'] !== 'test') {
  run();
}

export default run;
