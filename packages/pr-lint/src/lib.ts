import * as core from '@actions/core';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

export interface ParsedTemplate {
  requiredHeadings: string[];
  optionalHeadings: string[];
  templateCheckboxCount: number;
}

export interface Failure {
  rule: string;
  details: string;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export interface Inputs {
  templatePath: string;
  bypassLabel: string;
  exemptAuthors: string[];
  exemptBotAuthors: boolean;
  minChars: number;
  floorSections: string[];
  checklistHeading: string;
  requiredSubsection: string;
  enforceTitle: boolean;
  titleRegex: RegExp;
  enforceTemplateSections: boolean;
  skipIfNoTemplate: boolean;
  mode: 'warn' | 'enforce';
}

const ISSUE_TYPE = '[a-z][a-z-]*';
const SCOPE = '\\([^)]+\\)';
const JIRA_KEY = '[A-Z][A-Z0-9_]*-\\d+';
export const TITLE_REGEX = new RegExp(
  `^${ISSUE_TYPE}(?:${SCOPE})?: .+\\s\\[${JIRA_KEY}(?:\\s*,\\s*${JIRA_KEY})*\\]\\s*$`,
);
export const NA_REGEX = /\bn\/?a\b/i;
export const CHECKBOX_UNCHECKED_REGEX = /^(\s*-\s*\[\s\])\s+(.+)$/gm;
export const CHECKBOX_ANY_STATE_REGEX = /^\s*-\s*\[[\sxX]\]\s+(.+)$/;
export const HEADING_REGEX = /^##\s+(.+?)\s*$/;
export const SUBSECTION_REGEX = /^(?:\*\*(.+?)\*\*|#{3,6}\s+(.+?))\s*:?\s*$/;
export const DEFAULT_MIN_CHARS = 20;
export const DEFAULT_REQUIRED_SUBSECTION = 'Documentation & knowledge maintenance';
export const GUIDE_URL =
  'https://app.notion.com/p/osome/PR-review-checklist-3a094fd5a8ec8019b75acfc88160323f';

export function stripHtmlComments(md: string): string {
  return md.replace(/<!--[\s\S]*?-->/g, '');
}

export function parseCsvList(input: string): string[] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function parseMinChars(raw: string, onFallback?: (reason: string) => void): number {
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    onFallback?.(
      `min-section-chars "${raw}" is not a non-negative integer — falling back to default ${DEFAULT_MIN_CHARS}.`,
    );
    return DEFAULT_MIN_CHARS;
  }
  return parsed;
}

export function classifyHeading(line: string, required: string[], optional: string[]): void {
  const match = line.match(HEADING_REGEX);
  if (!match) return;
  const heading = match[1].trim();
  if (/^conditional:/i.test(heading)) optional.push(heading);
  else required.push(heading);
}

export function parseTemplate(md: string): ParsedTemplate {
  const stripped = stripHtmlComments(md);
  const requiredHeadings: string[] = [];
  const optionalHeadings: string[] = [];
  for (const line of stripped.split(/\r?\n/)) {
    classifyHeading(line, requiredHeadings, optionalHeadings);
  }
  const checkboxes = (stripped.match(/^\s*-\s*\[\s\]/gm) || []).length;
  return { requiredHeadings, optionalHeadings, templateCheckboxCount: checkboxes };
}

export function extractSection(body: string, heading: string): string | null {
  const escaped = heading.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const re = new RegExp(`^##\\s+${escaped}\\s*$`, 'im');
  const m = re.exec(body);
  if (!m) return null;
  const start = m.index + m[0].length;
  const rest = body.slice(start);
  const next = rest.match(/^##\s+/m);
  const end = next ? start + (next.index ?? 0) : body.length;
  return body.slice(start, end).trim();
}

export function isSubstantive(content: string, minChars: number): boolean {
  const stripped = stripHtmlComments(content).replace(/\s+/g, ' ').trim();
  if (NA_REGEX.test(stripped)) return true;
  return stripped.length >= minChars;
}

export function findUnresolvedCheckboxes(body: string): string[] {
  const stripped = stripHtmlComments(body);
  const unresolved: string[] = [];
  const re = new RegExp(CHECKBOX_UNCHECKED_REGEX.source, CHECKBOX_UNCHECKED_REGEX.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(stripped)) !== null) {
    const label = match[2].trim();
    if (!NA_REGEX.test(label)) unresolved.push(label);
  }
  return unresolved;
}

export interface ChecklistSubsection {
  label: string;
  items: string[];
}

export function findChecklistSubsections(section: string): ChecklistSubsection[] {
  const subsections: ChecklistSubsection[] = [];
  let current: ChecklistSubsection | null = null;
  for (const line of stripHtmlComments(section).split(/\r?\n/)) {
    const heading = line.match(SUBSECTION_REGEX);
    if (heading) {
      current = { label: (heading[1] ?? heading[2]).trim(), items: [] };
      subsections.push(current);
      continue;
    }
    const box = line.match(CHECKBOX_ANY_STATE_REGEX);
    if (current && box) current.items.push(box[1].trim());
  }
  return subsections;
}

export function compileTitleRegex(pattern: string): RegExp {
  if (!pattern) return TITLE_REGEX;
  try {
    return new RegExp(pattern);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ConfigError(
      `Invalid title-pattern "${pattern}" — not a valid regex. Fix the workflow input. (${message})`,
    );
  }
}

export function validateTitle(title: string, titleRegex: RegExp = TITLE_REGEX): Failure | null {
  if (titleRegex.test(title.trim())) return null;
  return {
    rule: 'title-format',
    details: `Title does not match the expected format \`${titleRegex.source}\`. Got: \`${title}\``,
  };
}

export function validateSection(
  body: string,
  heading: string,
  isFloor: boolean,
  minChars: number,
): Failure | null {
  const content = extractSection(body, heading);
  if (content === null) return missingSectionFailure(heading, isFloor);
  if (!isSubstantive(content, minChars)) return emptySectionFailure(heading, minChars);
  return null;
}

function missingSectionFailure(heading: string, isFloor: boolean): Failure {
  return {
    rule: isFloor ? 'missing-floor-section' : 'missing-section',
    details: `Required section \`## ${heading}\` is missing from the PR body${
      isFloor ? ' (org-wide floor requirement)' : ''
    }.`,
  };
}

function emptySectionFailure(heading: string, minChars: number): Failure {
  return {
    rule: 'empty-section',
    details: `Section \`## ${heading}\` is empty — write ≥${minChars} chars or "n/a — reason".`,
  };
}

export function effectiveRequiredHeadings(
  templateHeadings: string[],
  floorSections: string[],
): string[] {
  return Array.from(new Set([...templateHeadings, ...floorSections]));
}

export function validateSections(
  body: string,
  templateHeadings: string[],
  floorSections: string[],
  minChars: number,
): Failure[] {
  const effective = effectiveRequiredHeadings(templateHeadings, floorSections);
  const templateSet = new Set(templateHeadings);
  const floorSet = new Set(floorSections);
  return effective
    .map((h) => validateSection(body, h, floorSet.has(h) && !templateSet.has(h), minChars))
    .filter((f): f is Failure => f !== null);
}

export function validateChecklistSubsection(
  body: string,
  checklistHeading: string,
  requiredSubsection: string,
): Failure | null {
  if (!requiredSubsection) return null;
  const section = extractSection(body, checklistHeading);
  if (section === null) return null;
  const wanted = requiredSubsection.trim().toLowerCase();
  const match = findChecklistSubsections(section).find((s) => s.label.toLowerCase() === wanted);
  if (!match) return subsectionMissingFailure(checklistHeading, requiredSubsection);
  if (match.items.length === 0) return subsectionEmptyFailure(checklistHeading, requiredSubsection);
  return null;
}

function subsectionMissingFailure(checklistHeading: string, required: string): Failure {
  return {
    rule: 'checklist-subsection-missing',
    details: `Section \`## ${checklistHeading}\` must contain a sub-section headed \`**${required}**\`. Add it with at least one item. Sub-headings are bold lines (\`**${required}**\`) or \`### ${required}\`.`,
  };
}

function subsectionEmptyFailure(checklistHeading: string, required: string): Failure {
  return {
    rule: 'checklist-subsection-empty',
    details: `Sub-section \`**${required}**\` under \`## ${checklistHeading}\` has no checklist items. Add at least one.`,
  };
}

export function validateCheckboxes(body: string, scopeHeading?: string): Failure | null {
  const scoped = scopeHeading ? (extractSection(body, scopeHeading) ?? '') : body;
  const unresolved = findUnresolvedCheckboxes(scoped);
  if (unresolved.length === 0) return null;
  const listed = unresolved.map((l) => `  - ${l}`).join('\n');
  return {
    rule: 'unresolved-checkboxes',
    details: `${unresolved.length} unresolved checkbox(es)${
      scopeHeading ? ` in \`## ${scopeHeading}\`` : ' in PR body'
    } — tick each, or write "n/a — reason" in the line:\n${listed}`,
  };
}

export async function readWorkspaceFile(templatePath: string): Promise<string | null> {
  const workspace = process.env.GITHUB_WORKSPACE || '.';
  try {
    return await readFile(resolve(workspace, templatePath), 'utf8');
  } catch {
    return null;
  }
}

export function readInputs(): Inputs {
  const modeRaw = (core.getInput('mode') || 'enforce').toLowerCase();
  return {
    templatePath: core.getInput('template-path') || '.github/pull_request_template.md',
    bypassLabel: core.getInput('bypass-label') || 'pr-lint-skip',
    exemptAuthors: parseCsvList(core.getInput('exempt-authors') || ''),
    exemptBotAuthors: (core.getInput('exempt-bot-authors') || 'true').toLowerCase() === 'true',
    minChars: parseMinChars(core.getInput('min-section-chars') || String(DEFAULT_MIN_CHARS), (msg) =>
      core.warning(msg),
    ),
    floorSections: parseCsvList(core.getInput('required-sections') || 'Checklist'),
    checklistHeading: core.getInput('checklist-section') || 'Checklist',
    requiredSubsection:
      core.getInput('required-checklist-subsection') || DEFAULT_REQUIRED_SUBSECTION,
    enforceTitle: (core.getInput('enforce-title') || 'true').toLowerCase() === 'true',
    titleRegex: compileTitleRegex(core.getInput('title-pattern') || ''),
    enforceTemplateSections:
      (core.getInput('enforce-template-sections') || 'true').toLowerCase() === 'true',
    skipIfNoTemplate: (core.getInput('skip-if-no-template') || 'true').toLowerCase() === 'true',
    mode: modeRaw === 'warn' ? 'warn' : 'enforce',
  };
}

export function extractLabelNames(rawLabels: unknown): string[] {
  if (!Array.isArray(rawLabels)) return [];
  return rawLabels
    .map((l) => (l && typeof l === 'object' ? (l as { name?: unknown }).name : undefined))
    .filter((n): n is string => typeof n === 'string');
}

export function isBypassed(rawLabels: unknown, bypassLabel: string): boolean {
  return extractLabelNames(rawLabels).includes(bypassLabel);
}

// Deliberately checks the PR author (payload `pull_request.user`), not
// `github.actor`: the actor changes on synchronize/labeled events, while the
// body attestation belongs to whoever authored the PR.
export function exemptAuthorReason(
  author: unknown,
  exemptAuthors: string[],
  exemptBotAuthors: boolean,
): string | null {
  if (!author || typeof author !== 'object') return null;
  const { login: rawLogin, type: rawType } = author as { login?: unknown; type?: unknown };
  const login = typeof rawLogin === 'string' ? rawLogin : '';
  const type = typeof rawType === 'string' ? rawType : '';
  if (exemptBotAuthors && type === 'Bot') {
    return `author \`${login || 'unknown'}\` is a bot (GitHub user type \`Bot\`)`;
  }
  if (login && exemptAuthors.some((a) => a.toLowerCase() === login.toLowerCase())) {
    return `author \`${login}\` is listed in \`exempt-authors\``;
  }
  return null;
}

