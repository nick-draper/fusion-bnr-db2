#!/bin/bash
# Refuse to commit a real license, object-storage key or rendered manifest.
#
# Why this exists:
#   The manifests are templates. Your values live in .env, and
#   scripts/render.sh writes filled copies to build/. Both are git-ignored,
#   but `git add -f`, or filling a template in place, would still put a
#   license or key in the repository. This checks the staged (index) copies:
#   the templates must still hold their placeholders, and nothing from .env or
#   build/ may be staged.
#
# Runs as the pre-commit hook (.githooks/pre-commit). Enable it once per clone:
#   git config core.hooksPath .githooks
#
# Usage (from the repository root):
#   ./scripts/check-placeholders.sh            # check the staged copies
#   ./scripts/check-placeholders.sh --worktree # check the files on disk

set -euo pipefail

root=$(git rev-parse --show-toplevel)
cd "${root}"

mode=${1:-index}

# file|placeholder, one per line
checks='db2u-instance/db2u-instance.yaml|${DB2_LICENSE}
ibm-backup-restore/backend-storage-location/secret.yaml|${S3_ACCESS_KEY_ID}
ibm-backup-restore/backend-storage-location/secret.yaml|${S3_ACCESS_KEY}'

failed=0
while IFS='|' read -r file placeholder; do
  if [ "${mode}" = "--worktree" ]; then
    [ -f "${file}" ] || continue
    content=$(cat "${file}")
  else
    # Skip templates that are not in the index (nothing to commit).
    git cat-file -e ":${file}" 2>/dev/null || continue
    content=$(git show ":${file}")
  fi
  if ! grep -qF -- "${placeholder}" <<<"${content}"; then
    echo "BLOCKED: ${file} no longer contains ${placeholder}" >&2
    failed=1
  fi
done <<<"${checks}"

if [ "${mode}" != "--worktree" ]; then
  staged=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '^(\.env$|build/)' || true)
  if [ -n "${staged}" ]; then
    echo "BLOCKED: these hold your own values and must not be committed:" >&2
    echo "${staged}" | sed 's/^/  /' >&2
    failed=1
  fi
fi

if [ "${failed}" -ne 0 ]; then
  echo >&2
  echo "Keep your values in .env and render them with ./scripts/render.sh." >&2
  echo "To unstage a file and keep it on disk:  git restore --staged <file>" >&2
  exit 1
fi
