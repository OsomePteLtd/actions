# :punch: `pr-lint`

Validate a pull request body against the consuming repository's own `.github/pull_request_template.md` — the mechanical enforcement layer for the OSOME PR description standard ([ITG-246](https://reallyosome.atlassian.net/browse/ITG-246)).

**Derive-from-template pattern.** No hardcoded format. The action reads the repo's own template at runtime, extracts required sections and checkboxes, and validates the PR body against them. Teams keep their own template format; this action enforces *their* repo's standard.

## What it checks

1. **Title format** — `<type>(<scope>): <description> [JIRA-ID]` where `type ∈ {feat, fix, chore, refactor, test, docs, perf, infra, task, revert}` (per [Osome git principles](https://github.com/OsomePteLtd/principles/blob/main/src/git.md)).
2. **Template-required sections present** — every `##` heading in the template (except those starting with `Conditional:`) must appear in the PR body.
3. **Floor-required sections present** — every heading in `required-sections` MUST appear in the PR body, regardless of what the local template declares. Default floor: `Checklist`.
4. **Sections non-empty** — each required section must carry ≥ `min-section-chars` chars of substantive content, or "n/a" written into the section.
5. **Checklist covers a required topic** — inside `## Checklist` (configurable via `checklist-section`), at least one checkbox line must match `required-checklist-topic-pattern`. Default `doc|knowledge` — enforces that authors think about documentation & knowledge maintenance. Set the input to an empty string to disable.
6. **Checkboxes resolved** — every `- [ ]` in the PR body must be `- [x]` or the line must contain "n/a".

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

| Name                               | Required | Default                            | Description                                                                                                              |
| ---------------------------------- | -------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `github-token`                     | No       | `${{ github.token }}`              | Token used for PR context (kept for future octokit calls)                                                                |
| `template-path`                    | No       | `.github/pull_request_template.md` | Path to the PR template in the repo                                                                                      |
| `bypass-label`                     | No       | `pr-lint-skip`                     | Applying this label to a PR skips the check                                                                              |
| `min-section-chars`                | No       | `20`                               | Minimum substantive chars required per section (or write "n/a")                                                          |
| `required-sections`                | No       | `Checklist`                        | Comma-separated `##` headings that MUST appear in the PR body regardless of the local template (org-wide floor)          |
| `checklist-section`                | No       | `Checklist`                        | Name of the `##` heading treated as the checklist for topic-coverage validation                                          |
| `required-checklist-topic-pattern` | No       | `doc\|knowledge`                   | Case-insensitive regex; at least one checkbox line inside the checklist section must match. Empty string disables check. |
| `skip-if-no-template`              | No       | `true`                             | When `true`, exit successfully with a notice if the repo has no PR template. Safe org-wide default. Set to `false` to enforce floor rules even in template-less repos. |

## Bypass

Add the `pr-lint-skip` label to the PR for emergencies. The check exits successfully with a notice.

## Design notes

- **Format freedom per repo, floor is enforced.** Each repo owns its template; only the `## Checklist` section (+ a documentation/knowledge-maintenance checkbox inside it) is org-mandated. See [`memory/pr-template-standard.md`](https://github.com/OsomePteLtd/dev/blob/main/memory/pr-template-standard.md) in the dev workspace.
- **Floor vs template.** Template-declared headings are always required (unless `Conditional:`). Floor headings from `required-sections` are ALSO required even if the local template does not declare them — this is how `Checklist` stays mandatory for every repo.
- **Topic coverage inside the checklist.** `required-checklist-topic-pattern` (default `doc\|knowledge`) enforces at least one checkbox item concerning documentation/knowledge maintenance — teams can name their bullet freely, e.g. "Docs updated", "Knowledge base synced", "AGENTS.md refreshed".
- **HTML comments are stripped** before parsing — `<!-- guidance -->` blocks inside templates and PR bodies do not create phantom sections or checkboxes.
- **Conditional sections are optional.** Matches the template convention "delete if N/A" — no per-box "n/a" spam when a whole section doesn't apply.
- **Checkbox resolution accepts "n/a"** anywhere in the line. Authors can tick or annotate — both are valid.

## Related

- [ITG-1430](https://reallyosome.atlassian.net/browse/ITG-1430) — this action
- [ITG-246](https://reallyosome.atlassian.net/browse/ITG-246) — template rollout across scrooge/shiva/invoker
- [PR review checklist (Notion)](https://app.notion.com/p/osome/PR-review-checklist-3a094fd5a8ec8019b75acfc88160323f) — living author + reviewer guide
