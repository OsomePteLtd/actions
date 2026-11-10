#!/usr/bin/env bash
# Decides whether a deploy must run DB migrations; writes required=true|false to $GITHUB_OUTPUT.
#   DBM_STAGE matches DBM_CONDITIONAL_STAGES_PATTERN (default: test-N) → migrate only when
#     DBM_DEPLOY_SHA changes DBM_MIGRATIONS_PATH relative to DBM_BASE_REF.
#   any other stage → always migrate.
# Anything that cannot prove "no migration changes" migrates: compare API failure, a missing file
# list, or a list at the compare API's 300-file cap (first page only, cannot be paginated).
# A rename counts when either its new or its previous path is under DBM_MIGRATIONS_PATH. A commit that is
# identical to or behind DBM_BASE_REF always migrates.
# Env: GITHUB_REPOSITORY, GITHUB_OUTPUT, GH_TOKEN, DBM_STAGE, DBM_DEPLOY_SHA, DBM_BASE_REF,
#      DBM_MIGRATIONS_PATH, DBM_CONDITIONAL_STAGES_PATTERN, DBM_RETRY_SLEEP_SECONDS (tests).
set -uo pipefail

required() {
  echo "required=$1" >> "$GITHUB_OUTPUT"
  echo "$2"
  exit 0
}

[[ "$DBM_STAGE" =~ $DBM_CONDITIONAL_STAGES_PATTERN ]] || required true "${DBM_STAGE} always runs migrations."

DBM_PREFIX=${DBM_MIGRATIONS_PATH%/}/
DBM_RESULT=''
for attempt in 1 2 3; do
  DBM_RESULT=$(gh api "/repos/${GITHUB_REPOSITORY}/compare/${DBM_BASE_REF}...${DBM_DEPLOY_SHA}?per_page=1" \
    --jq "if .files == null then \"unknown\" else \"\(.status) \(.files | length) \(any(.files[]; [.filename, (.previous_filename // \"\")] | any(startswith(\"${DBM_PREFIX}\"))))\" end") && break
  DBM_RESULT=''
  echo "Compare attempt ${attempt}/3 failed; retrying..."
  sleep $((attempt * ${DBM_RETRY_SLEEP_SECONDS:-3}))
done

[ -n "$DBM_RESULT" ] || required true "::warning::Could not compare ${DBM_DEPLOY_SHA} with ${DBM_BASE_REF}; running migrations to be safe."
[ "$DBM_RESULT" != unknown ] || required true "::warning::Compare of ${DBM_DEPLOY_SHA} with ${DBM_BASE_REF} returned no file list; running migrations to be safe."
read -r DBM_STATUS DBM_FILE_COUNT DBM_HAS_MIGRATIONS <<< "$DBM_RESULT"
# identical/behind = the deploy is base-ref's own code (e.g. weekly scheduled deploys of main to
# test-N): the env may lack migrations merged since it last migrated, and the diff can't show it.
case "$DBM_STATUS" in identical | behind) required true "${DBM_DEPLOY_SHA} is ${DBM_STATUS} with ${DBM_BASE_REF}; running ${DBM_BASE_REF}'s migrations." ;; esac
[ "$DBM_HAS_MIGRATIONS" != true ] || required true "${DBM_DEPLOY_SHA} changes ${DBM_PREFIX} relative to ${DBM_BASE_REF}; running migrations."
[ "$DBM_FILE_COUNT" -lt 300 ] || required true "::warning::${DBM_DEPLOY_SHA} changes ${DBM_FILE_COUNT}+ files relative to ${DBM_BASE_REF} (compare API cap); running migrations to be safe."
required false "${DBM_DEPLOY_SHA} has no ${DBM_PREFIX} changes relative to ${DBM_BASE_REF}; skipping migrations."
