#!/bin/bash
# Grant Fusion Backup & Restore permission to read Db2u APIs during restore.
#
# Why this exists:
#   Restore checks query db2uengines / db2uinstances. The annotation hook that
#   marks an instance restored also needs patch. The ClusterRole
#   transaction-manager-ibm-backup-restore that ships with Fusion does not
#   always include those verbs. Without this patch, restore fails with
#   permission errors — especially on a spoke / target cluster.
#
#   IBM's sample restore-pre-req.sh does the same for
#   db2uengines, db2uinstances, and db2uclusters. This copy omits
#   db2uclusters — this pack targets Db2uInstance only.
#
# When to run:
#   - On the restore target cluster (spoke), before the first Db2u restore
#   - Also on the hub if hub == restore target
#
# Usage:
#   ./restore-pre-req.sh

set -euo pipefail

oc get clusterrole transaction-manager-ibm-backup-restore -o json \
  | jq '.rules += [{
      "verbs": ["get", "list", "patch"],
      "apiGroups": ["db2u.databases.ibm.com"],
      "resources": ["db2uengines", "db2uinstances"]
    }]' \
  | oc apply -f -

echo "Updated ClusterRole transaction-manager-ibm-backup-restore for Db2u APIs"
