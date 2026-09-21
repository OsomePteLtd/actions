# `e2e-gate-check`

Composite GitHub Action that gates a production deploy on the latest per-tag
e2e result published by `OsomePteLtd/e2e-testing`. The source of truth is a
single **result board** — `board.json` at the root of the orphan branch
`e2e-gate-board` on the e2e repo. After every e2e run on main, the producer
upserts its row into the board and force-pushes the lightweight tag
`e2e-latest` to the latest board commit. The gate reads the board at that
anchor and only passes when **both** conditions hold:

1. The board row `state` is `success`, **and**
2. The deploying SHA is an ancestor of the snapshot SHA captured at e2e-time
   for the caller service (i.e. the green e2e run actually covered the code
   being deployed).

This action is generic — it does not embed any service identifier, fixed list
of tags, or repository name in its logic. Every service-specific value is
passed as an input.

## Board shape

`board.json` is a flat object keyed by `<execution_tag>+<domain_tag>`, plus an
umbrella row `<execution_tag>+umbrella` (the execution-scope catch-all):

```json
{
  "@e2e+@billing": {
    "state": "success",
    "passed": 42,
    "failed": 0,
    "ranAt": "2026-06-12T08:10:00Z",
    "runUrl": "https://github.com/OsomePteLtd/e2e-testing/actions/runs/123",
    "versions": { "billy": "abc123def456" }
  },
  "@e2e+umbrella": { "...same shape..." }
}
```

- `state` is `success` or `failure` (the board never carries `pending`/`error`).
- `versions` values are 12-character short SHAs of each onboarded service at
  e2e-time. A service appears here only if it is onboarded in `GATE_SERVICES`
  on the e2e-testing side.

## Inputs

