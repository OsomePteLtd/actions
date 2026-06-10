# smoke-claim-deploy

Composite GitHub Action that claims a test environment lock and creates a GitHub deployment, then exits immediately (no deployment polling). Designed to be used with [`smoke-test`](../smoke-test) in an event-driven smoke flow.

## Overview

This action covers the first half of the smoke lifecycle (steps 1–3 from [`smoke-run`](../smoke-run)):

1. **Claim environment** — Atomic lock acquisition via orphan git branch
2. **Write owner.json** — Record who holds the lock (ghost-lock reaper compatibility)
3. **Create deployment** — Trigger deployment via GitHub Deployments API, embed `pr_number` in payload, exit immediately

The deployment payload includes `pr_number` so the downstream `on: deployment_status` workflow can recover the PR number without native `pull_request` context.

## Usage

```yaml
name: Smoke Tests

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  claim-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    outputs:
      claimed-env: ${{ steps.claim-deploy.outputs.claimed-env }}
      deploy-id: ${{ steps.claim-deploy.outputs.deploy-id }}
    steps:
      - name: Claim env and create deployment
        id: claim-deploy
        uses: OsomePteLtd/actions/packages/smoke-claim-deploy@master
        with:
          service: ${{ github.event.repository.name }}
          pr-number: ${{ github.event.pull_request.number }}
          osome-bot-token: ${{ secrets.OSOME_BOT_TOKEN }}
```

The `smoke-test` action is then triggered by the resulting `deployment_status: success` event in a separate workflow.

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `service` | Yes | - | Caller repository name (e.g., `billy`, `pablo`) |
| `pool` | No | `test-4` | Comma-separated environment candidates |
| `lock-repo` | No | `OsomePteLtd/e2e-testing` | Repository hosting lock branches |
| `osome-bot-token` | Yes | - | **Must be a PAT** (e.g., `${{ secrets.OSOME_BOT_TOKEN }}`) with `contents:write` on lock-repo AND `deployments:write` on the caller repo. Do NOT pass `${{ secrets.GITHUB_TOKEN }}` — deployments created with `GITHUB_TOKEN` are silently ignored by GitHub and will never trigger `deploy.yml`. |
| `pr-number` | Yes | - | PR number. Embedded in the deployment payload so the downstream `deployment_status` workflow can recover it without native `pull_request` context. |
| `retry-interval-seconds` | No | `45` | Seconds between lock acquisition retries |
| `retry-timeout-seconds` | No | `900` | Total seconds to wait for lock |

## Outputs

| Output | Description |
|--------|-------------|
| `claimed-env` | The environment that was claimed from the pool |
| `deploy-id` | GitHub deployment ID (used by the downstream `deployment_status` workflow) |

## Required Org-Level Secrets

| Secret | Purpose |
|--------|---------|
| `OSOME_BOT_TOKEN` | Cross-repo access for lock management and deployment creation |

## Concurrency and Queueing

Locks are **per-service per-environment** (`lock-${ENV}-${SERVICE}`), so different services can smoke-test the same environment concurrently. See [`smoke-run`](../smoke-run) README for full concurrency documentation.

## Related

- [`smoke-test`](../smoke-test) — Runs tests against an already-claimed, already-deployed env
- [`smoke-run`](../smoke-run) — Original monolithic action (claim + deploy + poll + test + release)
- [PF-2234](https://reallyosome.atlassian.net/browse/PF-2234) — Event-driven smoke implementation ticket
