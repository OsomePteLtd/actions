import * as core from '@actions/core';
import * as github from '@actions/github';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

interface ParsedTemplate {
  requiredHeadings: string[];
  optionalHeadings: string[];
  templateCheckboxCount: number;
}

interface Failure {
  rule: string;
  details: string;
}

const TITLE_REGEX =
  /^(feat|fix|chore|refactor|test|docs|perf|infra|task|revert)(\([^)]+\))?: .+\s\[[A-Z]+-\d+\]\s*$/;
const NA_REGEX = /\bn\/?a\b/i;
const CHECKBOX_UNCHECKED_REGEX = /^(\s*-\s*\[\s\])\s+(.+)$/gm;
const CHECKBOX_ANY_STATE_REGEX = /^\s*-\s*\[[\sx]\]\s+(.+)$/i;
const HEADING_REGEX = /^##\s+(.+?)\s*$/;

function stripHtmlComments(md: string): string {
  return md.replace(/<!--[\s\S]*?-->/g, '');
}

function parseTemplate(md: string): ParsedTemplate {
  const stripped = stripHtmlComments(md);
  const requiredHeadings: string[] = [];
  const optionalHeadings: string[] = [];
  for (const line of stripped.split(/\r?\n/)) {
    const m = line.match(HEADING_REGEX);
    if (!m) continue;
    const heading = m[1].trim();
    if (/^conditional:/i.test(heading)) optionalHeadings.push(heading);
    else requiredHeadings.push(heading);
  }
  const checkboxes = (stripped.match(/^\s*-\s*\[\s\]/gm) || []).length;
  return { requiredHeadings, optionalHeadings, templateCheckboxCount: checkboxes };
}

