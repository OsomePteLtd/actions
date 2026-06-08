# smoke-run

Composite GitHub Action that claims a test environment, deploys a PR, runs Playwright smoke tests, publishes Allure reports to S3, and releases the lock.

## Overview

This action implements a 12-step smoke test lifecycle:

1. **Claim environment** - Atomic lock acquisition via orphan git branch
2. **Write owner.json** - Record who holds the lock
3. **Deploy PR** - Trigger deployment via GitHub Deployments API
4. **Checkout e2e-testing** - Fetch the test repository
5. **Install dependencies** - pnpm + Playwright browsers
6. **Configure AWS credentials** - OIDC authentication for SSM + S3
7. **Fetch smoke credentials** - Load admin credentials from SSM Parameter Store
8. **Run smoke tests** - Execute `--project=smoke` tests
9. **Generate Allure report** - Build HTML report from results
10. **Publish Allure report** - Upload to S3 bucket
11. **Comment on PR** - Upsert results summary with report link
12. **Release lock** - Delete the lock branch (always runs)

## Usage

```yaml
name: Smoke Tests

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  smoke:
    runs-on: arc-runner-heavy
    permissions:
      pull-requests: write
      contents: read
      id-token: write   # for AWS OIDC (SSM + S3)
    steps:
      - uses: actions/checkout@v4

      - name: Run smoke tests
        uses: OsomePteLtd/actions/packages/smoke-run@master
        with:
          service: ${{ github.event.repository.name }}
          osome-bot-token: ${{ secrets.OSOME_BOT_TOKEN }}
          tags: '@smoke @core'
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `service` | Yes | - | Caller repository name (e.g., `billy`, `pablo`) |
| `pool` | No | `test-3` | Comma-separated environment candidates |
| `lock-repo` | No | `OsomePteLtd/e2e-testing` | Repository hosting lock branches |
| `osome-bot-token` | Yes | - | **Must be a PAT** (e.g., `${{ secrets.OSOME_BOT_TOKEN }}`) with `contents:write` on lock-repo AND `deployments:write` + `pull-requests:write` on the caller repo. Do NOT pass `${{ secrets.GITHUB_TOKEN }}` — deployments created with `GITHUB_TOKEN` are silently ignored by GitHub and will never trigger `deploy.yml`. |
| `tags` | No | `''` | Test tags exported as `TEST_TAGS` env var |
| `retry-interval-seconds` | No | `45` | Seconds between lock acquisition retries |
| `retry-timeout-seconds` | No | `900` | Total seconds to wait for lock |
| `deploy-timeout-seconds` | No | `900` | Total seconds to wait for the deployment to reach a terminal status |
| `target-url` | No | `''` | Pre-deployed transient environment URL (see [Target-URL Mode](#target-url-mode)) |
| `pr-number` | No | `''` | PR number for the PR comment + Allure bucket when there is no native `pull_request` context, e.g. a `deployment`-triggered caller |

## Target-URL Mode

When `target-url` is set to a non-empty URL (e.g. `https://<branch>.my.osome.club`), smoke-run
operates in **target-url mode**:

- Steps 1–3 (claim, owner.json, deploy) are **skipped** — the env is already live.
- Step 9 (release lock) is **skipped** — there is no lock to release.
- `TEST_ENV` is set to the `target-url` value so `resolveSmokeEnv` in `environments.ts`
  follows the transient-env path.
- The stage agent API is used as the backend, so company creation and login remain on the
  shared stage backend.
- `claimed-env` output is empty in this mode.

This mode is used by MFE callers (e.g. `websome-reports`) whose per-PR transient environment
(`https://<sanitized-branch>.my.osome.club`) is deployed by the MFE's own CI pipeline.
The caller's `pr-smoke.yml` derives the URL from `github.head_ref` and passes it in.

```yaml
# Caller example (transient-env / MFE workflow — pull_request trigger)
- uses: osomepteltd/actions/packages/smoke-run@master
  with:
    service: websome-reports
    target-url: https://${{ env.SANITIZED_BRANCH }}.my.osome.club
    osome-bot-token: ${{ secrets.OSOME_BOT_TOKEN }}
```

