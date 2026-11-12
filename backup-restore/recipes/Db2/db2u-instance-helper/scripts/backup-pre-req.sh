#!/bin/bash
# Label Db2uInstance CRs so recipe readiness checks can select them.
#
# Why this exists:
#   The child recipe's db2uinstance-check hook uses
#     labelSelector: for-backup=true
#   Without this label, restore readiness checks never match and the
#   workflow hangs or fails after manage_snapshots restore.
#
#   IBM's sample ships the same idea (backup-pre-req.sh). This copy is
#   scoped to Db2uInstance only — we do not label Db2uCluster.
#
# Usage:
#   ./backup-pre-req.sh <DB2U_INSTANCE_NAMESPACE>
#
# examples/db2u-instance/db2u-instance.yaml already sets the label. Run this
# for instances created without it, before their first backup.

set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Label Db2uInstance CRs with for-backup=true for Fusion recipe checks."
  echo "Usage: $0 <DB2U_INSTANCE_NAMESPACE>"
  exit 1
fi

DB2U_NAMESPACE=$1

if ! oc get db2uinstances.db2u.databases.ibm.com -n "${DB2U_NAMESPACE}" -o name 2>/dev/null | grep -q .; then
  echo "No Db2uInstance found in namespace ${DB2U_NAMESPACE}"
  exit 1
fi

oc label \
  $(oc get db2uinstances.db2u.databases.ibm.com -o name -n "${DB2U_NAMESPACE}") \
  -n "${DB2U_NAMESPACE}" \
  for-backup=true \
  --overwrite

echo "Labeled Db2uInstance(s) in ${DB2U_NAMESPACE} with for-backup=true"
