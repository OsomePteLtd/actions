# `e2e-gate-check`

Composite GitHub Action that gates a production deploy on the latest per-tag
e2e result published by `OsomePteLtd/e2e-testing`. It consults a GitHub commit
status anchored to a lightweight tag (default `e2e-latest`) and only passes
when **both** conditions hold:

1. The status `state` is `success`, **and**
2. The deploying SHA is an ancestor of the snapshot SHA captured at e2e-time
   for the caller service (i.e. the green e2e run actually covered the code
   being deployed).

This action is generic — it does not embed any service identifier, fix list of
tags, or repository name in its logic. Every service-specific value is passed
as an input.

## Inputs

| Name            | Required | Default                   | Description                                                                                                                                                                              |
| --------------- | -------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `execution_tag` | yes      | —                         | Execution scope tag (e.g. `@e2e`). Combined with `domain_tag` to form the primary context `e2e/<execution_tag>+<domain_tag>`. Also used as the bare umbrella fallback `e2e/<execution_tag>`. |
| `domain_tag`    | yes      | —                         | Domain gate tag (e.g. `@billing`). Combined with `execution_tag` to form the primary context.                                                                                            |
| `service`       | yes      | —                         | Service key for snapshot SHA lookup at `versions.<service>` (e.g. `billy`).                                                                                                              |
| `deploying_sha` | yes      | —                         | SHA being deployed; typically `${{ github.sha }}`. Used as first arg to `git merge-base --is-ancestor`.                                                                                  |
| `token`         | yes      | —                         | GitHub token with read access on `e2e_repo`.                                                                                                                                             |
| `e2e_repo`      | no       | `OsomePteLtd/e2e-testing` | Repository that owns the per-tag statuses and anchor tag.                                                                                                                                |
| `anchor_ref`    | no       | `e2e-latest`              | Lightweight tag whose target SHA carries the statuses.                                                                                                                                   |
| `gate_mode`     | no       | `block`                   | Enforcement mode: `block` (exits non-zero on gate failure), `report` (always exits 0, logs decision in `gate_decision` output and step summary), or `off` (skips all checks, exits 0). |

## Outputs

| Name            | Description                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| `anchor_sha`    | SHA on `e2e_repo` that the consulted statuses were attached to (the SHA `anchor_ref` points to).             |
| `snapshot_sha`  | Snapshot SHA of the caller service captured at e2e-time, parsed from the selected status description.        |
| `tag_used`      | Tag identifier actually consulted: the `domain_tag` value on the primary path, or the literal `umbrella` on the fallback path. |
| `gate_decision` | One of: `pass`, `fail-state`, `fail-stale`, `fail-missing`.                                                  |

All outputs are populated even on failure (via an `if: always()` final step), so
the calling workflow can branch on `gate_decision` while still failing the job.

## Minimal caller example

The caller is responsible for checking out its own repository with full
history (`fetch-depth: 0`) so the ancestor check has the deploying and snapshot
commits available locally.

```yaml
jobs:
  e2e-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: e2e gate
        id: gate
        uses: OsomePteLtd/actions/packages/e2e-gate-check@master
        with:
          execution_tag: '@e2e'
          domain_tag: '@billing'
          service: billy
          deploying_sha: ${{ github.sha }}
          token: ${{ secrets.OSOME_BOT_TOKEN }}
```

## Behavior

- **Missing status**: If `anchor_ref` does not exist on `e2e_repo`, or no status exists for `e2e/<execution_tag>+<domain_tag>`, the action falls back to the bare umbrella `e2e/<execution_tag>`. If the umbrella is also missing, `gate_decision=fail-missing` and the action exits non-zero. The job summary lists both attempted contexts.
- **Non-success state**: If the selected status has `state` other than
  `success` (`failure`, `pending`, `error`), `gate_decision=fail-state` and
  the action exits non-zero. The summary links to the e2e run via
  `target_url`.
- **Stale snapshot (ancestor semantics)**: The action runs
  `git merge-base --is-ancestor <deploying_sha> <snapshot_sha>`.
  - `deploying_sha` is the **first** argument (potential ancestor).
  - `snapshot_sha` is the **second** argument (potential descendant).
  - Exit `0` → the deploying SHA is an ancestor of the snapshot SHA, so the
    green e2e run covers the deploy. **PASS.**
  - Non-zero → the snapshot predates the deploying SHA, so the green status
    does not cover what is being deployed. `gate_decision=fail-stale`.
  This direction is critical: inverting it would let stale snapshots pass
  while blocking fresh deploys.
- **`e2e-latest` anchor rationale**: The lightweight tag `e2e-latest` is
  moved by the e2e-testing workflow after every successful e2e run, so per-tag
  statuses always live on a single, predictable SHA. This avoids scanning
  every commit on `master` of the e2e repo and lets the gate find the latest
  decision in a single API call.

## Operational note (E6 freeze trade-off)

There is no time-based freshness check (no `max_age_hours`, no timestamp
comparison). The gate is purely SHA-based: if the snapshot covers the
deploying SHA and the state is green, the deploy proceeds regardless of when
e2e last ran.

The trade-off is **E6 (freeze windows)**: during a stage-deploy freeze, the
scheduled e2e run will not advance `e2e-latest`, so production deploys for
commits made *after* the freeze began will fail with `fail-stale` until an
on-demand e2e run is triggered manually:

```bash
gh workflow run e2e-dispatch.yml -R OsomePteLtd/e2e-testing
```

This is the intended behavior: deploys never bypass e2e by virtue of "the
last run was recent enough" — they always require a snapshot that includes
the deploying commit.

## What's NOT in this action

- **No retry logic.** The status board is queried once. If the API call fails
  transiently the gate fails closed; re-run the workflow to retry.
- **No time-based freshness.** Freshness is enforced structurally via the
  ancestor check, not via wall-clock age of the status.
- **No test execution.** The action only *reads* statuses produced by the
  e2e-testing repo. It never runs Playwright, never installs dependencies,
  and never touches the calling service's test suite.
- **No git mutations.** The action performs no `git add`, `git commit`, or
  `git push`. It only reads the local object database (and fetches the
  snapshot SHA from `origin` if missing).
- **No third-party actions.** All work is done in pure bash composite steps,
  using `gh`, `jq`, and `git` already provisioned on the runner.