export async function emitSkip(heading: string, detail: string, warning: string): Promise<void> {
  await core.summary.addHeading(heading).addRaw(`\n${detail}\n`).write();
  core.warning(warning);
}

export interface TemplateContext {
  headings: string[];
  skip: boolean;
}

export async function loadTemplateContext(
  templatePath: string,
  skipIfNoTemplate: boolean,
): Promise<TemplateContext> {
  const template = await readWorkspaceFile(templatePath);
  if (template) return loadedTemplateContext(template);
  return await absentTemplateContext(templatePath, skipIfNoTemplate);
}

function loadedTemplateContext(template: string): TemplateContext {
  const parsed = parseTemplate(template);
  core.info(
    `Template loaded: ${parsed.requiredHeadings.length} required section(s), ${parsed.optionalHeadings.length} conditional, ${parsed.templateCheckboxCount} template checkboxes.`,
  );
  return { headings: parsed.requiredHeadings, skip: false };
}

async function absentTemplateContext(
  templatePath: string,
  skipIfNoTemplate: boolean,
): Promise<TemplateContext> {
  if (skipIfNoTemplate) {
    await emitSkip(
      'pr-lint SKIPPED — no PR template',
      `> Nothing was validated on this pull request.\n> No template was found at \`${templatePath}\`, and \`skip-if-no-template\` is enabled.\n> Add a PR template to opt this repository into the check.`,
      `pr-lint SKIPPED — no PR template found at ${templatePath}. Nothing was validated. Add the template, or set skip-if-no-template to "false" to enforce the floor rules here anyway.`,
    );
    return { headings: [], skip: true };
  }
  core.warning(
    `No template found at ${templatePath} in workspace. Consumer must \`actions/checkout\` before running pr-lint. Falling back to floor rules only.`,
  );
  return { headings: [], skip: false };
}
