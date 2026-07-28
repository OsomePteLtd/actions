import {
  effectiveRequiredHeadings,
  extractLabelNames,
  extractSection,
  findChecklistSubsections,
  findUnresolvedCheckboxes,
  isBypassed,
  isSubstantive,
  parseCsvList,
  parseMinChars,
  parseTemplate,
  validateChecklistSubsection,
  validateCheckboxes,
  validateSection,
  validateSections,
  validateTitle,
  DEFAULT_MIN_CHARS,
  DEFAULT_REQUIRED_SUBSECTION,
} from './lib';

describe('parseCsvList', () => {
  it('trims + drops empty entries', () => {
    expect(parseCsvList('Checklist, Impact ,, Testing')).toEqual(['Checklist', 'Impact', 'Testing']);
  });
  it('handles empty string', () => {
    expect(parseCsvList('')).toEqual([]);
  });
});

describe('parseMinChars', () => {
  it('parses valid integer', () => {
    expect(parseMinChars('40')).toBe(40);
  });
  it('falls back on NaN input, invokes callback', () => {
    const seen: string[] = [];
    expect(parseMinChars('abc', (msg) => seen.push(msg))).toBe(DEFAULT_MIN_CHARS);
    expect(seen).toHaveLength(1);
  });
  it('falls back on negative', () => {
    expect(parseMinChars('-5')).toBe(DEFAULT_MIN_CHARS);
  });
});

describe('parseTemplate', () => {
  it('separates required from Conditional: headings and ignores HTML comments', () => {
    const md = `
<!-- ignored heading in comment
## Ignored -->

## What
some prose

## Conditional: Backend
- [ ] a
- [ ] b

## Checklist
- [ ] docs
`;
    const parsed = parseTemplate(md);
    expect(parsed.requiredHeadings).toEqual(['What', 'Checklist']);
    expect(parsed.optionalHeadings).toEqual(['Conditional: Backend']);
    expect(parsed.templateCheckboxCount).toBe(3);
  });
});

describe('extractSection', () => {
  it('returns content between heading and next ## or end-of-body', () => {
    const body = '## What\nalpha\n## Why\nbeta\n';
    expect(extractSection(body, 'What')).toBe('alpha');
    expect(extractSection(body, 'Why')).toBe('beta');
  });
  it('returns null when heading absent', () => {
    expect(extractSection('nothing here', 'What')).toBeNull();
  });
  it('matches heading case-insensitively', () => {
    expect(extractSection('## impact\nalpha\n', 'Impact')).toBe('alpha');
    expect(extractSection('## RISKS & ROLLOUT\nbeta\n', 'Risks & rollout')).toBe('beta');
  });
  it('still stops at the next heading regardless of case', () => {
    expect(extractSection('## what\nalpha\n## WHY\nbeta\n', 'What')).toBe('alpha');
  });
});

describe('isSubstantive', () => {
  it('true when content meets minChars', () => {
    expect(isSubstantive('a'.repeat(25), 20)).toBe(true);
  });
  it('true when content is short but says n/a', () => {
    expect(isSubstantive('n/a — no behavior change', 20)).toBe(true);
  });
  it('false when short and no n/a', () => {
    expect(isSubstantive('tiny', 20)).toBe(false);
  });
});

describe('findUnresolvedCheckboxes', () => {
  it('returns unchecked labels, drops those with n/a', () => {
    const body = `
- [ ] real one
- [ ] n/a — skipped
- [x] done
`;
    expect(findUnresolvedCheckboxes(body)).toEqual(['real one']);
  });
  it('ignores checkboxes in HTML comments', () => {
    const body = '<!-- - [ ] placeholder -->\n- [x] real';
    expect(findUnresolvedCheckboxes(body)).toEqual([]);
  });
});