function extractSection(body: string, heading: string): string | null {
  const escaped = heading.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const re = new RegExp(`^##\\s+${escaped}\\s*$`, 'm');
  const m = re.exec(body);
  if (!m) return null;
  const start = m.index + m[0].length;
  const rest = body.slice(start);
  const next = rest.match(/^##\s+/m);
  const end = next ? start + (next.index ?? 0) : body.length;
  return body.slice(start, end).trim();
}

function isSubstantive(content: string, minChars: number): boolean {
  const stripped = stripHtmlComments(content).replace(/\s+/g, ' ').trim();
  if (NA_REGEX.test(stripped)) return true;
  return stripped.length >= minChars;
}

function findUnresolvedCheckboxes(body: string): string[] {
  const stripped = stripHtmlComments(body);
  const unresolved: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(CHECKBOX_UNCHECKED_REGEX.source, CHECKBOX_UNCHECKED_REGEX.flags);
  while ((m = re.exec(stripped)) !== null) {
    const label = m[2].trim();
    if (NA_REGEX.test(label)) continue;
    unresolved.push(label);
  }
  return unresolved;
}

function parseCsvList(input: string): string[] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function checklistCoversTopic(
  body: string,
  checklistHeading: string,
  topicPattern: string,
): { covered: boolean; sectionPresent: boolean } {
  const section = extractSection(body, checklistHeading);
  if (section === null) return { covered: false, sectionPresent: false };
  const stripped = stripHtmlComments(section);
  const topicRe = new RegExp(topicPattern, 'i');
  for (const line of stripped.split(/\r?\n/)) {
    const boxMatch = line.match(CHECKBOX_ANY_STATE_REGEX);
    if (!boxMatch) continue;
    if (topicRe.test(boxMatch[1])) return { covered: true, sectionPresent: true };
  }
  return { covered: false, sectionPresent: true };
}

async function readWorkspaceFile(templatePath: string): Promise<string | null> {
  const workspace = process.env.GITHUB_WORKSPACE || '.';
  try {
    return await readFile(resolve(workspace, templatePath), 'utf8');
  } catch {
    return null;
  }
}

async function run(): Promise<void> {
  try {
    const templatePath = core.getInput('template-path') || '.github/pull_request_template.md';
    const bypassLabel = core.getInput('bypass-label') || 'pr-lint-skip';
    const minChars = Number.parseInt(core.getInput('min-section-chars') || '20', 10);
    const floorSectionsInput = core.getInput('required-sections') || 'Checklist';
    const checklistHeading = core.getInput('checklist-section') || 'Checklist';
    const topicPattern = core.getInput('required-checklist-topic-pattern') || '';
    const skipIfNoTemplate = (core.getInput('skip-if-no-template') || 'true').toLowerCase() === 'true';
    const mode = ((core.getInput('mode') || 'enforce').toLowerCase() === 'warn' ? 'warn' : 'enforce') as
      | 'warn'
      | 'enforce';

    const floorSections = parseCsvList(floorSectionsInput);

    const pr = github.context.payload.pull_request;
    if (!pr) {
      core.info('Not a pull_request event — pr-lint has nothing to validate.');
      return;
    }

    const labels: string[] = ((pr.labels as Array<{ name?: string }>) || [])
      .map((l) => l.name)
      .filter((n): n is string => typeof n === 'string');
    if (labels.includes(bypassLabel)) {
      core.notice(`Bypass label '${bypassLabel}' present — pr-lint skipped.`);
      return;
    }

    const title = (pr.title as string) || '';
    const body = (pr.body as string) || '';
    const failures: Failure[] = [];

    if (!TITLE_REGEX.test(title.trim())) {
      failures.push({
        rule: 'title-format',
        details: `Title must match \`<type>(<scope>): <description> [JIRA-ID]\`. Got: \`${title}\``,
      });
    }

    const template = await readWorkspaceFile(templatePath);
    const templateHeadings: string[] = [];
    if (template) {
      const parsed = parseTemplate(template);
      templateHeadings.push(...parsed.requiredHeadings);
      core.info(
        `Template loaded: ${parsed.requiredHeadings.length} required section(s), ${parsed.optionalHeadings.length} conditional, ${parsed.templateCheckboxCount} template checkboxes.`,
      );
    } else if (skipIfNoTemplate) {
      core.notice(
        `No PR template found at ${templatePath}. Skipping pr-lint (skip-if-no-template=true). Set input to "false" to enforce floor rules (Checklist + doc/knowledge topic) here anyway.`,
      );
      return;
    } else {
      core.warning(
        `No template found at ${templatePath} in workspace. Consumer must \`actions/checkout\` before running pr-lint. Falling back to floor rules only.`,
      );
    }

    const effectiveRequired = Array.from(new Set([...templateHeadings, ...floorSections]));
    core.info(
      `Effective required sections: ${effectiveRequired.join(', ')} (floor: ${floorSections.join(', ') || '(none)'})`,
    );

    for (const heading of effectiveRequired) {
      const content = extractSection(body, heading);
      if (content === null) {
        const isFloor = floorSections.includes(heading) && !templateHeadings.includes(heading);
        failures.push({
          rule: isFloor ? 'missing-floor-section' : 'missing-section',
          details: `Required section \`## ${heading}\` is missing from the PR body${
            isFloor ? ' (org-wide floor requirement)' : ''
          }.`,
        });
        continue;
      }
      if (!isSubstantive(content, minChars)) {
        failures.push({
          rule: 'empty-section',
          details: `Section \`## ${heading}\` is empty — write ≥${minChars} chars or "n/a — reason".`,
        });
      }
    }

    if (topicPattern) {
      const topicResult = checklistCoversTopic(body, checklistHeading, topicPattern);
      if (!topicResult.sectionPresent) {
        core.info(
          `Skipping topic-coverage check — \`## ${checklistHeading}\` section is missing (already reported above).`,
        );
      } else if (!topicResult.covered) {
        failures.push({
          rule: 'checklist-topic-missing',
          details: `Section \`## ${checklistHeading}\` must contain at least one checkbox line matching \`/${topicPattern}/i\` (e.g. documentation & knowledge maintenance). Add or restore the item.`,
        });
      }
    }

    if (template) {
      const unresolved = findUnresolvedCheckboxes(body);
      if (unresolved.length > 0) {
        failures.push({
          rule: 'unresolved-checkboxes',
          details: `${unresolved.length} unresolved checkbox(es) in PR body — tick each, or write "n/a — reason" in the line:\n${unresolved
            .map((l) => `  - ${l}`)
            .join('\n')}`,
        });
      }
    }

    if (failures.length === 0) {
      core.info('✅ pr-lint passed');
      return;
    }

    const summary = failures.map((f) => `❌ [${f.rule}] ${f.details}`).join('\n\n');
    const guide =
      'Full guide: https://app.notion.com/p/osome/PR-review-checklist-3a094fd5a8ec8019b75acfc88160323f';
    const message = `pr-lint found ${failures.length} issue(s):\n\n${summary}\n\n${guide}`;

    await core.summary
      .addHeading(`pr-lint — ${failures.length} issue(s) (${mode})`)
      .addRaw(mode === 'warn' ? '\n> Running in **warn** mode — check will not fail.\n' : '\n')
      .addList(failures.map((f) => `**${f.rule}**: ${f.details}`))
      .addRaw(`\n\n${guide}\n`)
      .write();

    if (mode === 'warn') {
      for (const f of failures) core.warning(`[${f.rule}] ${f.details}`);
      core.notice(`pr-lint (warn mode) found ${failures.length} issue(s) — not blocking. Fix before enforce mode is enabled.`);
      return;
    }

    core.setFailed(message);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(`pr-lint crashed: ${message}`);
  }
}

run();
