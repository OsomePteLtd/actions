#!/usr/bin/env bash
# Unit tests for check-migrations.sh and run-function.sh. Stubs `gh` (applies the script's --jq
# filter to a canned compare response) and the Serverless CLI (records its calls).
set -uo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
FAILURES=0

cat > "$TMP/gh" <<'EOF'
#!/usr/bin/env bash
[ -s "$FAKE_RESPONSE" ] || { echo 'gh: Server Error (HTTP 500)' >&2; exit 1; }
while [ "$#" -gt 0 ]; do [ "$1" = --jq ] && FILTER=$2; shift; done
jq -r "$FILTER" "$FAKE_RESPONSE"
EOF
cat > "$TMP/sls" <<'EOF'
#!/usr/bin/env bash
echo "$* NODE_OPTIONS=${NODE_OPTIONS:-} LEGACY=${NPM_CONFIG_LEGACY_PEER_DEPS:-}" >> "$SLS_LOG"
EOF
chmod +x "$TMP/gh" "$TMP/sls"

files() { jq -cn --args '{files: [$ARGS.positional[] | {filename: .}]}' "$@"; }
code_files() { local i out=(); for ((i = 0; i < $1; i++)); do out+=("src/f$i.ts"); done; files "${out[@]}"; }

check() { # stage response [migrations-path] → prints required=...
  printf '%s' "$2" > "$TMP/response.json"
  : > "$TMP/output"
  PATH="$TMP:$PATH" FAKE_RESPONSE="$TMP/response.json" GITHUB_OUTPUT="$TMP/output" \
    GITHUB_REPOSITORY=OsomePteLtd/repo STAGE=$1 DEPLOY_SHA=abc123 BASE_REF=main \
    MIGRATIONS_PATH=${3:-db/migrations/} CONDITIONAL_STAGES_PATTERN='^test-[1-9][0-9]*$' \
    RETRY_SLEEP_SECONDS=0 bash "$HERE/check-migrations.sh" > /dev/null
  cat "$TMP/output"
}

expect() { # name expected actual
  if [ "$2" = "$3" ]; then echo "ok   - $1"; else echo "FAIL - $1: expected '$2', got '$3'"; FAILURES=$((FAILURES + 1)); fi
}

expect 'stage always migrates' required=true "$(check stage "$(code_files 1)")"
expect 'production always migrates' required=true "$(check production "$(code_files 1)")"
expect 'test-N without migration changes skips' required=false "$(check test-4 "$(code_files 12)")"
expect 'test-N with a migration change migrates' required=true "$(check test-4 "$(files src/a.ts db/migrations/20261102-x.js)")"
expect 'migrations-path without trailing slash still matches' required=true "$(check test-4 "$(files alembic/versions/1_x.py)" alembic/versions)"
expect 'custom migrations-path ignores db/migrations' required=false "$(check test-4 "$(files db/migrations/x.js)" alembic/versions/)"
expect 'capped 300-file list without migrations migrates' required=true "$(check test-4 "$(code_files 300)")"
expect 'missing file list migrates' required=true "$(check test-4 '{"status":"ahead"}')"
expect 'unreadable compare migrates' required=true "$(check test-4 '')"
expect 'test-0 is not a conditional stage' required=true "$(check test-0 "$(code_files 1)")"

run() { # mode env-lines → prints recorded serverless calls
  : > "$TMP/sls.log"
  SLS="npx-like $TMP/sls" SLS_LOG="$TMP/sls.log" STAGE=test-4 FUNCTION=try-canary FUNCTION_ENV=$2 MODE=$1 \
    PATH="$TMP:$PATH" bash -c "npx-like() { \"\$@\"; }; export -f npx-like; bash '$HERE/run-function.sh'" > /dev/null 2>&1
  echo "rc=$? $(tr '\n' '|' < "$TMP/sls.log")"
}

expect 'both deploys then invokes, env only on deploy' \
  'rc=0 deploy function --stage test-4 --function try-canary NODE_OPTIONS=--max-old-space-size=4096 LEGACY=true|invoke --stage test-4 --function try-canary NODE_OPTIONS= LEGACY=|' \
  "$(run both $'  NODE_OPTIONS=--max-old-space-size=4096\n\nNPM_CONFIG_LEGACY_PEER_DEPS=true  ')"
expect 'deploy mode only deploys' 'rc=0 deploy function --stage test-4 --function try-canary NODE_OPTIONS= LEGACY=|' "$(run deploy '')"
expect 'invoke mode only invokes' 'rc=0 invoke --stage test-4 --function try-canary NODE_OPTIONS= LEGACY=|' "$(run invoke '')"
expect 'invalid env line fails before deploying' 'rc=1 ' "$(run both 'NODE_OPTIONS')"

[ "$FAILURES" -eq 0 ] || { echo "$FAILURES test(s) failed"; exit 1; }
echo 'all tests passed'