describe('findChecklistSubsections', () => {
  const section = `
**PR shape**

- [x] one concern
- [ ] small

**Documentation & knowledge maintenance**

- [x] docs updated
- [ ] memories refreshed
`;
  it('groups checkbox items under bold sub-headings', () => {
    const subs = findChecklistSubsections(section);
    expect(subs.map((s) => s.label)).toEqual(['PR shape', 'Documentation & knowledge maintenance']);
    expect(subs[0].items).toHaveLength(2);
    expect(subs[1].items).toEqual(['docs updated', 'memories refreshed']);
  });
  it('supports ### sub-headings', () => {
    const subs = findChecklistSubsections('### Docs\n- [x] a\n');
    expect(subs[0].label).toBe('Docs');
    expect(subs[0].items).toEqual(['a']);
  });
  it('ignores checkbox lines in HTML comments', () => {
    const subs = findChecklistSubsections('**G**\n<!-- - [ ] hidden -->\n- [x] real\n');
    expect(subs[0].items).toEqual(['real']);
  });
  it('returns a sub-section with no items when the group is empty', () => {
    const subs = findChecklistSubsections('**Empty group**\n\n**Next**\n- [x] a\n');
    expect(subs[0].items).toEqual([]);
  });
});

describe('validateTitle', () => {
  const ok = (t: string) => expect(validateTitle(t)).toBeNull();
  const bad = (t: string) => expect(validateTitle(t)?.rule).toBe('title-format');

  it('accepts a conventional title with one jira id', () => {
    ok('feat(pr-lint): add mode input [ITG-1430]');
  });
  it('accepts multiple comma-separated jira ids (per OSOME git principles)', () => {
    ok('feat: support companyId in invoice URLs [APP-226,PAY-67]');
    ok('chore: bump deps [CORE-10,PAY-99,ITG-1]');
  });
  it('tolerates a space after the comma even though the convention omits it', () => {
    ok('feat: support companyId in invoice URLs [APP-226, PAY-67]');
  });
  it('accepts project keys containing digits', () => {
    ok('fix(accounting): correct rounding [ACV2-642]');
  });
  it('accepts the feature alias for feat', () => {
    ok('feature(billing): add plan upgrade [BIL-3]');
  });
  it('accepts multiple comma-separated scopes', () => {
    ok('fix(invoice,billing): align totals [PAY-12]');
  });
  it('accepts every documented issue type', () => {
    for (const type of ['feat', 'feature', 'fix', 'chore', 'docs', 'refactor', 'test', 'perf', 'infra', 'task']) {
      ok(`${type}: do the thing [ITG-1]`);
    }
  });
  it('does not police the type vocabulary — teams vary', () => {
    ok('build: bump docker base image [PLAT-9]');
    ok('ci: cache node modules [PLAT-10]');
    ok('style: reformat [PLAT-11]');
    ok('hotfix: patch prod [PLAT-12]');
  });
  it('does not police the scope vocabulary — teams vary', () => {
    ok('fix(ui/checkout): align totals [PAY-12]');
    ok('fix(Aspire Account Opening): retry on 5xx [ITG-1]');
    ok('fix(a,b,c): sweep [ITG-2]');
  });
  it('rejects a missing jira id', () => {
    bad('feat(pr-lint): add mode input');
  });
  it('still requires the structural shape', () => {
    bad('no colon here [ITG-1]');
    bad('UPPERCASE: shouting [ITG-1]');
    bad(': empty type [ITG-1]');
  });
  it('rejects a malformed jira id', () => {
    bad('feat: thing [itg-1430]');
    bad('feat: thing [ITG-]');
  });
  it('rejects a trailing comma in the jira list', () => {
    bad('feat: thing [ITG-1,]');
  });
});

describe('validateSection', () => {
  it('flags missing section (template)', () => {
    const f = validateSection('empty body', 'What', false, 20);
    expect(f?.rule).toBe('missing-section');
  });
  it('flags missing section as floor when isFloor', () => {
    const f = validateSection('empty body', 'Checklist', true, 20);
    expect(f?.rule).toBe('missing-floor-section');
  });
  it('flags empty section', () => {
    const f = validateSection('## What\ntoo short', 'What', false, 50);
    expect(f?.rule).toBe('empty-section');
  });
  it('passes substantive section', () => {
    expect(validateSection('## What\n' + 'x'.repeat(40), 'What', false, 20)).toBeNull();
  });
});

describe('effectiveRequiredHeadings + validateSections', () => {
  it('unions template + floor and dedupes', () => {
    expect(effectiveRequiredHeadings(['What', 'Checklist'], ['Checklist', 'Impact'])).toEqual([
      'What',
      'Checklist',
      'Impact',
    ]);
  });
  it('when template absent, floor sections still enforced', () => {
    const body = '## Random\nabc\n';
    const failures = validateSections(body, [], ['Checklist'], 20);
    expect(failures.some((f) => f.rule === 'missing-floor-section')).toBe(true);
  });
});

