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

export interface Inputs {
  templatePath: string;
  bypassLabel: string;
  minChars: number;
  floorSections: string[];
  checklistHeading: string;
  requiredSubsection: string;
  enforceTemplateSections: boolean;
  skipIfNoTemplate: boolean;
  mode: 'warn' | 'enforce';
}

export const TITLE_REGEX =
  /^(feat|fix|chore|refactor|test|docs|perf|infra|task|revert)(\([^)]+\))?: .+\s\[[A-Z]+-\d+\]\s*$/;
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

export function validateTitle(title: string): Failure | null {
  if (TITLE_REGEX.test(title.trim())) return null;
  return {
    rule: 'title-format',
    details: `Title must match \`<type>(<scope>): <description> [JIRA-ID]\`. Got: \`${title}\``,
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
    minChars: parseMinChars(core.getInput('min-section-chars') || String(DEFAULT_MIN_CHARS), (msg) =>
      core.warning(msg),
    ),
    floorSections: parseCsvList(core.getInput('required-sections') || 'Checklist'),
    checklistHeading: core.getInput('checklist-section') || 'Checklist',
    requiredSubsection:
      core.getInput('required-checklist-subsection') || DEFAULT_REQUIRED_SUBSECTION,
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
