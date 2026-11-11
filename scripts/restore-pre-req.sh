#!/bin/bash
# Grant Fusion Backup & Restore the permissions the recipe hooks need.
#
# Why this exists:
#   The recipes patch Db2u objects through annotation hooks, which run as
#   Fusion's transaction-manager service account:
#     - maintenance-pause-reconcile on db2uinstances / db2uengines (backup
#       and restore)
#     - db2u.fusion/restored on the restored db2uinstance
#     - openshift.io/display-name on the target namespace
#   The check hooks also read db2uinstances / db2uengines. Fusion's shipped
#   ClusterRole does not always include those verbs; without them the hooks
#   fail with Forbidden.
#
#   This applies rbac/transaction-manager-db2u.yaml: a dedicated ClusterRole
#   and binding. Earlier versions patched transaction-manager-ibm-backup-restore
#   in place with jq; a dedicated role is idempotent and survives Fusion
#   reconciling its own role. IBM's sample also covers db2uclusters; this pack
#   targets Db2uInstance only.
#
# When to run:
#   - On every cluster that backs up (the maintenance hooks need patch)
#   - On every cluster that restores (spoke and hub, if they differ)
#
# The name is kept for compatibility with existing runbooks; it is no longer
# restore-only.
#
# Usage:
#   ./restore-pre-req.sh

set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)

oc apply -f "${root}/rbac/transaction-manager-db2u.yaml"

sa=system:serviceaccount:ibm-backup-restore:transaction-manager
for check in "patch db2uinstances.db2u.databases.ibm.com" \
             "patch db2uengines.db2u.databases.ibm.com" \
             "patch namespaces"; do
  # shellcheck disable=SC2086
  oc auth can-i ${check} --all-namespaces --as="${sa}" >/dev/null \
    || { echo "transaction-manager still cannot: ${check}" >&2; exit 1; }
done

echo "transaction-manager can patch Db2u instances, engines, and namespaces"
