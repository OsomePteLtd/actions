import * as core from '@actions/core';
import { readFileSync } from 'fs';

import * as Sentry from '@sentry/node';

const dsn = core.getInput('dsn');

Sentry.init({
  dsn: dsn,
  tracesSampleRate: 1.0,
  environment: core.getInput('environment'),
});

function parseJsonFile(filePath: string) {
  const fileContent = readFileSync(filePath, 'utf-8');
  const jsonData = JSON.parse(fileContent);

  parseTestSuite(jsonData);
}

function processSpec(spec: any) {
  const tests = spec.tests || [];
  let failed = false;
  tests.forEach((test: any) => {
    delete test.annotations;
    test.results = test.results || [];
    test.results = test.results.filter((result: any) => result.status == 'failed').slice(0, 1);

    if (test.status != 'expected' && test.status != 'skipped' && test.status != 'flaky') {
      failed = true;
      if (test.results.length > 0 && test.results[0].attachments) {
        delete test.results[0].attachments;
      }
    }
  });

  if (failed) {
    Sentry.withScope((scope: any) => {
      scope.setLevel('error');
      try {
        Sentry.addBreadcrumb({
          category: 'details',
          message: JSON.stringify(tests, null, 2),
          level: 'info',
        });
      } catch (error) {
        console.log(error);
      }
      try {
        Sentry.addBreadcrumb({
          category: 'error',
          message: tests[0].results[0].error.message.replace(/\u001b\[.*?m/g, ''),
          level: 'info',
        });
      } catch (error) {
        console.log(error);
      }
      try {
        Sentry.addBreadcrumb({
          category: 'stack',
          message: tests[0].results[0].error.stack.replace(/\u001b\[.*?m/g, ''),
          level: 'info',
        });
      } catch (error) {
        console.log(error);
      }
      const sentryMessage = `E2E failed: "${spec.title}"`;
      Sentry.captureMessage(sentryMessage);
    });
  }
}

function parseTestSuite(data: any) {
  const specs = data.specs || [];
  const suites = data.suites || [];

  specs.forEach((spec: any) => processSpec(spec));

  if (suites.length > 0) {
    suites.forEach((item: any) => {
      parseTestSuite(item);
    });
  }
}

const filePath = core.getInput('logfile');
try {
  parseJsonFile(filePath);
} catch (error: any) {
  core.setFailed(error.message);
}