```yaml
# Caller example (deployment-event trigger — no native pull_request context)
# The MFE deploy.yml receives a `deployment` event and passes the PR number
# stored in the deployment payload so smoke-run can comment on the correct PR
# and route the Allure report to the right PR-{n} bucket.
jobs:
  pr-smoke:
    needs: deploy
    if: github.event.deployment.environment != 'production' &&
        github.event.deployment.payload.pr_number != ''
    uses: osomepteltd/e2e-testing/.github/workflows/pr-smoke.yml@main
    with:
      service: websome-reports
      target-url: ${{ format('https://{0}.my.osome.club', github.event.deployment.environment) }}
      pr-number: ${{ github.event.deployment.payload.pr_number }}
    secrets:
      osome-bot-token: ${{ secrets.OSOME_BOT_TOKEN }}
```

## Outputs

| Output | Description |
|--------|-------------|
| `claimed-env` | The environment that was claimed (empty when `target-url` is set) |
| `smoke-exit-code` | Playwright process exit code |

## Required Org-Level Secrets

The calling repository must have access to these secrets:

| Secret | Purpose |
|--------|---------|
| `OSOME_BOT_TOKEN` | Cross-repo access for lock management |

## Infrastructure Prerequisites

The action assumes the following AWS resources exist in account `664258603548` (us-east-1):

### SSM Parameters

- `/smoke/agent/email` (String) — admin user email used by the Playwright fixture
- `/smoke/agent/password` (SecureString) — admin user password (KMS-encrypted)

Anyone with AWS console access can rotate these via Parameter Store.

### IAM Role: `github-deployer-nokms` (already exists)

Smoke-run uses the existing org-standard role (`arn:aws:iam::664258603548:role/github-deployer-nokms`) — same role used by every OSOME service's `default.yml` and `deploy.yml` for GitHub Actions → AWS auth. The role's trust policy is `repo:OsomePteLtd/*`, so any OSOME repo can assume it via OIDC; new smoke-onboarded services need **zero** infra changes.

The role's policy already grants `ssm:Get*` and `s3:*`, which covers everything smoke-run needs (SSM fetch + Allure upload).

## AWS Configuration

This action uses OIDC authentication with AWS. The caller workflow must include:

```yaml
permissions:
  id-token: write
```

The action assumes the role `arn:aws:iam::664258603548:role/github-deployer-nokms` — the org-standard role for GitHub Actions → AWS auth.

## Concurrency and Queueing

Locks are **per-service per-environment** (`lock-${ENV}-${SERVICE}`), so different services
can smoke-test the same environment concurrently — each service deploys only its own code to
the shared env and runs only its domain-tagged specs.

- Two PRs of the **same** service serialize on `lock-${ENV}-${SERVICE}`: the first claims it
  immediately, the rest retry every 45 seconds for up to 15 minutes.
- Two PRs of **different** services do NOT block each other (distinct lock branches).
- If the lock-wait timeout expires, the workflow fails with a clear error.

**Implications:**
- Same-service high-traffic periods may still time out; expand the pool
  (e.g., `pool: test-3,test-4`) when more envs are available.
- See PF-1763 for the reaper that cleans up stale locks.

## Test Environment Staleness

Test environments (`test-3`, etc.) sync from `main` **twice daily** at:
- 02:00 SGT (18:00 UTC previous day)
- 12:00 SGT (04:00 UTC)

**Implications:**
- Smoke tests run against data that may be up to 12 hours old
- The PR comment includes a disclaimer about this
- For time-sensitive tests, trigger a manual sync first

## Troubleshooting

### Lock not released after workflow cancellation

If a workflow is cancelled mid-run, the lock may not be released.

**Symptoms:** All smoke runs for the affected service timeout waiting for its environment lock.

