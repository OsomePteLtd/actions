# Per-pilot migration gaps (DRAFT)

The source copies are working trees with no `.git` (shiva on main; scrooge on branch
`fix/flaky-tests-db-connections`). Branch diffs **can't be computed** here. The likely
branch-specific scrooge content is `detect-flaky-tests.yml:82-88` (ITG-1601 comment: switched to
`test:ci`). It does not affect pr-checks.yml mapping. Currently *required* checks can't be
determined from files; check branch protection.

## Known gap / follow-up

The deploy job's per-env concurrency group (`deploy-record-<repository>-<stage>`, `cancel-in-progress: false`) only serializes creation of the GitHub deployment record inside `backend.yml`. It does not guarantee the newest commit gets deployed.

Downstream app deploy workflows (shiva and invoker `deploy.yml`, scrooge `deploy-application.yml`) use `packages/cancel-when-already-running` in this repo. That composite lists in-progress workflow runs with `event=deployment`. When another run named `Deploy` is `in_progress` for the same environment (`stage` or `production`, compared to the run's `display_title`) and a different `run_number`, it cancels **the run that is executing the action** (via `andymckay/cancel-action`) and then waits until that cancellation lands. A newer deploy that starts while an older `Deploy` is still in progress therefore cancels itself. The older commit finishes and the newer one is dropped.

This change does not modify `packages/cancel-when-already-running`.

Follow-up, tracked separately (relates to PF-2686): replace `cancel-when-already-running` in those app deploy workflows with a per-env `concurrency` group (`cancel-in-progress: false`, so runs queue) so the latest commit still deploys.

## shiva (`default.yml`, 275 lines → `callers/shiva.yml`, 31 lines)
| Area | Today | With skeleton | Gap / action |
|---|---|---|---|
| Cancel | styfle cancel-workflow-action (S:30-33), cancels on every event | Callee concurrency, PR only | Main/tag runs no longer cancelled (intended) |
| Runners | All jobs `azure-aks-medium-arm` (S:24,45,125,210,260) | light: setup/coverage/deploy; heavy: static/tests (`arc-runner-heavy`) | Perf change. Compare with PF-2683 baseline |
| Action majors | checkout/setup-node @v6, upload @v7, download @v8 | SHA-pinned v4 (PF-2684) | **Downgrade**. Open Q1 |
| Static checks | 6 named steps (S:89-105) | One looped step, same order | Step-level log names become `::group::` |
| Services | `osomecache…/postgres:latest`, `redis:latest` (S:137,153) | `services_registry` → `postgres:16`, `redis:7` | Tag change. Confirm |
| Timeouts | None | All jobs | PF-2958 satisfied |
| Diff check | None | Off (`run_diff_check: false`) | Unknown whether bin/checkBranchDiff.js exists |
| Deploy ref | `github.head_ref` (S:274), empty on tag/dispatch | `head_ref || ref_name` | Fix |
| AWS session | `github.repository.id` (S:65), empty | `gha-<repository_id>` | Fix |
| npm cache | None | setup-node `cache: npm` | Speed-up |
| report-coverage | checkout + node + npm ci (S:218-238) | Checkout stays (jest-coverage `require()`s `./jest.config.js`). No Node install | Speed-up is the skipped install. A config that `require()`s a package from `node_modules` would still fail |
| dispatch input | `environment` (S:12-16), read by get-deployment-stages | Kept in caller | None |

**Check names:** `Set up` → `ci / Set up`; `Static checks` → `ci / Static checks`;
`Unit tests (1..6)` → `ci / Unit tests (1..6)`; `Report coverage` → `ci / Report coverage`;
`Deploy (<stage>)` → `ci / Deploy (<stage>)`. New: `ci / CI status` (recommended sole required
check), `ci / Git diff check` (skipped). Unchanged: `smoke` (smoke.yml).

**Secrets in CI:** OSOME_BOT_TOKEN, NPMJS_KEY_READ_ONLY, DOCKER_CACHE_USER, DOCKER_CACHE_PASSWORD,
github.token (styfle, dropped). Deploy/smoke (unchanged): OSOME_QA_APP_PRIVATE_KEY, JIRA_SITE/
USERNAME/PASSWORD, SLACK_TOKEN, GRAFANA_BUILDER_LB_TOKEN/GRAFANA_TOKEN, SENTRY_AUTH_TOKEN; var
OSOME_QA_APP_ID.

## scrooge (`pr-checks.yml`, 224 lines → `callers/scrooge.yml`, 45 lines)
| Area | Today | With skeleton | Gap / action |
|---|---|---|---|
| Edit filter | `if:` on setup (R:24), plus `needs.setup.result != 'skipped'` on deploy (R:184) | Single `if:` on the caller `ci` job | Title edits skip the whole run and never cancel a run. Prior checks on the same SHA remain |
| Dependabot combine | Step in setup (R:36-44), blocks stages | Separate caller job, parallel | Ordering change. Confirm it is OK to run in parallel |
| Static checks | `npm run static-checks` (R:94) | `static_check_scripts: static-checks` | None |
| Tests | Unsharded `npm run test:ci`, no coverage (R:174-175) | `shards:[1]`, `enable_sharding:false`, `report_coverage:false` | Check name gains a ` (1)` suffix |
| Runners | static on arc-runner-heavy, tests on azure-aks-medium-arm (R:56,114) | Both heavy (arc-runner-heavy) | Tests move off azure-aks-medium-arm |
| Labeling | `Add PR labels` job in CI (R:199-224) | Move to its own `labeler.yml` (not drafted) | **Gap: file not yet written**. Keep the job name so the check name stays the same |
| Deploy | No `override: true` (R:191-197) | `override: true` (B:439) | Behaviour change for deployment records. Confirm |
| Action majors / services / timeouts / npm cache | as shiva (R:68,126,142) | as shiva | as shiva |
| AWS session | Already `repository_id` (R:74) | Same | None |
| smokeWorkflow.test.ts | Contract test (not in copied material) | Smoke/deploy files untouched | Run it on the migration PR. If it parses pr-checks.yml, it may need an update (undetermined) |

**Check names:** `Set up` → `ci / Set up`; `Static checks` → `ci / Static checks`;
`Unit tests` → `ci / Unit tests (1)`; `Deploy (<stage>)` → `ci / Deploy (<stage>)`;
`Add PR labels` unchanged if moved with the same job name. New: `ci / CI status`,
`ci / Report coverage` and `ci / Git diff check` (both skipped), `dependabot-combine`. Unchanged: `smoke`.

**Secrets in CI:** OSOME_BOT_TOKEN, NPMJS_KEY_READ_ONLY, DOCKER_CACHE_USER, DOCKER_CACHE_PASSWORD,
GITHUB_TOKEN (labeler). Deploy/smoke (unchanged): OSOME_QA_APP_PRIVATE_KEY, JIRA_*, SLACK_TOKEN,
SLACK_WEBHOOK, GRAFANA_BUILDER_*, SENTRY_API_TOKEN; vars OSOME_QA_APP_ID.

## Cross-cutting gaps (both)
- `setup-runtime` is `packages/setup-runtime/action.yml`. There is no `v1` tag on this repo
  (`git ls-remote --tags` is empty), so `backend.yml` and the example callers reference
  `@master`. Pinning `@v1` fails until that tag exists.
- The empty-image service skip (`services: false`) relies on GitHub skipping services whose
  image is an empty string. The landed expression forces that empty string (`inputs.services && (registry image || default image) || ''`). The draft's `!inputs.services && '' || <image>` never produced `''`, because an empty string is falsy and `||` fell through to the image. Still verify the empty-image skip on a test repo.
- Optional DOCKER_CACHE_* secrets: behaviour of `credentials` with empty values for public
  images is unverified (B already does this, B:275-277).
- Not done: PF-2683 baseline numbers (needs Actions API data), the diff-check composite
  (PF-3243), and the labeler.yml split.
