import {
  checklistCoversTopic,
  effectiveRequiredHeadings,
  extractLabelNames,
  extractSection,
  findUnresolvedCheckboxes,
  isBypassed,
  isSubstantive,
  parseCsvList,
  parseMinChars,
  parseTemplate,
  validateChecklistTopic,
  validateCheckboxes,
  validateSection,
  validateSections,
  validateTitle,
  DEFAULT_MIN_CHARS,
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

describe('checklistCoversTopic', () => {
  const body = `
## Checklist
- [ ] Repo skills/memories checked
- [x] docs updated
`;
  it('matches doc topic via /doc/i on ticked or unticked line', () => {
    expect(checklistCoversTopic(body, 'Checklist', 'doc|knowledge').covered).toBe(true);
  });
  it('handles uppercase [X] boxes', () => {
    expect(checklistCoversTopic('## Checklist\n- [X] doc note', 'Checklist', 'doc').covered).toBe(true);
  });
  it('reports sectionPresent false when heading missing', () => {
    expect(checklistCoversTopic('## Other\n- [ ] docs', 'Checklist', 'doc')).toEqual({
      covered: false,
      sectionPresent: false,
    });
  });
});

describe('validateTitle', () => {
  it('accepts conventional title with jira id', () => {
    expect(validateTitle('feat(pr-lint): add mode input [ITG-1430]')).toBeNull();
  });
  it('rejects missing jira id', () => {
    expect(validateTitle('feat(pr-lint): add mode input')).not.toBeNull();
  });
  it('rejects bad type', () => {
    expect(validateTitle('nope(pr-lint): fix [ITG-1]')).not.toBeNull();
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

describe('validateChecklistTopic', () => {
  it('returns null when pattern empty', () => {
    expect(validateChecklistTopic('any body', 'Checklist', '')).toBeNull();
  });
  it('null when section missing (avoid duplicate report)', () => {
    expect(validateChecklistTopic('no headings', 'Checklist', 'doc')).toBeNull();
  });
  it('flags when Checklist present but no matching item', () => {
    const body = '## Checklist\n- [x] unrelated';
    expect(validateChecklistTopic(body, 'Checklist', 'doc|knowledge')?.rule).toBe(
      'checklist-topic-missing',
    );
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
