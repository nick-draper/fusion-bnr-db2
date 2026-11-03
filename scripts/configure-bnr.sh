#!/bin/bash
# Create the Fusion Backup & Restore objects for one Db2uInstance.
#
# Edit placeholders in examples/ before you run this:
#   backup-secret.example.yaml
#   backup-storage-location.example.yaml
#   db2uinstance.example.yaml
#
# Usage (from the repository root):
#   ./scripts/configure-bnr.sh

set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
cd "${root}"

ns=ibm-spectrum-fusion-ns

echo "Checking placeholders"
if grep -n "REPLACE_WITH_" \
  examples/backup-secret.example.yaml \
  examples/backup-storage-location.example.yaml \
  examples/db2uinstance.example.yaml
then
  echo "Replace every REPLACE_WITH_ value, then run this script again."
  exit 1
fi

echo "Projects"
oc apply -f examples/namespace-db2u-prod.yaml
oc apply -f examples/namespace-db2u-qa.yaml

echo "Db2uInstance (license must already be your enterprise license)"
oc apply -f examples/db2uinstance.example.yaml

echo "Backup location, policy, recipes, application, assignment"
oc apply -f examples/backup-secret.example.yaml
oc apply -f examples/backup-storage-location.example.yaml
oc apply -f examples/backup-policy.example.yaml
oc apply -f recipe/db2u-parent-recipe.yaml
oc apply -f recipe/db2u-instance-child-recipe.yaml
oc apply -f examples/application.example.yaml
oc apply -f examples/policy-assignment.example.yaml
oc apply -f examples/db2u-transform-prod-to-qa.example.yaml

echo "ClusterRole and for-backup label"
"${root}/scripts/restore-pre-req.sh"
"${root}/scripts/backup-pre-req.sh" db2u-prod

echo "Configured. Next:"
echo "  ./scripts/test-bnr.sh preflight"
echo "  oc get policyassignment db2u-prod-policy-assignment -n ${ns}"
echo "Start the first backup only after preflight passes."
