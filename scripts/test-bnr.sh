#!/bin/bash
# Validate Fusion Backup & Restore setup, then a backup, then a cross-namespace restore.
#
# Usage (from the repository root):
#   ./scripts/test-bnr.sh preflight
#   ./scripts/test-bnr.sh backup
#   ./scripts/test-bnr.sh restore
#
# preflight  objects exist, placeholders are gone, instance is Ready
# backup     newest Backup succeeded and maintenance was cleared
# restore    db2u-qa has the display name, restored annotation, and a Ready instance

set -euo pipefail

ns=ibm-spectrum-fusion-ns
mode=${1:-}

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

need() {
  oc get "$1" "$2" -n "$3" >/dev/null 2>&1 || fail "missing $1/$2 in $3"
}

phase_of() {
  local kind=$1 name=$2
  local phase
  phase=$(oc get "${kind}" "${name}" -n "${ns}" -o jsonpath='{.status.phase}' 2>/dev/null || true)
  if [ -z "${phase}" ]; then
    phase=$(oc get "${kind}" "${name}" -n "${ns}" -o jsonpath='{.status.status}' 2>/dev/null || true)
  fi
  printf '%s' "${phase}"
}

case "${mode}" in
  preflight)
    echo "Projects and operator"
    oc get project db2u-prod db2u-qa >/dev/null || fail "db2u-prod or db2u-qa project is missing"
    oc get pods -n db2-operator -l control-plane=db2u-operator-manager --no-headers | grep -q Running \
      || fail "db2u-operator-manager is not Running in db2-operator"

    echo "Fusion objects"
    need secret db2u-backup-secret "${ns}"
    need backupstoragelocation db2u-prod-backup-storage-location "${ns}"
    need backuppolicy db2u-prod-backup-policy "${ns}"
    need application db2u-prod "${ns}"
    need policyassignment db2u-prod-policy-assignment "${ns}"
    need recipe db2u-parent-recipe "${ns}"
    need recipe db2u-instance-child-recipe "${ns}"

    echo "No placeholders left in the live secret or license"
    access_key=$(oc get secret db2u-backup-secret -n "${ns}" -o jsonpath='{.data.access-key-id}' | base64 -d)
    secret_key=$(oc get secret db2u-backup-secret -n "${ns}" -o jsonpath='{.data.secret-access-key}' | base64 -d)
    case "${access_key}${secret_key}" in
      *REPLACE_WITH_*) fail "backup secret still contains REPLACE_WITH_" ;;
    esac
    lic=$(oc get db2uinstance my-db2 -n db2u-prod -o jsonpath='{.spec.license.value}')
    case "${lic}" in
      ""|REPLACE_WITH_DB2_LICENSE) fail "Db2uInstance license is empty or still the placeholder" ;;
    esac

    echo "Application does not include the operator namespace"
    oc get application db2u-prod -n "${ns}" -o jsonpath='{.spec.includedNamespaces}' \
      | grep -q 'db2-operator' && fail "application includes db2-operator"
    oc get application db2u-prod -n "${ns}" -o jsonpath='{.spec.includedNamespaces}' \
      | grep -q 'db2u-prod' || fail "application does not include db2u-prod"

    echo "Assignment names the parent recipe and is not runNow"
    recipe=$(oc get policyassignment db2u-prod-policy-assignment -n "${ns}" -o jsonpath='{.spec.recipe.name}')
    [ "${recipe}" = "db2u-parent-recipe" ] || fail "policy assignment recipe is '${recipe}'"
    run_now=$(oc get policyassignment db2u-prod-policy-assignment -n "${ns}" -o jsonpath='{.spec.runNow}')
    [ "${run_now}" = "false" ] || fail "runNow is '${run_now}', expected false until you choose to back up"

    echo "Child recipe is linked to the parent"
    oc get recipe db2u-instance-child-recipe -n "${ns}" \
      -o jsonpath='{.metadata.labels.dp\.isf\.ibm\.com/parent-recipe}' \
      | grep -qx 'db2u-parent-recipe' || fail "child recipe is not labeled for the parent"

    echo "Instance is labeled and Ready"
    oc get db2uinstance my-db2 -n db2u-prod -o jsonpath='{.metadata.labels.for-backup}' \
      | grep -qx 'true' || fail "my-db2 is missing for-backup=true"
    state=$(oc get db2uinstance my-db2 -n db2u-prod -o jsonpath='{.status.state}')
    [ "${state}" = "Ready" ] || fail "my-db2 state is '${state}', expected Ready"
    oc get pods -n db2u-prod -l name=dashmpp-head-0 --no-headers | grep -q Running \
      || fail "dashmpp-head-0 is not Running"

    loc=$(phase_of backupstoragelocation db2u-prod-backup-storage-location)
    echo "BackupStorageLocation phase: ${loc:-<empty>}"
    case "${loc}" in
      Connected|Available|Ready) ;;
      "") fail "storage location has no phase yet; wait until Fusion connects, then re-run preflight" ;;
      *) fail "storage location phase is '${loc}'" ;;
    esac
    echo "PASS preflight"
    ;;

  backup)
    echo "Newest backup in ${ns}"
    name=$(oc get backup -n "${ns}" --sort-by=.metadata.creationTimestamp \
      -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' | awk 'NF { last=$0 } END { print last }')
    [ -n "${name}" ] || fail "no Backup objects in ${ns}"
    phase=$(phase_of backup "${name}")
    echo "${name} phase: ${phase:-<empty>}"
    case "${phase}" in
      Completed|Succeeded|Success|Available) ;;
      "") fail "backup ${name} has no phase yet" ;;
      *) fail "backup ${name} phase is '${phase}'" ;;
    esac
    pause=$(oc get db2uinstance my-db2 -n db2u-prod -o jsonpath='{.metadata.annotations.db2u\.databases\.ibm\.com/maintenance-pause-reconcile}')
    [ -z "${pause}" ] || fail "maintenance-pause-reconcile is still '${pause}'"
    echo "PASS backup ${name}"
    echo "Use this name in examples/db2u-restore-cross-namespace.example.yaml"
    ;;

  restore)
    echo "Target project display name"
    display=$(oc get ns db2u-qa -o jsonpath='{.metadata.annotations.openshift\.io/display-name}')
    [ "${display}" = "Db2 Warehouse (QA)" ] || fail "display name is '${display}'"
    restored=$(oc get db2uinstance my-db2 -n db2u-qa -o jsonpath='{.metadata.annotations.db2u\.fusion/restored}')
    [ "${restored}" = "true" ] || fail "db2u.fusion/restored is '${restored}'"
    state=$(oc get db2uinstance my-db2 -n db2u-qa -o jsonpath='{.status.state}')
    [ "${state}" = "Ready" ] || fail "restored instance state is '${state}'"
    src=$(oc get db2uinstance my-db2 -n db2u-prod -o jsonpath='{.status.state}')
    [ "${src}" = "Ready" ] || fail "source instance state is '${src}'"
    echo "PASS restore. Confirm the enterprise license in the target instance before you call this done."
    ;;

  *)
    echo "Usage: $0 preflight|backup|restore" >&2
    exit 1
    ;;
esac
