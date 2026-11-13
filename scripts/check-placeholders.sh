#!/bin/bash
# Refuse to commit a filled-in license or object-storage key.
#
# Why this exists:
#   db2u-instance.yaml and secret.yaml are templates. You fill them in
#   place before running oc apply, so a real license or access key
#   is one `git add -A` away from the repository. This checks the staged
#   (index) copy of each template still holds its <...> placeholders.
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
checks='db2u-instance/db2u-instance.yaml|<Insert License>
ibm-backup-restore/backend-storage-location/secret.yaml|<access-key-id>
ibm-backup-restore/backend-storage-location/secret.yaml|<secret-access-key>'

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

if [ "${failed}" -ne 0 ]; then
  echo >&2
  echo "These files are templates. Put the placeholders back before committing:" >&2
  echo "  git restore --staged <file>     # unstage, keep your filled copy on disk" >&2
  echo "Your filled copy stays usable for oc apply; just don't commit it." >&2
  exit 1
fi
