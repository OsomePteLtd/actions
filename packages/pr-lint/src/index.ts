import * as core from '@actions/core';
import * as github from '@actions/github';
import {
  Failure,
  GUIDE_URL,
  Inputs,
  isBypassed,
  parseTemplate,
  readInputs,
  readWorkspaceFile,
  validateChecklistSubsection,
  validateCheckboxes,
  validateSections,
  validateTitle,
} from './lib';

interface TemplateContext {
  headings: string[];
  skip: boolean;
}

async function loadTemplateContext(
  templatePath: string,
  skipIfNoTemplate: boolean,
): Promise<TemplateContext> {
  const template = await readWorkspaceFile(templatePath);
  if (template) return loadedTemplateContext(template);
  return absentTemplateContext(templatePath, skipIfNoTemplate);
}

function loadedTemplateContext(template: string): TemplateContext {
  const parsed = parseTemplate(template);
  core.info(
    `Template loaded: ${parsed.requiredHeadings.length} required section(s), ${parsed.optionalHeadings.length} conditional, ${parsed.templateCheckboxCount} template checkboxes.`,
  );
  return { headings: parsed.requiredHeadings, skip: false };
}

function absentTemplateContext(templatePath: string, skipIfNoTemplate: boolean): TemplateContext {
  if (skipIfNoTemplate) {
    core.notice(
      `No PR template found at ${templatePath}. Skipping pr-lint (skip-if-no-template=true). Set input to "false" to enforce floor rules (Checklist + doc/knowledge topic) here anyway.`,
    );
    return { headings: [], skip: true };
  }
  core.warning(
    `No template found at ${templatePath} in workspace. Consumer must \`actions/checkout\` before running pr-lint. Falling back to floor rules only.`,
  );
  return { headings: [], skip: false };
}

function collectFailures(body: string, title: string, headings: string[], inputs: Inputs): Failure[] {
  const failures: Failure[] = [];
  const titleFailure = validateTitle(title);
  if (titleFailure) failures.push(titleFailure);
  failures.push(...validateSections(body, headings, inputs.floorSections, inputs.minChars));
  const subsectionFailure = validateChecklistSubsection(
    body,
    inputs.checklistHeading,
    inputs.requiredSubsection,
  );
  if (subsectionFailure) failures.push(subsectionFailure);
  const boxFailure = validateCheckboxes(body);
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
    core.notice(`Bypass label '${inputs.bypassLabel}' present — pr-lint skipped.`);
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
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(`pr-lint crashed: ${message}`);
  }
}

run();
