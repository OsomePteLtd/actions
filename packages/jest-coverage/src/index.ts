import { promises as fs } from 'fs';
import * as core from '@actions/core';
import { CoverageMap, CoverageSummary, createCoverageMap } from 'istanbul-lib-coverage';
import * as istanbulReport from 'istanbul-lib-report';
import { resolve as pathResolve, join as pathJoin, isAbsolute as isAbsolutePath } from 'path';
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

function buildSummaryReport(coverageMap: CoverageMap, thresholds: Record<string, CoverageThreshold>) {
  const report: { [key: string]: {} } = {};
  const coverageResults: boolean[] = [];
  for (const [path, pathCoverageThreshold] of Object.entries(thresholds)) {
    const { summaryKey, coverageSummary } = getPathCoverageSummary(coverageMap, path, Object.keys(thresholds));
    report[summaryKey] = coverageSummary.toJSON();
    coverageResults.push(assertCoverageThresholdMet(path, coverageSummary, pathCoverageThreshold));
  }

  if (coverageResults.every(Boolean)) {
    core.info('\x1b[32m[jest-coverage] Coverage thresholds have been met');
  } else {
    core.setFailed('\x1b[31m[jest-coverage] Coverage thresholds have not been met');
  }

  return report;
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

// Mirrors Jest's coverageThreshold semantics: a key is either a path (file or
// directory prefix, resolved against cwd) or a glob. Files matched by any
// non-global key get their own threshold and are excluded from "global".
function matchesThresholdKey(filename: string, key: string): boolean {
  const absoluteKey = pathResolve(key);
  return filename.startsWith(absoluteKey) || minimatch(filename, absoluteKey, { dot: true });
}

function getPathCoverageSummary(coverage: CoverageMap, path: string, allPaths: string[] = [path]) {
  if (path === 'global') {
    const pathKeys = allPaths.filter((key) => key !== 'global');
    if (pathKeys.length === 0) {
      return { summaryKey: 'total', coverageSummary: coverage.getCoverageSummary() };
    }
    const globalCoverage = createCoverageMap(coverage.toJSON());
    globalCoverage.filter((filename) => !pathKeys.some((key) => matchesThresholdKey(filename, key)));
    return { summaryKey: 'total', coverageSummary: globalCoverage.getCoverageSummary() };
  }

  const pathCoverage = createCoverageMap(coverage.toJSON());
  pathCoverage.filter((filename) => matchesThresholdKey(filename, path));
  return { summaryKey: path, coverageSummary: pathCoverage.getCoverageSummary() };
}

// Don't auto-execute in the test environment
// istanbul ignore next
if (process.env['NODE_ENV'] !== 'test') {
  run();
}

export default run;
