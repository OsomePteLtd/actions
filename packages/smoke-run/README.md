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
          github-token: ${{ github.token }}
          tags: '@smoke @core'
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `service` | Yes | - | Caller repository name (e.g., `billy`, `pablo`) |
| `pool` | No | `test-3` | Comma-separated environment candidates |
| `lock-repo` | No | `OsomePteLtd/e2e-testing` | Repository hosting lock branches |
| `osome-bot-token` | Yes | - | Token with `contents:write` on lock-repo |
| `github-token` | Yes | - | Caller's `${{ github.token }}` for Deployments API |
| `tags` | No | `''` | Test tags exported as `TEST_TAGS` env var |
| `retry-interval-seconds` | No | `45` | Seconds between lock acquisition retries |
| `retry-timeout-seconds` | No | `900` | Total seconds to wait for lock |

## Outputs

| Output | Description |
|--------|-------------|
| `claimed-env` | The environment that was claimed |
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

**Current limitation (v1):** With `pool=test-3` (single environment), only one smoke run executes at a time.

- The first PR to claim the environment runs immediately
- Subsequent PRs retry every 45 seconds for up to 15 minutes
- If the timeout expires, the workflow fails with a clear error

**Implications:**
- In high-traffic periods, some PRs may fail their smoke check due to timeout
- Consider expanding the pool (e.g., `pool: test-3,test-4`) when more envs are available
- See PF-1763 for the reaper that cleans up stale locks

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

**Symptoms:** All smoke runs timeout waiting for the same environment.

**Resolution:**
1. Check for stale locks: `gh api /repos/OsomePteLtd/e2e-testing/git/refs/heads/lock-test-3`
2. Read `owner.json` to identify the stale run
3. Manually delete: `gh api -X DELETE /repos/OsomePteLtd/e2e-testing/git/refs/heads/lock-test-3`

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

**Symptoms:** Smoke run times out waiting for deployment

**Resolution:**
1. Check the service's Deploy workflow for errors
2. Verify the service supports `on: deployment:` trigger
3. Check if another deployment is blocking

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
