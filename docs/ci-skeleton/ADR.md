# ADR-PF-2646: One reusable CI skeleton, evolved from backend.yml

Status: **Proposed** (draft for Stef / CJ Yumul). Date: 2026-10-06. Epic: PF-2646 CI Simplification.
Related: PF-2682, PF-2684, PF-2686, PF-3080, PF-2688, PF-2683, PF-2958, PF-3243.

## Context
- Composite actions already exist in `OsomePteLtd/actions` (used in 22 and 107 repos). The
  missing piece is the *skeleton*: each backend hand-writes setup → checks → tests → deploy
  (shiva `default.yml` is 275 lines, scrooge `pr-checks.yml` is 224).
- `backend.yml` (PR #348, Aug 28, plus #353) already centralizes that skeleton for Node backends.
  Issues: it runs Node only; repeats the setup block 3×; cancels main/tag runs (workflow-level
  `cancel-in-progress: true`); uses `secrets: inherit`; refs `@master`; has no top-level
  `permissions`; mixes checkout@v4 and @v6; uses `always()` on deploy; has a substring main
  guard and an empty `role-session-name`.
- An unmerged `frontend.yml` (feat/frontend-ci-workflow, Aug 20) duplicates about 70% of the
  same harness.

## Decision
1. **Evolve `backend.yml` in place** (same path callers already use) and, once a `v1` tag
   exists, pin callers to it. Until then, org action refs stay `@master`. Keep the job graph
   and job names. Apply the cuts in DESIGN.md §3.
2. **Language-agnostic through inputs, not layers.** Add `runtime` / `version_file` /
   `install_command` / `run_prefix`, plus one new composite, `setup-runtime` (node, python, go,
   java). The input defaults are the backend-node preset. No preset files until there is a
   second consumer.
3. **Concurrency in the callee only.** Cancel only for `pull_request`. Non-PR runs of this
   skeleton get a run_id group (never cancelled, never replaced). Smoke keeps its own
   non-cancelling groups. This does not order app-repo `on: deployment` workflows (GAPS.md).
4. **Explicit `secrets:`** plus least-privilege job `permissions`. Callers grant a superset at
   workflow level.
5. **A single required check, `ci / CI status`**, as a roll-up job.
6. Deploy stays a GitHub deployment-record handoff to each repo's `on: deployment` workflow.

## Alternatives considered
| Alternative | Why not |
|---|---|
| Separate backend.yml + frontend.yml + mobile.yml | Already diverging (tiers, timeouts, injection); 3× maintenance |
| Big new framework (preset workflows wrapping a core workflow, nested reusable calls) | Nesting adds a check-name level and depth limits. The user asked to simplify, not to build |
| Composite-only (no reusable workflow) | Composites can't declare jobs, matrix, services, concurrency or permissions, which is exactly the skeleton |
| Keep per-repo files, add lint rules | Doesn't remove the ~450/275/224 lines or the drift |
| Starter workflow templates (copy-paste) | Copies drift immediately. No central rollback |

## Consequences
- + Repos shrink to about 25-45 lines. Fixes land once. Rollback by tag. Frontend and mobile get
  the same harness.
- + PR runs of this skeleton cancel cleanly. Main, tag, and dispatch runs of this skeleton are never cancelled. App-repo deploy workflows are unchanged and can still drop a newer commit (GAPS.md).
- − **Every required status check name changes** (`ci / …` prefix). Branch protection must be
  updated in the same window, or PRs block on "Expected" checks.
- − A skeleton bug hits every repo on `@v1`. Mitigate with pilots first and immutable `v1.x.y`
  for cautious repos.
- − Behaviour changes for pilots: runner tiers, service image tag (`latest` → `16`), static
  checks collapse into one step (log groups), scrooge labeling moves out of CI.
- − Inputs are a public API. Removing one needs `v2`.
