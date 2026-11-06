#!/usr/bin/env bash
# Decides whether a deploy must run DB migrations; writes required=true|false to $GITHUB_OUTPUT.
#   STAGE matches CONDITIONAL_STAGES_PATTERN (default: test-N) → migrate only when DEPLOY_SHA
#     changes MIGRATIONS_PATH relative to BASE_REF.
#   any other stage → always migrate.
# Anything that cannot prove "no migration changes" migrates: compare API failure, a missing file
# list, or a list at the compare API's 300-file cap (first page only, cannot be paginated).
# A rename counts when either its new or its previous path is under MIGRATIONS_PATH. A commit that is
# identical to or behind BASE_REF always migrates.
# Env: GITHUB_REPOSITORY, GITHUB_OUTPUT, GH_TOKEN, STAGE, DEPLOY_SHA, BASE_REF, MIGRATIONS_PATH,
#      CONDITIONAL_STAGES_PATTERN, RETRY_SLEEP_SECONDS (tests).
set -uo pipefail

required() {
  echo "required=$1" >> "$GITHUB_OUTPUT"
  echo "$2"
  exit 0
}

[[ "$STAGE" =~ $CONDITIONAL_STAGES_PATTERN ]] || required true "${STAGE} always runs migrations."

PREFIX=${MIGRATIONS_PATH%/}/
RESULT=''
for attempt in 1 2 3; do
  RESULT=$(gh api "/repos/${GITHUB_REPOSITORY}/compare/${BASE_REF}...${DEPLOY_SHA}?per_page=1" \
    --jq "if .files == null then \"unknown\" else \"\(.status) \(.files | length) \(any(.files[]; [.filename, (.previous_filename // \"\")] | any(startswith(\"${PREFIX}\"))))\" end") && break
  RESULT=''
  echo "Compare attempt ${attempt}/3 failed; retrying..."
  sleep $((attempt * ${RETRY_SLEEP_SECONDS:-3}))
done

[ -n "$RESULT" ] || required true "::warning::Could not compare ${DEPLOY_SHA} with ${BASE_REF}; running migrations to be safe."
[ "$RESULT" != unknown ] || required true "::warning::Compare of ${DEPLOY_SHA} with ${BASE_REF} returned no file list; running migrations to be safe."
read -r STATUS FILE_COUNT HAS_MIGRATIONS <<< "$RESULT"
# identical/behind = the deploy is base-ref's own code (e.g. weekly scheduled deploys of main to
# test-N): the env may lack migrations merged since it last migrated, and the diff can't show it.
case "$STATUS" in identical | behind) required true "${DEPLOY_SHA} is ${STATUS} with ${BASE_REF}; running ${BASE_REF}'s migrations." ;; esac
[ "$HAS_MIGRATIONS" != true ] || required true "${DEPLOY_SHA} changes ${PREFIX} relative to ${BASE_REF}; running migrations."
[ "$FILE_COUNT" -lt 300 ] || required true "::warning::${DEPLOY_SHA} changes ${FILE_COUNT}+ files relative to ${BASE_REF} (compare API cap); running migrations to be safe."
required false "${DEPLOY_SHA} has no ${PREFIX} changes relative to ${BASE_REF}; skipping migrations."
