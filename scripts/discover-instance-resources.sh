#!/bin/bash
# Inventory an instance namespace before you publish or change include-lists.
#
# Why this exists:
#   This pack backs up an allow-list (includedResourceTypes), not a denylist.
#   That is safer, but only if you have checked the namespace for resource
#   types the recipe does not yet include. Run this against a real instance
#   namespace and compare the output to the child recipe groups.
#
# Requires the kubectl/oc get-resources plugin:
#   https://github.com/Sandeep-Prajapati/kubectl-get-resources
# Background:
#   https://community.ibm.com/community/user/blogs/sandeep-prajapati/2026/01/11/making-kubernetes-or-openshift-backup-and-restore
#
# Usage (from the repository root):
#   ./scripts/discover-instance-resources.sh <DB2U_INSTANCE_NAMESPACE>

set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Inventory namespace-scoped resources for recipe include-list review."
  echo "Usage: $0 <DB2U_INSTANCE_NAMESPACE>"
  exit 1
fi

NS=$1

if ! oc get-resources --help >/dev/null 2>&1; then
  echo "oc get-resources is not installed."
  echo "Install: https://github.com/Sandeep-Prajapati/kubectl-get-resources"
  exit 1
fi

echo "Namespace-scoped resources in ${NS} (cluster-scoped excluded):"
oc get-resources --namespace "${NS}" --exclude-cluster-resources=true

echo
echo "Compare kinds above with includedResourceTypes in ibm-backup-restore/recipe/child-recipe.yaml"
echo "Current allow-list: persistent volumes (volume group), configmaps, secrets, db2uinstances.db2u.databases.ibm.com"
