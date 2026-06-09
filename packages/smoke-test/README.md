# smoke-test

Composite GitHub Action that runs smoke tests against an already-claimed, already-deployed environment, releases the lock, publishes the Allure report to S3, and comments on the PR. Designed to be used with [`smoke-claim-deploy`](../smoke-claim-deploy) in an event-driven smoke flow.

## Overview

This action covers the second half of the smoke lifecycle (steps 4–12 from [`smoke-run`](../smoke-run)):

4. **Checkout e2e-testing** — Fetch the test repository
5. **Install dependencies** — pnpm + Playwright browsers
6. **Configure AWS credentials** — OIDC authentication for SSM + S3
7. **Fetch smoke credentials** — Load admin credentials from SSM Parameter Store
8. **Run smoke tests** — Execute `--project=smoke` tests
9. **Release lock** — Delete the lock branch (`always()`, skipped in transient-env mode)
10. **Generate Allure report** — Build HTML report from results
11. **Publish Allure report** — Upload to S3 bucket
12. **Comment on PR** — Upsert results summary with report link
13. **Surface exit code** — Fail the workflow if tests failed

## Usage

```yaml
# Triggered by the deployment_status event from smoke-claim-deploy's deployment
name: Smoke Tests (event-driven)

on:
  deployment_status:

jobs:
  smoke:
    if: >-
      github.event.deployment_status.state == 'success' &&
      github.event.deployment.payload.pr_number != ''
    runs-on: arc-runner-heavy
    permissions:
      contents: read
      id-token: write
      pull-requests: write
    steps:
      - name: Run smoke tests
        uses: OsomePteLtd/actions/packages/smoke-test@master
        with:
          service: ${{ github.event.repository.name }}
          claimed-env: ${{ github.event.deployment.environment }}
          pr-number: ${{ github.event.deployment.payload.pr_number }}
          osome-bot-token: ${{ secrets.OSOME_BOT_TOKEN }}
          tags: '@smoke @core'
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `service` | Yes | - | Caller repository name (e.g., `billy`, `pablo`) |
| `claimed-env` | Yes | - | The test-N environment to run against (from `smoke-claim-deploy` `claimed-env` output, or `github.event.deployment.environment` in the `deployment_status` workflow). Also the lock to release. |
| `target-url` | No | `''` | Pre-deployed transient environment URL. When set, `TEST_ENV` uses this URL and the lock release is skipped. |
| `pr-number` | Yes | - | PR number for the PR comment and Allure bucket. Pass `github.event.deployment.payload.pr_number` from the `deployment_status` event. |
| `tags` | No | `''` | Test tags exported as `TEST_TAGS` env var |
| `osome-bot-token` | Yes | - | **Must be a PAT** (e.g., `${{ secrets.OSOME_BOT_TOKEN }}`) with `contents:write` on lock-repo and `pull-requests:write` on the caller repo. Do NOT pass `${{ secrets.GITHUB_TOKEN }}`. |
| `lock-repo` | No | `OsomePteLtd/e2e-testing` | Repository hosting lock branches (must match what `smoke-claim-deploy` used) |

## Outputs

| Output | Description |
|--------|-------------|
| `smoke-exit-code` | Playwright process exit code |

## Lock Release Behaviour

The lock release step runs with `if: always()` so it fires even when tests fail, preventing stale locks. It is skipped when `target-url` is set (transient-env mode has no lock to release) or when `claimed-env` is empty.

Per-repo lock invariant: the branch name is `lock-${claimed-env}-${service}` (e.g. `lock-test-4-billy`), not `lock-${claimed-env}`. This ensures different services never block each other on the same test-N environment.

## Required Org-Level Secrets

| Secret | Purpose |
|--------|---------|
| `OSOME_BOT_TOKEN` | Cross-repo access for lock release, PR commenting |

## AWS Configuration

This action uses OIDC authentication. The caller workflow must include:

```yaml
permissions:
  id-token: write
```

The action assumes the role `arn:aws:iam::664258603548:role/github-deployer-nokms` — the org-standard role for GitHub Actions → AWS auth.

## Related

- [`smoke-claim-deploy`](../smoke-claim-deploy) — Claims the lock and creates the deployment
- [`smoke-run`](../smoke-run) — Original monolithic action (claim + deploy + poll + test + release)
- [PF-2234](https://reallyosome.atlassian.net/browse/PF-2234) — Event-driven smoke implementation ticket
