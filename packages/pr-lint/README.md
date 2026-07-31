# :punch: `pr-lint`

Validate a pull request body against the consuming repository's own `.github/pull_request_template.md` — the mechanical enforcement layer for the OSOME PR description standard ([ITG-246](https://reallyosome.atlassian.net/browse/ITG-246)).

**Derive-from-template pattern.** No hardcoded format. The action reads the repo's own template at runtime, extracts required sections and checkboxes, and validates the PR body against them. Teams keep their own template format; this action enforces *their* repo's standard.

## What it checks

pr-lint never imposes a shared PR format. Teams keep whatever template they like — Nike's PRFAQ shape and a three-line template are equally valid. What it does is hold a repo to **its own** template, plus a small org-wide floor.

**Org floor — always enforced:**

1. **Title format** — `<type>(<scope>): <description> [<JIRA-ID>,...]` per [Osome git principles](https://github.com/OsomePteLtd/principles/blob/main/src/git.md).

   The check enforces the **shape and the Jira traceability**, not the vocabulary:

   - `type` — any lowercase word. The principles list `feat`/`feature`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `infra`, `task`, but teams use others (`build`, `ci`, `style`, `revert`) and the action does not police the list.
   - `scope` — optional, free-form, anything inside parentheses: `fix(invoice,billing):`, `fix(ui/checkout):`, `fix(Aspire Account Opening):`.
   - **Jira IDs are the part that is enforced** — one or more, comma-separated, e.g. `[APP-226,PAY-67]`. Project keys may contain digits (`ACV2-642`), and a space after the comma is fine.

   Rejected: a missing colon, a missing or malformed Jira list, an empty type.

   **Both parts are per-repo configurable.** Set `enforce-title: 'false'` to drop the title check entirely — appropriate for a repository that does not track work in Jira. Or keep the check and supply your own `title-pattern` to require a shape without Jira IDs:

   ```yaml
   with:
     title-pattern: '^[a-z][a-z-]*(\([^)]+\))?: .+$'
   ```

   An invalid `title-pattern` fails the check with a clear `pr-lint config error` rather than crashing.

   **Documentation repositories** (`shared-brain`, wikis, planning workspaces) are the common case for this. Work there often starts before a ticket exists, or without one at all, so requiring a Jira ID would block legitimate PRs. Keep the documentation gate and drop the ticket requirement:

   ```yaml
   - uses: OsomePteLtd/actions/packages/pr-lint@master
     with:
       title-pattern: '^[a-z][a-z-]*(\([^)]+\))?: .+$'
   ```

   Or skip the title check altogether with `enforce-title: 'false'`. Either way the checklist and `Documentation & knowledge maintenance` rules still apply — which is usually the whole reason a documentation repository adopts pr-lint.
2. **A checklist section exists and is non-empty** — `## Checklist` by default (`required-sections` / `checklist-section`).
3. **The checklist carries the required sub-section** — headed `Documentation & knowledge maintenance`, with at least one item under it. Write it as a bold line (`**Documentation & knowledge maintenance**`) or a `###` heading; matched case-insensitively. This is the point of the action: every PR gets a deliberate look at whether memories, skills, READMEs, runbooks and external docs went stale.
4. **Checkboxes inside the checklist are resolved** — `- [x]`, or the line contains "n/a".

**The repo's own template — enforced by default** (`enforce-template-sections`, default `true`):

5. Every `##` heading declared in the repo's template must be present and non-empty in the PR body (≥ `min-section-chars`, or "n/a"). Headings prefixed `Conditional:` may be deleted when they don't apply.
6. Every checkbox anywhere in the body must be resolved.

These validate *that repo's* template, never a shared one — a team that wrote a section into its template presumably wants it filled in. Set the input to `false` to gate on the floor alone. Repos with no template are skipped entirely (`skip-if-no-template`).

Conditional sections (`## Conditional: ...`) may be deleted when not applicable — this action does not require their presence.

## Usage

This is a JS action (not a reusable workflow), so it's always consumed via `uses:` inside a workflow's steps. What differs is **where the workflow lives**.

### Recommended — org-wide via `OsomePteLtd/.github` + ruleset

Zero per-repo files. The workflow lives once in the org config repo; a Repository Ruleset targets whichever repos should get it.

**One-time setup (org admin):**

1. Add `.github/workflows/pr-lint.yml` in `OsomePteLtd/.github` (see template below).
2. Org Settings → Repository rulesets → New ruleset → Target: **Selected repositories** (dogfood scope) → Rule: **Require workflows to run before merging** → point at that file `@master`.
3. Widen the ruleset's target list to add more repos over time — no code changes.

**Workflow file (in `OsomePteLtd/.github`):**

```yaml
name: PR Lint (org-required)

on:
  pull_request:
    types: [opened, edited, synchronize, reopened, labeled, unlabeled]

permissions:
  contents: read
  pull-requests: read

jobs:
  pr-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: OsomePteLtd/actions/packages/pr-lint@master
        with:
          mode: 'warn' # remove after dogfood → enforce
          # skip-if-no-template: 'false' # flip later to enforce floor rules on template-less repos
```

`actions/checkout` is required so the action can read the template file from the workspace of the PR being validated.

### Alternative — per-repo file (early adopters, override scenarios)

Only use this when the repo is NOT in the org ruleset scope and you want it enabled locally, or when a repo needs different inputs than the org default.

```yaml
# .github/workflows/pr-lint.yml in the repo
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

## Inputs

| Name                               | Required | Default                            | Description                                                                                                              |
| ---------------------------------- | -------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `github-token`                     | No       | `${{ github.token }}`              | Token used for PR context (kept for future octokit calls)                                                                |
| `template-path`                    | No       | `.github/pull_request_template.md` | Path to the PR template in the repo                                                                                      |
| `bypass-label`                     | No       | `pr-lint-skip`                     | Applying this label to a PR skips the check                                                                              |
| `exempt-authors`                   | No       | *(empty)*                          | Comma-separated PR author logins to skip, for machine accounts of GitHub user type `User` (e.g. `osome-bot`). Case-insensitive. |
| `exempt-bot-authors`               | No       | `true`                             | Skip PRs authored by GitHub `Bot`-type accounts (`dependabot[bot]`, `github-actions[bot]`, ...). Set `false` to lint bot PRs too. |
| `min-section-chars`                | No       | `20`                               | Minimum substantive chars required per section (or write "n/a")                                                          |
| `required-sections`                | No       | `Checklist`                        | Comma-separated `##` headings that MUST appear in the PR body regardless of the local template (org-wide floor)          |
| `checklist-section`                | No       | `Checklist`                        | Name of the `##` heading treated as the checklist for topic-coverage validation                                          |
| `required-checklist-subsection`    | No       | `Documentation & knowledge maintenance` | Exact sub-section name required inside the checklist, carrying >= 1 item. Case-insensitive. Empty string disables. |
| `enforce-title`                    | No       | `true`                             | Whether to check the PR title at all. `false` skips it entirely. |
| `title-pattern`                    | No       | *(built-in)*                       | Regex overriding the built-in title format, e.g. to require a shape without Jira IDs. Ignored when `enforce-title` is `false`. |
| `enforce-template-sections`        | No       | `true`                             | Require every `##` heading from the repo's own template, and resolve checkboxes body-wide. Set `false` to gate on the org floor alone. |
| `skip-if-no-template`              | No       | `true`                             | When `true`, exit successfully with a notice if the repo has no PR template. Safe org-wide default. Set to `false` to enforce floor rules even in template-less repos. |
| `mode`                             | No       | `enforce`                          | `enforce` (fail check on findings, blocking) or `warn` (report findings via warnings + step summary, exit 0 — non-blocking, safe for org-wide dogfood rollout).       |

## Bot-authored PRs

PRs opened by machines (`Bump packages`, dependabot updates) never carry a template-compliant body, and a checklist ticked by a bot attests to nothing. By default the action skips them: accounts with GitHub user type `Bot` are exempt via `exempt-bot-authors` (default `true`), and machine accounts that are technically `User`-type (like `osome-bot`) can be listed per repo in `exempt-authors`. Exemption checks the PR *author* from the event payload, not `github.actor`, so a human pushing to a bot's branch does not flip the decision.

Skipped runs are loud, not silent: the check shows a `pr-lint SKIPPED` card in the job summary naming the reason. Docs-staleness risk from dependency bumps is real, but it belongs to the reviewer layer, not a body-format check.

## Bypass

Add the `pr-lint-skip` label to the PR for emergencies. The check exits successfully without validating anything.

**The label is sticky.** It stays in effect for every subsequent commit until someone removes it, so a PR that was bypassed once looks gated but is not. To make that hard to miss, a bypassed run emits a warning-level annotation and writes a `pr-lint SKIPPED` card to the job summary. Remove the label to re-enable the check — on a per-repo workflow the `unlabeled` event re-runs it immediately.

The same treatment applies when a repository has no PR template and `skip-if-no-template` is on: the run is clearly marked as skipped rather than quietly passing.

## Design notes

- **Format freedom per repo, floor is enforced.** Each repo owns its PR description format. The org-wide gate is only: a checklist section, and a `Documentation & knowledge maintenance` sub-section inside it with at least one item. See [`memory/pr-template-standard.md`](https://github.com/OsomePteLtd/dev/blob/main/memory/pr-template-standard.md).
- **Floor vs template.** Floor headings from `required-sections` are required even when the local template does not declare them. Template-declared headings are enforced by default, which holds a repo to the template it chose rather than to a shared one; `enforce-template-sections: 'false'` drops to floor-only.
- **One fixed sub-section name, matched as a heading.** The doc/knowledge floor requires a sub-section literally named `Documentation & knowledge maintenance` holding at least one item. A fixed name means every repo's checklist reads the same and the failure message can tell the author exactly what to paste. Matching against headings rather than item text also closes a false pass: an unrelated line like "...is documented above" used to satisfy a substring rule.
- **HTML comments are stripped** before parsing — `<!-- guidance -->` blocks inside templates and PR bodies do not create phantom sections or checkboxes.
- **Conditional sections are optional.** Matches the template convention "delete if N/A" — no per-box "n/a" spam when a whole section doesn't apply.
- **Checkbox resolution accepts "n/a"** anywhere in the line. Authors can tick or annotate — both are valid.

## Related

- [ITG-1430](https://reallyosome.atlassian.net/browse/ITG-1430) — this action
- [ITG-246](https://reallyosome.atlassian.net/browse/ITG-246) — template rollout across scrooge/shiva/invoker
- [PR review checklist (Notion)](https://app.notion.com/p/osome/PR-review-checklist-3a094fd5a8ec8019b75acfc88160323f) — living author + reviewer guide
