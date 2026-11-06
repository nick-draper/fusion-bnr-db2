#!/bin/bash
# Apply required Fusion BNR configuration for the dw-validation example.
#
# Edit placeholders in examples/configure/ before you run:
#   02-db2uinstance.yaml
#   03-backup-secret.yaml
#   04-backup-storage-location.yaml
#
# Usage (from the repository root):
#   ./scripts/configure-bnr.sh

set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
cd "${root}"

fusion_ns=ibm-spectrum-fusion-ns
src_ns=dw-validation
cfg=examples/configure

echo "Checking placeholders in configure/"
if grep -n "REPLACE_WITH_" \
  "${cfg}/02-db2uinstance.yaml" \
  "${cfg}/03-backup-secret.yaml" \
  "${cfg}/04-backup-storage-location.yaml"
then
  echo "Replace every REPLACE_WITH_ value in examples/configure/, then run again."
  exit 1
fi

echo "1/3 Projects and Db2uInstance"
oc apply -f "${cfg}/00-namespace-source.yaml"
oc apply -f "${cfg}/01-namespace-target.yaml"
oc apply -f "${cfg}/02-db2uinstance.yaml"

echo "2/3 Fusion BNR application objects + recipes"
oc apply -f "${cfg}/03-backup-secret.yaml"
oc apply -f "${cfg}/04-backup-storage-location.yaml"
oc apply -f "${cfg}/05-backup-policy.yaml"
oc apply -f recipe/db2u-parent-recipe.yaml
oc apply -f recipe/db2u-instance-child-recipe.yaml
oc apply -f "${cfg}/06-application.yaml"
oc apply -f "${cfg}/07-policy-assignment.yaml"
oc apply -f "${cfg}/08-transform.yaml"

echo "3/3 ClusterRole and for-backup label"
"${root}/scripts/restore-pre-req.sh"
"${root}/scripts/backup-pre-req.sh" "${src_ns}"

echo "Configured for ${src_ns}."
echo "Next:"
echo "  ./scripts/test-bnr.sh before"
echo "  (start a backup from the Fusion UI — see examples/operate/README.md)"
echo "  ./scripts/test-bnr.sh after-backup"
echo "  edit + apply examples/operate/restore-to-qa.yaml"
echo "  ./scripts/test-bnr.sh after-restore"
echo "PolicyAssignment: oc get policyassignment dw-validation-policy-assignment -n ${fusion_ns}"
