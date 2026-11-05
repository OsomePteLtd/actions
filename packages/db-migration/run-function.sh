#!/usr/bin/env bash
# Deploys one Serverless function and invokes it. FUNCTION_ENV holds KEY=VALUE lines that are
# exported for the deploy only (e.g. NODE_OPTIONS, NPM_CONFIG_LEGACY_PEER_DEPS, SLS_DEBUG).
# MODE=deploy|invoke|both. INVOKE_REGION (optional) pins the invoke's region.
# Env: SLS, STAGE, FUNCTION, FUNCTION_ENV, MODE, INVOKE_REGION.
set -euo pipefail

deploy() {
  (
    while IFS= read -r line; do
      line=$(sed -E 's/^[[:space:]]+|[[:space:]]+$//g' <<< "$line")
      [ -z "$line" ] && continue
      [[ "$line" == *=* ]] || { echo "::error::Invalid env line '${line}' (expected KEY=VALUE)"; exit 1; }
      # shellcheck disable=SC2163 # exporting the KEY=VALUE line itself is the intent
      export -- "$line"
    done <<< "${FUNCTION_ENV:-}"
    # shellcheck disable=SC2086 # SLS may be a multi-word command such as "npx sls"
    $SLS deploy function --stage "$STAGE" --function "$FUNCTION"
  )
}

invoke() {
  # shellcheck disable=SC2086
  $SLS invoke --stage "$STAGE" --function "$FUNCTION" ${INVOKE_REGION:+--region "$INVOKE_REGION"}
}

case "$MODE" in
  deploy) deploy ;;
  invoke) invoke ;;
  both) deploy && invoke ;;
  *) echo "::error::Unknown MODE '${MODE}'"; exit 1 ;;
esac