**Resolution:**
1. Check for stale locks: `gh api /repos/OsomePteLtd/e2e-testing/git/refs/heads/lock-test-3-<service>`
2. Read `owner.json` to identify the stale run
3. Manually delete: `gh api -X DELETE /repos/OsomePteLtd/e2e-testing/git/refs/heads/lock-test-3-<service>`

**Long-term:** PF-1763 will implement an automatic reaper for stale locks.

### AWS authentication failed

**Symptoms:** `Error: Could not assume role with OIDC`

**Resolution:**
1. Verify the workflow has `permissions: id-token: write`
2. Check that `arc-runner-heavy` runners have OIDC support
3. Verify the IAM role trust policy includes the repository

### S3 403 Forbidden

**Symptoms:** `An error occurred (AccessDenied) when calling the PutObject operation`

**Resolution:**
1. Verify the `github-deployer-nokms` role has `s3:PutObject` on `osome-allure-reports` bucket
2. Check bucket policy allows the role
3. Verify the role trust policy includes `repo:OsomePteLtd/*`

### Deployment stuck in pending

**Symptoms:** Smoke run logs `Deployment status: pending` repeatedly, then fails with `Deployment timed out after <deploy-timeout-seconds>s` (default 900). The deployment object in GitHub's Deployments API shows state `queued` permanently.

**Most common cause — `osome-bot-token` is the workflow `GITHUB_TOKEN` instead of a PAT.**

GitHub silently drops `deployment` events created with the auto-generated `GITHUB_TOKEN`. The consumer's `deploy.yml` never receives the event, never runs, and never posts a status update. Smoke-run polls until `deploy-timeout-seconds` (default 900s) elapses, then times out.

**Fix:** Pass `${{ secrets.OSOME_BOT_TOKEN }}` (a PAT) for `osome-bot-token`, not `${{ github.token }}` or `${{ secrets.GITHUB_TOKEN }}`. Note that with `GITHUB_TOKEN` the action will actually fail much earlier at the lock-claim step (HTTP 403 against the e2e-testing repo), so this exact symptom only arises if a PAT lacks `deployments:write` on the caller repo.

**Other possible causes (once token is confirmed correct):**
1. **Deployment ref is an unreachable merge SHA.** On `pull_request` events, `github.sha` resolves to the synthetic merge commit (`refs/pull/N/merge`), which is not reachable from any branch or tag. GitHub silently drops `on: deployment` events whose ref is unreachable, so `deploy.yml` never fires. Smoke-run uses `github.event.pull_request.head.sha || github.sha` to avoid this, but if you are wiring up a new service and pass `github.sha` directly to the Deployments API, you will hit this. Confirm with:
   ```bash
   gh api /repos/ORG/REPO/commits/<deployment-ref> --jq '{parents_count: (.parents | length), message: .commit.message}'
   # If parents_count == 2 and message starts with "Merge ...", the ref is a merge SHA.
   ```
   Fix: pass `${{ github.event.pull_request.head.sha || github.sha }}` as the deployment `ref`.
2. The service's `deploy.yml` doesn't handle the environment name smoke-run claimed (e.g., `test-3`). Verify `on: deployment:` triggers a job that processes `test-N` envs.
3. `deploy.yml` runs but errors before posting a status — check Deploy workflow logs for the PR's SHA.
4. Self-hosted runners are exhausted — check runner pool availability in the org's Actions settings.

## S3 Report Structure

Reports are published to:

```
s3://osome-allure-reports/
  smoke/
    {service}/
      PR-{n}/          # Per-PR reports (ephemeral lifecycle tag)
      latest/          # Most recent report
      history.jsonl    # Trend data across runs
```

- PR reports are tagged for lifecycle cleanup
- `latest/` is overwritten on each run
- `history.jsonl` preserves trend data

## Related

- [e2e-testing](https://github.com/OsomePteLtd/e2e-testing) - Test repository
- [PF-1759](https://reallyosome.atlassian.net/browse/PF-1759) - Implementation ticket
- [PF-1763](https://reallyosome.atlassian.net/browse/PF-1763) - Reaper for stale locks
