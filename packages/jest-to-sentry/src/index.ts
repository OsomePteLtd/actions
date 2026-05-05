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

  const suites = jsonData.testResults || [];

  suites.forEach((item: any) => {
    processTestSuite(item);
  });
}

function processTestSuite(spec: any) {
  const tests = spec.assertionResults || [];
  tests.forEach((test: any) => {
    if (test.status != 'failed') {
      return;
    }
    Sentry.withScope((scope: any) => {
      scope.setLevel('error');
      test.failureMessages.forEach((message: any) => {
        try {
          Sentry.addBreadcrumb({
            category: 'error',
            message: message.replace(/\u001b\[.*?m/g, ''),
            level: 'info',
          });
        } catch (error) {
          console.log(error);
        }
      });
      const sentryMessage = `test failed: "${test.fullName}"`;
      Sentry.captureMessage(sentryMessage);
    });
  });
}

const filePath = core.getInput('logfile');
try {
  parseJsonFile(filePath);
} catch (error: any) {
  console.log(error);
}
