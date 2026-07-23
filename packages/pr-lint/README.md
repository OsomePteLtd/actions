# :punch: `pr-lint`

Validate a pull request body against the consuming repository's own `.github/pull_request_template.md` — the mechanical enforcement layer for the OSOME PR description standard ([ITG-246](https://reallyosome.atlassian.net/browse/ITG-246)).

**Derive-from-template pattern.** No hardcoded format. The action reads the repo's own template at runtime, extracts required sections and checkboxes, and validates the PR body against them. Teams keep their own template format; this action enforces *their* repo's standard.

## What it checks (v1)

1. **Title format** — `<type>(<scope>): <description> [JIRA-ID]` where `type ∈ {feat, fix, chore, refactor, test, docs, perf, infra, task, revert}` (per [Osome git principles](https://github.com/OsomePteLtd/principles/blob/main/src/git.md)).
2. **Required sections present** — every `##` heading in the template (except those starting with `Conditional:`) must appear in the PR body.
3. **Sections non-empty** — each required section must carry ≥ `min-section-chars` chars of substantive content, or "n/a" written into the section.
4. **Checkboxes resolved** — every `- [ ]` in the PR body must be `- [x]` or the line must contain "n/a".

Conditional sections (`## Conditional: ...`) may be deleted when not applicable — this action does not require their presence.

## Usage

Add to any repo that has a `.github/pull_request_template.md`:

```yaml
# .github/workflows/pr-lint.yml
name: PR Lint
on:
  pull_request:
    types: [opened, edited, synchronize, reopened, labeled, unlabeled]

jobs:
  pr-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: OsomePteLtd/actions/packages/pr-lint@master
```

`actions/checkout` is required so the action can read the template file from the workspace.

## Inputs

| Name                | Required | Default                                | Description                                                                 |
| ------------------- | -------- | -------------------------------------- | --------------------------------------------------------------------------- |
| `github-token`      | No       | `${{ github.token }}`                  | Token used for PR context (kept for future octokit calls)                   |
| `template-path`     | No       | `.github/pull_request_template.md`     | Path to the PR template in the repo                                         |
| `bypass-label`      | No       | `pr-lint-skip`                         | Applying this label to a PR skips the check                                 |
| `min-section-chars` | No       | `20`                                   | Minimum substantive chars required per section (or write "n/a")            |

## Bypass

Add the `pr-lint-skip` label to the PR for emergencies. The check exits successfully with a notice.

## Design notes

- **Format freedom per repo.** Each repo owns its template; only the `## Checklist` block is org-mandated (see [`memory/pr-template-standard.md`](https://github.com/OsomePteLtd/dev/blob/main/memory/pr-template-standard.md) in the dev workspace).
- **HTML comments are stripped** before parsing, so `<!-- guidance -->` blocks inside the template do not count toward section content or checkbox extraction.
- **Conditional sections are optional.** Matches the template's "delete if N/A" convention — no per-box "n/a" spam required when the whole section doesn't apply.
- **Checkbox resolution accepts "n/a"** anywhere in the line. Authors can tick or annotate — both are valid.

## Related

- [ITG-1430](https://reallyosome.atlassian.net/browse/ITG-1430) — this action
- [ITG-246](https://reallyosome.atlassian.net/browse/ITG-246) — template rollout across scrooge/shiva/invoker
- [PR review checklist (Notion)](https://app.notion.com/p/osome/PR-review-checklist-3a094fd5a8ec8019b75acfc88160323f) — living author + reviewer guide
