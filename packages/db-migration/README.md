# db-migration

Replaces the `Deploy/Invoke migrate function` and `Deploy/Invoke try-canary function` steps in backend deploy jobs ([PF-3512](https://reallyosome.atlassian.net/browse/PF-3512)).

| Stage | Migrations | try-canary |
|---|---|---|
| production | always | yes |
| stage | always | no |
| test-N | only if the deployed commit changes `migrations-path` vs `base-ref`, or is `base-ref` itself (identical/behind, e.g. weekly scheduled deploys of `main`) | no |

If the check can't prove there are no migration changes, migrations run. That covers a compare API failure, a missing file list, and a list at the API's 300-file cap.

### Known limitation

The test-N check compares the deployed commit against `base-ref`, not against what the env's database already has. A branch with no migration changes of its own will not apply migrations merged to `base-ref` after that env last migrated. Since PR smoke deploys go to whichever test env is least loaded, a PR can land on an env that missed a recent migration. A later deploy of `base-ref` itself, or of any branch that changes migrations, brings the env up to date.

## Usage

Place it where the old steps were: after checkout, AWS credentials, `npm ci` and the Serverless license, before `Deploy module`. Those setup steps are needed by `Deploy module` in the same job anyway, so skipping migrations saves only the migrate deploy and invoke here. Core differs because its migrations run in a separate job.

```yaml
- name: DB migration
  uses: osomepteltd/actions/packages/db-migration@master
  with:
    stage: ${{ needs.setup.outputs.stage }}
```

The deploy job needs `contents: read`; every current deploy job already has it.

## Inputs

| Input | Default | Purpose |
|---|---|---|
| `stage` | required | Serverless stage |
| `serverless-command` | `node_modules/.bin/serverless` | e.g. `npx sls` |
| `working-directory` | `.` | Where serverless config and `node_modules` live |
| `deploy-sha` | `github.sha` | Commit compared against `base-ref` |
| `token` | `github.token` | Compare API |
| `migrate` | `true` | `false` when the repo has no migrate function |
| `migrate-function` | `migrate` | |
| `migrate-env` | | `KEY=VALUE` lines exported only while deploying migrate |
| `migrations-path` | `db/migrations/` | e.g. `alembic/versions/` |
| `base-ref` | `main` | |
| `conditional-stages-pattern` | `^test-[1-9][0-9]*$` | Stages that migrate only on changes; `^$` = always migrate everywhere |
| `try-canary` | `true` | `false` when the repo has no try-canary function |
| `try-canary-function` | `try-canary` | |
| `try-canary-stages` | `production` | Space-separated stages, or `all` (previous behaviour) |
| `try-canary-env` | | `KEY=VALUE` lines exported only while deploying try-canary |
| `try-canary-s3-fallback` | `false` | On a failed deploy, upload `.serverless/<service-name>.zip` to S3, update the lambda and invoke it |
| `service-name` | repository name | S3 fallback zip and lambda name |
| `aws-region` | `us-east-1` | S3 fallback: bucket, lambda update + wait, invoke |
| `s3-bucket` | `osome-serverless-<stage>-<aws-region>` | S3 fallback |
| `mode` | `all` | `all`, `check` (decide only) or `run` (use `migrations-required`) |
| `migrations-required` | `false` | `mode: run` only: the `check` step's output |

Outputs: `migrations-required`, `try-canary-ran`, `setup-required`.

### Jobs that only migrate

When migrations live in their own job (core), that job's checkout, `npm ci` and Serverless license exist only for the migrate and try-canary deploys. Call the action twice so the job can skip setup entirely when nothing runs:

```yaml
- name: Check DB migration
  id: db-migration
  uses: osomepteltd/actions/packages/db-migration@master
  with:
    mode: check
    stage: ${{ inputs.env || github.event.deployment.environment }}

# checkout, AWS credentials, setup-node, npm ci, Serverless license:
#   if: steps.db-migration.outputs.setup-required == 'true'

- name: DB migration
  if: steps.db-migration.outputs.setup-required == 'true'
  uses: osomepteltd/actions/packages/db-migration@master
  with:
    mode: run
    migrations-required: ${{ steps.db-migration.outputs.migrations-required }}
    stage: ${{ inputs.env || github.event.deployment.environment }}
```

`mode: check` needs only the token; it makes no Serverless or AWS calls.

## Per-repo inputs

Inputs that reproduce each repo's current steps. Anything not listed uses the default.

| Repo | Stage expression | Inputs |
|---|---|---|
| alfred, auditor, dealer, invoker, jamal, payot, pechkin, plutus, scrooge, shiva, winston | `needs.setup.outputs.stage` | — |
| analytix | `needs.setup.outputs.stage` | — (`sls deploy -f X` is the same as `deploy function`) |
| lilith | `needs.setup.outputs.stage` | `migrations-path: alembic/versions/` |
| billy | `needs.setup.outputs.stage` | `migrate-env: NPM_CONFIG_LEGACY_PEER_DEPS=true`, `try-canary-env` with `NPM_CONFIG_LEGACY_PEER_DEPS=true` and `NODE_OPTIONS=--max-old-space-size=4096` |
| hermes, hero | `needs.setup.outputs.stage` | `try-canary-env: NODE_OPTIONS=--max_old_space_size=4096` |
| pablo | `needs.setup.outputs.stage` | `try-canary-env: NODE_OPTIONS=--max-old-space-size=4096` |
| roberto | `inputs.env \|\| github.event.deployment.environment` | `migrate-env: SLS_DEBUG=*`, `try-canary-env: NODE_OPTIONS=--max-old-space-size=8192` |
| enrique | `needs.setup.outputs.stage` | `try-canary: 'false'` |
| cheburashka, skyler | `needs.setup.outputs.stage` | `migrate: 'false'` |
| bouncer | `inputs.env \|\| github.event.deployment.environment` | `migrate: 'false'`, `serverless-command: npx sls` |
| core | `inputs.env \|\| github.event.deployment.environment` | Two-step (see *Jobs that only migrate*): `mode: check`, then `mode: run` with `try-canary-env: NODE_OPTIONS=--max-old-space-size=8192`, `try-canary-s3-fallback: 'true'`, `service-name: core` |

Multiple env lines use a block scalar:

```yaml
    try-canary-env: |
      NPM_CONFIG_LEGACY_PEER_DEPS=true
      NODE_OPTIONS=--max-old-space-size=4096
```

## Tests

`bash packages/db-migration/test.sh` runs the unit tests. `.github/workflows/_db-migration-selftest.yml` also runs the composite end to end against stub `serverless`/`aws` binaries on every PR that touches this package.