describe('validateChecklistSubsection', () => {
  const required = DEFAULT_REQUIRED_SUBSECTION;
  const good = ['## Checklist', '', '**Documentation & knowledge maintenance**', '', '- [x] docs updated', ''].join('\n');
  it('returns null when no sub-section is required', () => {
    expect(validateChecklistSubsection('any body', 'Checklist', '')).toBeNull();
  });
  it('null when the Checklist section is missing (missing-section rule covers it)', () => {
    expect(validateChecklistSubsection('no headings', 'Checklist', required)).toBeNull();
  });
  it('passes when the required sub-section exists with items', () => {
    expect(validateChecklistSubsection(good, 'Checklist', required)).toBeNull();
  });
  it('matches the label case-insensitively', () => {
    const body = '## Checklist\n\n**DOCUMENTATION & KNOWLEDGE MAINTENANCE**\n\n- [x] a\n';
    expect(validateChecklistSubsection(body, 'Checklist', required)).toBeNull();
  });
  it('accepts the ### heading form', () => {
    const body = '## Checklist\n\n### ' + required + '\n\n- [x] a\n';
    expect(validateChecklistSubsection(body, 'Checklist', required)).toBeNull();
  });
  it('flags when the sub-section is absent', () => {
    const body = '## Checklist\n\n**Self-review**\n\n- [x] unrelated\n';
    expect(validateChecklistSubsection(body, 'Checklist', required)?.rule).toBe('checklist-subsection-missing');
  });
  it('does NOT accept a stray word inside an unrelated checkbox item', () => {
    const body = '## Checklist\n\n**Self-review**\n\n- [x] removal condition is documented above\n';
    expect(validateChecklistSubsection(body, 'Checklist', required)?.rule).toBe('checklist-subsection-missing');
  });
  it('does NOT accept a differently-named group', () => {
    const body = '## Checklist\n\n**Docs**\n\n- [x] docs updated\n';
    expect(validateChecklistSubsection(body, 'Checklist', required)?.rule).toBe('checklist-subsection-missing');
  });
  it('flags the required sub-section when it has no items', () => {
    const body = '## Checklist\n\n**' + required + '**\n\n**Next**\n- [x] a\n';
    expect(validateChecklistSubsection(body, 'Checklist', required)?.rule).toBe('checklist-subsection-empty');
  });
});

describe('validateCheckboxes', () => {
  it('null when nothing unresolved', () => {
    expect(validateCheckboxes('- [x] done')).toBeNull();
  });
  it('reports unresolved', () => {
    const f = validateCheckboxes('- [ ] pending');
    expect(f?.rule).toBe('unresolved-checkboxes');
    expect(f?.details).toContain('pending');
  });
});

describe('isBypassed / extractLabelNames', () => {
  it('extracts name field from label objects, ignores garbage', () => {
    expect(
      extractLabelNames([{ name: 'a' }, { name: 'b' }, null, {}, 'not-an-object']),
    ).toEqual(['a', 'b']);
  });
  it('returns [] when labels is not an array', () => {
    expect(extractLabelNames(undefined)).toEqual([]);
    expect(extractLabelNames(null)).toEqual([]);
  });
  it('true when label present', () => {
    expect(isBypassed([{ name: 'pr-lint-skip' }], 'pr-lint-skip')).toBe(true);
  });
  it('false when not present', () => {
    expect(isBypassed([{ name: 'other' }], 'pr-lint-skip')).toBe(false);
  });
});

describe('validateCheckboxes scoping', () => {
  const body = [
    '## Changes',
    '- [ ] a template checkbox outside the checklist',
    '',
    '## Checklist',
    '',
    '**Documentation & knowledge maintenance**',
    '',
    '- [ ] docs updated',
    '',
  ].join('\n');
  it('flags every unresolved box when unscoped', () => {
    expect(validateCheckboxes(body)?.details).toContain('2 unresolved');
  });
  it('only flags boxes inside the scoped section', () => {
    const f = validateCheckboxes(body, 'Checklist');
    expect(f?.details).toContain('1 unresolved');
    expect(f?.details).toContain('docs updated');
    expect(f?.details).not.toContain('template checkbox');
  });
});
