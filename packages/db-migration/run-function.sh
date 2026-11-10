#!/usr/bin/env bash
# Deploys one Serverless function and invokes it. DBM_FUNCTION_ENV holds KEY=VALUE lines that are
# exported for the deploy only (e.g. NODE_OPTIONS, NPM_CONFIG_LEGACY_PEER_DEPS, SLS_DEBUG).
# DBM_MODE=deploy|invoke|both. DBM_INVOKE_REGION (optional) pins the invoke's region.
# Env: DBM_SLS, DBM_STAGE, DBM_FUNCTION, DBM_FUNCTION_ENV, DBM_MODE, DBM_INVOKE_REGION.
# Every input is DBM_-prefixed because the Serverless process inherits this environment: a generic
# name such as STAGE changes how repos' serverless.ts evaluates (billy: STAGE=stage|production
# enables Sentry at config load, which crashed `serverless deploy`).
set -euo pipefail

deploy() {
  (
    while IFS= read -r line; do
      line=$(sed -E 's/^[[:space:]]+|[[:space:]]+$//g' <<< "$line")
      [ -z "$line" ] && continue
      [[ "$line" == *=* ]] || { echo "::error::Invalid env line '${line}' (expected KEY=VALUE)"; exit 1; }
      # shellcheck disable=SC2163 # exporting the KEY=VALUE line itself is the intent
      export -- "$line" || exit 1
    done <<< "${DBM_FUNCTION_ENV:-}"
    # shellcheck disable=SC2086 # DBM_SLS may be a multi-word command such as "npx sls"
    $DBM_SLS deploy function --stage "$DBM_STAGE" --function "$DBM_FUNCTION"
  )
}

invoke() {
  # shellcheck disable=SC2086
  $DBM_SLS invoke --stage "$DBM_STAGE" --function "$DBM_FUNCTION" ${DBM_INVOKE_REGION:+--region "$DBM_INVOKE_REGION"}
}

case "$DBM_MODE" in
  deploy) deploy ;;
  invoke) invoke ;;
  both)
    deploy
    invoke
    ;;
  *) echo "::error::Unknown DBM_MODE '${DBM_MODE}'"; exit 1 ;;
esac
