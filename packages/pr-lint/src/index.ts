import * as core from '@actions/core';
import * as github from '@actions/github';
import {
  ConfigError,
  Failure,
  loadTemplateContext,
  GUIDE_URL,
  Inputs,
  isBypassed,
  readInputs,
  validateChecklistSubsection,
  validateCheckboxes,
  validateSections,
  validateTitle,
} from './lib';

function collectFailures(body: string, title: string, headings: string[], inputs: Inputs): Failure[] {
  const failures: Failure[] = [];
  if (inputs.enforceTitle) {
    const titleFailure = validateTitle(title, inputs.titleRegex);
    if (titleFailure) failures.push(titleFailure);
  }
  const templateHeadings = inputs.enforceTemplateSections ? headings : [];
  failures.push(...validateSections(body, templateHeadings, inputs.floorSections, inputs.minChars));
  const subsectionFailure = validateChecklistSubsection(
    body,
    inputs.checklistHeading,
    inputs.requiredSubsection,
  );
  if (subsectionFailure) failures.push(subsectionFailure);
  const boxFailure = inputs.enforceTemplateSections
    ? validateCheckboxes(body)
    : validateCheckboxes(body, inputs.checklistHeading);
  if (boxFailure) failures.push(boxFailure);
  return failures;
}

async function reportFailures(failures: Failure[], mode: 'warn' | 'enforce'): Promise<void> {
  await writeStepSummary(failures, mode);
  if (mode === 'warn') {
    for (const f of failures) core.warning(`[${f.rule}] ${f.details}`);
    core.notice(
      `pr-lint (warn mode) found ${failures.length} issue(s) — not blocking. Fix before enforce mode is enabled.`,
    );
    return;
  }
  const summary = failures.map((f) => `❌ [${f.rule}] ${f.details}`).join('\n\n');
  core.setFailed(`pr-lint found ${failures.length} issue(s):\n\n${summary}\n\n${GUIDE_URL}`);
}

async function writeSkipSummary(heading: string, detail: string): Promise<void> {
  await core.summary.addHeading(heading).addRaw(`\n${detail}\n`).write();
}

async function writeStepSummary(failures: Failure[], mode: 'warn' | 'enforce'): Promise<void> {
  await core.summary
    .addHeading(`pr-lint — ${failures.length} issue(s) (${mode})`)
    .addRaw(mode === 'warn' ? '\n> Running in **warn** mode — check will not fail.\n' : '\n')
    .addList(failures.map((f) => `**${f.rule}**: ${f.details}`))
    .addRaw(`\n\n${GUIDE_URL}\n`)
    .write();
}

async function runPullRequest(pr: NonNullable<typeof github.context.payload.pull_request>, inputs: Inputs): Promise<void> {
  if (isBypassed(pr.labels, inputs.bypassLabel)) {
    await writeSkipSummary(
      `pr-lint SKIPPED — bypass label \`${inputs.bypassLabel}\``,
      `> Nothing was validated on this pull request.\n> The label \`${inputs.bypassLabel}\` is present, which disables the check for every future commit until it is removed.\n> Remove the label to re-enable pr-lint.`,
    );
    core.warning(
      `pr-lint SKIPPED — bypass label '${inputs.bypassLabel}' is present, so nothing was validated. It stays in effect for every future commit until removed.`,
    );
    return;
  }
  const { headings, skip } = await loadTemplateContext(inputs.templatePath, inputs.skipIfNoTemplate);
  if (skip) return;
  const title = (pr.title as string) || '';
  const body = (pr.body as string) || '';
  const failures = collectFailures(body, title, headings, inputs);
  if (failures.length === 0) {
    core.info('✅ pr-lint passed');
    return;
  }
  await reportFailures(failures, inputs.mode);
}

async function run(): Promise<void> {
  try {
    const inputs = readInputs();
    const pr = github.context.payload.pull_request;
    if (!pr) {
      core.info('Not a pull_request event — pr-lint has nothing to validate.');
      return;
    }
    await runPullRequest(pr, inputs);
  } catch (error) {
    if (error instanceof ConfigError) {
      core.setFailed(`pr-lint config error: ${error.message}`);
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(`pr-lint crashed: ${message}`);
  }
}

run();
