#!/bin/bash
# Deploy the db2u-bnr-recipe-helper and check its permissions.
#
# Why this exists:
#   The parent recipe's helper-exec hooks run curl in the helper pod, with
#   the helper's service account token, to:
#     - patch maintenance-pause-reconcile on db2uinstances / db2uengines
#       (backup and restore)
#     - patch openshift.io/display-name on the restore target namespace
#   Without the ClusterRole and binding those calls fail with Forbidden.
#   Fusion annotation hooks are not used: during restore the GROUP variable
#   did not resolve in the dynamic recipe.
#
# When to run:
#   - On every cluster that backs up and every cluster that restores
#
# Usage (from backup-restore/recipes/Db2/db2u-instance-helper/):
#   ./scripts/configure-recipe-helper.sh

set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
helper=db2u-bnr-recipe-helper
dir="${root}/${helper}"

oc apply -f "${dir}/project.yaml"
oc apply -f "${dir}/service-account.yaml"
oc apply -f "${dir}/cluster-role.yaml"
oc apply -f "${dir}/cluster-role-binding.yaml"
oc apply -f "${dir}/deployment.yaml"
oc rollout status "deployment/${helper}" -n "${helper}" --timeout=180s

sa=system:serviceaccount:${helper}:${helper}
for check in "list db2uinstances.db2u.databases.ibm.com" \
             "patch db2uinstances.db2u.databases.ibm.com" \
             "list db2uengines.db2u.databases.ibm.com" \
             "patch db2uengines.db2u.databases.ibm.com" \
             "patch namespaces"; do
  # shellcheck disable=SC2086
  oc auth can-i ${check} --all-namespaces --as="${sa}" >/dev/null \
    || { echo "${helper} still cannot: ${check}" >&2; exit 1; }
done

echo "${helper} is Running and can patch Db2u instances, engines, and namespaces"
