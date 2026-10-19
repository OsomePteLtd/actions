# Backend CI

```
changes -> setup -> checks + diff-check + workflow-lint + terraform-lint -> tests (N) -> coverage -> deploy-trigger
                                                                         ci-status (always, only required check)
```

| Layer | Owns |
|---|---|
| `.github/workflows/backend.yml` | order, needs/if, path rules, services, shard matrix, permissions, timeouts, runners |
| `ci/<stage>/action.yml` | the steps of one stage |
| caller (`examples/*.yml`) | inputs + explicit secrets only |

## Path rules (inside the skeleton, not trigger `paths:`)
| Change on PR | Runs | Skipped (= success in CI status) |
|---|---|---|
| code (or any file matching no group) | changes, setup, checks, diff-check, tests×N, coverage, deploy-trigger | — |
| infra only | changes, setup, lint job → linter.yml terraform (auto-skips if no `.tf`) | checks, tests, coverage |
| workflows only | changes, setup, checks (light: no tests), lint job → linter.yml (actionlint + SHA pins) | tests, coverage, diff-check |
| docs only | changes, setup | everything heavy |
| mixed | union of the rows above | — |
| push / tag / dispatch / merge_group | full (all groups true) | — |

`CI status` (always runs): fails on any `failure`/`cancelled`; `skipped` passes, **except** a gate the rules required (code→checks+tests, workflows→checks+lint, infra→lint), which must be `success`. `changes` and `setup` must always succeed.
Default globs (override via `code_globs`, `infra_globs`, `workflows_globs`, `docs_globs`):
- code: `src/** db/** bin/** test/** tests/** package.json package-lock.json .npmrc .nvmrc tsconfig* jest* serverless* *.serverless.ts webpack* migrations.js secrets.json .sequelizerc .eslintrc* .prettierrc* .depcheckrc .cspell.json knip* i18next* eslint-plugin-*/** docker-compose.yml`
- infra: `terraform/** infra/** **/*.tf **/*.tfvars **/.tflint.hcl`
- workflows: `.github/**`
- docs: `**/*.md docs/**`
Unmatched file ⇒ code (fail safe). `src/x.md` matches docs + code ⇒ code.

CD: `deploy-backend.yml`, queued per env (`cancel-in-progress: false`), never cancels.
Use: copy `examples/shiva.yml`. Required: `ci_role_arn` (variable, no default), `static_scripts`, 4 secrets.
Caller job grants `contents: read, id-token: write, pull-requests: read`. Required check: `ci / CI status`.
Versioning: callers use `@master` (no release tags for now), so every merge to master reaches all callers on their next run. Rollback: revert the change on master, or pin the caller to a known-good commit SHA.
