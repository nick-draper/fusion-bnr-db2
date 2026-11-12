#!/bin/bash
# Apply steps 2-4 of docs/end-to-end.md from resources/.
#
# Do these first (the script checks them, it does not do them):
#   - Step 1: bucket, policy, user and access key (docs/object-storage-setup.md)
#   - Fill placeholders:
#       resources/db2u-instance/db2u-instance.yaml            <Insert License>, <storage-class>
#       resources/ibm-backup-restore/backup-storage-location/secret.yaml
#                                                             <access-key-id>, <secret-access-key>
#   - Edit the existing OperatorGroup and namespace-scope ConfigMap in
#     db2-operator so they list the instance and every restore target
#   - Create the object storage CA secret minio-registry-cert-secret in
#     ibm-spectrum-fusion-ns
#   - Install db2u-velero-plugin on the Fusion DPA
#
# Usage (from the repository root):
#   ./scripts/configure-bnr.sh

set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
cd "${root}"

fusion_ns=ibm-spectrum-fusion-ns
op_ns=db2-operator
src_ns=db2u-instance
tgt_ns=db2u-instance-dev
r=resources
bnr=${r}/ibm-backup-restore

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

echo "Checking placeholders"
if grep -nE '<(Insert License|storage-class|access-key-id|secret-access-key)>' \
  "${r}/db2u-instance/db2u-instance.yaml" \
  "${bnr}/backup-storage-location/secret.yaml"
then
  fail "replace every <...> placeholder above, then run again"
fi

echo "Checking manual prerequisites"
oc get secret minio-registry-cert-secret -n "${fusion_ns}" >/dev/null 2>&1 \
  || fail "secret minio-registry-cert-secret is missing in ${fusion_ns}"
og=$(oc get operatorgroup -n "${op_ns}" -o jsonpath='{.items[*].spec.targetNamespaces}')
scope=$(oc get configmap namespace-scope -n "${op_ns}" -o jsonpath='{.data.namespaces}' 2>/dev/null || true)
for ns in "${src_ns}" "${tgt_ns}"; do
  grep -q "\"${ns}\"" <<<"${og}" || fail "OperatorGroup in ${op_ns} does not target ${ns}"
  grep -qE "(^|,)${ns}(,|$)" <<<"${scope}" || fail "namespace-scope ConfigMap in ${op_ns} does not list ${ns}"
done
oc get dpa velero -n ibm-backup-restore -o jsonpath='{.spec.configuration.velero.customPlugins}' \
  | grep -q db2u || echo "WARN: db2u-velero-plugin not found on the Fusion DPA (see ${bnr}/config/)"

echo "2/4 Projects and Db2uInstance"
oc apply -f "${r}/db2u-instance/db2u-instance-project.yaml"
oc apply -f "${r}/db2u-instance/db2u-instance-dev-project.yaml"
oc apply -f "${r}/db2u-instance/db2u-instance.yaml"

echo "3/4 Fusion BNR storage, policy, recipes, transform, assignment"
oc apply -f "${bnr}/backup-storage-location/secret.yaml"
oc apply -f "${bnr}/backup-storage-location/backup-storage-location.yaml"
oc apply -f "${bnr}/backup-storage-location/backup-policy.yaml"
oc apply -f "${bnr}/recipe/db2u-instance-helper-parent-recipe.yaml"
oc apply -f "${bnr}/recipe/db2u-instance-helper-child-recipe.yaml"
oc apply -f "${bnr}/recipe/transform.yaml"
oc apply -f "${bnr}/recipe/policy-assignment.yaml"

echo "4/4 Recipe helper"
"${root}/scripts/configure-recipe-helper.sh"

echo "Configured ${src_ns} (restore target ${tgt_ns})."
echo "Next:"
echo "  ./scripts/test-bnr.sh before"
echo "  back up (Fusion UI or operations/backup.yaml, see docs/operations.md)"
echo "  ./scripts/test-bnr.sh after-backup"
echo "  edit + apply operations/restore.yaml"
echo "  ./scripts/test-bnr.sh after-restore"