| Name                | Required | Default                   | Description                                                                                                                                                                  |
| ------------------- | -------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `execution_tag`     | yes      | —                         | Execution scope tag (e.g. `@e2e`). Combined with `domain_tag` to form the primary board key `<execution_tag>+<domain_tag>`. Also used for the fallback key `<execution_tag>+umbrella`. |
| `domain_tag`        | yes      | —                         | Domain gate tag (e.g. `@billing`). Combined with `execution_tag` to form the primary board key.                                                                              |
| `anchor_domain_tag` | no       | `''` (empty)              | Anchor domain tag of a multi-domain service: the **first** entry of that service's `domains` list in e2e-testing's `.github/gate-services.json`. Adds one lookup between the primary key and the umbrella. Empty for a service registered with a single `domain`. See [Anchor domain fallback](#anchor-domain-fallback). |
| `service`           | yes      | —                         | Service key for snapshot SHA lookup at `versions.<service>` in the board row (e.g. `billy`).                                                                                 |
| `deploying_sha`     | yes      | —                         | SHA being deployed; typically `${{ github.sha }}`. Used as first arg to `git merge-base --is-ancestor`.                                                                      |
| `token`             | yes      | —                         | GitHub token with read access on `e2e_repo`.                                                                                                                                 |
| `e2e_repo`          | no       | `OsomePteLtd/e2e-testing` | Repository that owns the result board and anchor tag.                                                                                                                        |
| `anchor_ref`        | no       | `e2e-latest`              | Tag pointing at the latest board commit. The producer pushes a lightweight tag; annotated tags are tolerated and dereferenced. Unrelated to `anchor_domain_tag`.             |
| `gate_mode`         | no       | `block`                   | Enforcement mode: `block` (exits non-zero on gate failure), `report` (always exits 0, logs decision in `gate_decision` output and step summary), or `off` (skips all checks, exits 0). |

## Outputs

| Name            | Description                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| `anchor_sha`    | Commit SHA on `e2e_repo` that `board.json` was read from (the board commit `anchor_ref` points to).          |
| `snapshot_sha`  | Snapshot SHA of the caller service captured at e2e-time, read from the selected board row at `versions.<service>`. |
| `tag_used`      | Tag identifier actually consulted: the `domain_tag` value on the primary path, the `anchor_domain_tag` value on the anchor path, or the literal `umbrella` on the umbrella path. |
| `gate_decision` | One of: `pass`, `fail-state`, `fail-stale`, `fail-missing`.                                                  |

All outputs are populated even on failure (via an `if: always()` final step), so
the calling workflow can branch on `gate_decision` while still failing the job.

## Decision table

| Decision       | Meaning                                                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pass`         | Board row state is `success` and the deploying SHA is an ancestor of the snapshot SHA — the green e2e run covers this deploy.                                 |
| `fail-state`   | The selected board row has `state: failure` — the latest e2e run for this tag did not pass.                                                                   |
| `fail-stale`   | The row is green, but the deploying SHA is **not** an ancestor of the snapshot SHA — e2e has not yet run against code that includes this deploy.              |
| `fail-missing` | Something needed by the gate does not exist: the anchor tag, `board.json` at the anchor (or it is unparseable), every board key it tried (primary, the anchor domain if one was supplied, and umbrella), the service entry in `row.versions` (service not onboarded in `GATE_SERVICES`), or a SHA that cannot be resolved in the caller's checkout. |

## How to unblock a failing gate

- **`fail-state`**: Fix (or confirm flake on) the failing e2e run — the job
  summary links the run via the row's `runUrl` — then re-run e2e so the
  producer flips the row back to green.
- **`fail-stale`**: Re-run e2e so the board snapshot advances past your
  deploying commit.
- **`fail-missing` (no row for your keys)**: Re-run e2e-dispatch with the
  right execution/domain tags so the producer writes your row. The job summary
  lists every key that was tried, in the order they were tried.
- **`fail-missing` (no `versions.<service>` in the row)**: Onboard the service
  in `GATE_SERVICES` on the e2e-testing side, then re-run e2e.

In all cases the refresh command is:

```bash
gh workflow run e2e-dispatch.yml -R OsomePteLtd/e2e-testing
```

## Minimal caller example

The caller is responsible for checking out its own repository with full
history (`fetch-depth: 0`) so the ancestor check can resolve both the
deploying SHA and the 12-char short snapshot SHA locally.

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

- **Row lookup**: The primary board key is
  `<execution_tag>+<domain_tag>` (e.g. `@e2e+@billing`). If absent, the gate
  tries `<execution_tag>+<anchor_domain_tag>` when an `anchor_domain_tag` was
  supplied, then falls back to the umbrella key `<execution_tag>+umbrella`. If
  none of them exists, `gate_decision=fail-missing` and the action exits
  non-zero. The job summary lists every attempted key.
- **Stale snapshot (ancestor semantics)**: The action runs
  `git merge-base --is-ancestor <deploying_sha> <snapshot_sha>` in the
  caller's checkout.
  - `deploying_sha` is the **first** argument (potential ancestor).
  - `snapshot_sha` is the **second** argument (potential descendant).
  - Exit `0` → the deploying SHA is an ancestor of the snapshot SHA, so the
    green e2e run covers the deploy. **PASS.**
  - Exit `1` → the snapshot predates the deploying SHA, so the green row does
    not cover what is being deployed. `gate_decision=fail-stale`.
  - Exit `>1` → a SHA could not be resolved locally (e.g. the short snapshot
    SHA is unknown because the checkout is shallow).
    `gate_decision=fail-missing`, with a hint to use `fetch-depth: 0`.
  The argument order is critical: inverting it would let stale snapshots pass
  while blocking fresh deploys.
- <a id="anchor-domain-fallback"></a>**Anchor domain fallback**: A service
  that owns tests under several tags is registered in e2e-testing's
  `.github/gate-services.json` with a `domains` array instead of a single
  `domain`. The producer folds those rows into one aggregate row keyed
  `<execution_tag>+#<service>` — but that aggregate row only appears at the
  **next board publish** after the registration merges. Until then the primary
  key misses, and without an anchor the only row left is the whole-fleet
  umbrella: the service is judged on some other team's failure.

  `anchor_domain_tag` fills that window with one extra lookup. Its value must
  be the **first** entry of that service's `domains` list, which is the same
  entry the release worker in e2e-testing uses as the anchor — the two sides
  must name the same row or they judge different evidence. A service registered
  with a single `domain` has no `domains` list, so it leaves the input empty and
  the resolution stays exactly the two-key one.

  ```text
  registry: "billy": { "domain": "@billing" }
    domain_tag: '@billing'   anchor_domain_tag: (empty)
    keys tried: @e2e+@billing -> @e2e+umbrella

  registry: "core": { "domains": ["@core", "@chat"] }
    domain_tag: '#core'      anchor_domain_tag: '@core'
    keys tried: @e2e+#core -> @e2e+@core -> @e2e+umbrella
  ```

  e2e-testing's `validate-gate-services` workflow cross-checks both values
  against the registry on every PR, so a drifted or missing `anchor_domain_tag`
  fails there rather than silently at release time.
- **`e2e-latest` anchor rationale**: The lightweight tag `e2e-latest` is
  force-pushed by the e2e-testing producer to the latest board commit after
  every e2e run on main, so the gate always reads a single, consistent
  `board.json` in two API calls (resolve tag, fetch file) regardless of how
  many tags or services exist.

## Operational note (E6 freeze trade-off)

There is no time-based freshness check (no `max_age_hours`, no timestamp
comparison). The gate is purely SHA-based: if the snapshot covers the
deploying SHA and the row is green, the deploy proceeds regardless of when
e2e last ran. The row's `ranAt` is surfaced in the job summary for humans, but
it is never part of the decision.

The trade-off is **E6 (freeze windows)**: during a stage-deploy freeze, the
scheduled e2e run will not advance the board, so production deploys for
commits made *after* the freeze began will fail with `fail-stale` until an
on-demand e2e run is triggered manually:

```bash
gh workflow run e2e-dispatch.yml -R OsomePteLtd/e2e-testing
```

This is the intended behavior: deploys never bypass e2e by virtue of "the
last run was recent enough" — they always require a snapshot that includes
the deploying commit.

## What's NOT in this action

- **No commit statuses.** v1 read per-tag GitHub commit statuses; the producer
  no longer emits them. The board file is the only source of truth.
- **No retry logic.** The board is fetched once. If an API call fails
  transiently the gate fails closed; re-run the workflow to retry.
- **No time-based freshness.** Freshness is enforced structurally via the
  ancestor check, not via wall-clock age of the board row.
- **No test execution.** The action only *reads* the board produced by the
  e2e-testing repo. It never runs Playwright, never installs dependencies,
  and never touches the calling service's test suite.
- **No git mutations.** The action performs no `git add`, `git commit`, or
  `git push`. The ancestor check only reads the local object database of the
  caller's checkout.
- **No third-party actions.** All work is done in pure bash composite steps,
  using `gh`, `jq`, and `git` already provisioned on the runner.
