#!/bin/bash
# Verify the dw-validation example before backup and after backup/restore.
#
# Usage (from the repository root):
#   ./scripts/test-bnr.sh before          # required config is ready; safe to back up
#   ./scripts/test-bnr.sh after-backup    # newest Backup succeeded; source unlocked
#   ./scripts/test-bnr.sh after-restore   # QA target looks restored; source still Ready
#
# Aliases: preflight=before, backup=after-backup, restore=after-restore

set -euo pipefail

fusion_ns=ibm-spectrum-fusion-ns
src_ns=dw-validation
tgt_ns=dw-validation-qa
instance=dwdb
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
  phase=$(oc get "${kind}" "${name}" -n "${fusion_ns}" -o jsonpath='{.status.phase}' 2>/dev/null || true)
  if [ -z "${phase}" ]; then
    phase=$(oc get "${kind}" "${name}" -n "${fusion_ns}" -o jsonpath='{.status.status}' 2>/dev/null || true)
  fi
  printf '%s' "${phase}"
}

case "${mode}" in
  before|preflight)
    echo "=== before backup: required configure/ objects ==="
    oc get project "${src_ns}" "${tgt_ns}" >/dev/null || fail "${src_ns} or ${tgt_ns} project is missing"
    # The recipes never run in the operator namespace, but the operator must be
    # up to act on the maintenance annotations.
    oc get pods -A -l control-plane=db2u-operator-manager --no-headers | grep -q Running \
      || fail "no Running db2u-operator-manager pod found"

    sa=system:serviceaccount:ibm-backup-restore:transaction-manager
    oc auth can-i patch db2uinstances.db2u.databases.ibm.com -n "${src_ns}" --as="${sa}" >/dev/null \
      || fail "transaction-manager cannot patch db2uinstances; run scripts/restore-pre-req.sh"
    oc auth can-i patch db2uengines.db2u.databases.ibm.com -n "${src_ns}" --as="${sa}" >/dev/null \
      || fail "transaction-manager cannot patch db2uengines; run scripts/restore-pre-req.sh"

    need secret dw-validation-backup-secret "${fusion_ns}"
    need backupstoragelocation dw-validation-backup-storage-location "${fusion_ns}"
    need backuppolicy dw-validation-backup-policy "${fusion_ns}"
    need application dw-validation "${fusion_ns}"
    need policyassignment dw-validation-policy-assignment "${fusion_ns}"
    need recipe db2u-parent-recipe "${fusion_ns}"
    need recipe db2u-instance-child-recipe "${fusion_ns}"
    need transform dw-validation-to-qa "${fusion_ns}"

    access_key=$(oc get secret dw-validation-backup-secret -n "${fusion_ns}" -o jsonpath='{.data.access-key-id}' | base64 -d)
    secret_key=$(oc get secret dw-validation-backup-secret -n "${fusion_ns}" -o jsonpath='{.data.secret-access-key}' | base64 -d)
    case "${access_key}${secret_key}" in
      *REPLACE_WITH_*) fail "backup secret still contains REPLACE_WITH_" ;;
    esac
    lic=$(oc get db2uinstance "${instance}" -n "${src_ns}" -o jsonpath='{.spec.license.value}')
    case "${lic}" in
      ""|REPLACE_WITH_DB2_LICENSE) fail "Db2uInstance license is empty or still the placeholder" ;;
    esac

    oc get application dw-validation -n "${fusion_ns}" -o jsonpath='{.spec.includedNamespaces}' \
      | grep -q 'db2-operator' && fail "application includes db2-operator"
    oc get application dw-validation -n "${fusion_ns}" -o jsonpath='{.spec.includedNamespaces}' \
      | grep -q "${src_ns}" || fail "application does not include ${src_ns}"

    recipe=$(oc get policyassignment dw-validation-policy-assignment -n "${fusion_ns}" -o jsonpath='{.spec.recipe.name}')
    [ "${recipe}" = "db2u-parent-recipe" ] || fail "policy assignment recipe is '${recipe}'"
    run_now=$(oc get policyassignment dw-validation-policy-assignment -n "${fusion_ns}" -o jsonpath='{.spec.runNow}')
    [ "${run_now}" = "false" ] || fail "runNow is '${run_now}', expected false until you choose to back up"

    oc get recipe db2u-instance-child-recipe -n "${fusion_ns}" \
      -o jsonpath='{.metadata.labels.dp\.isf\.ibm\.com/parent-recipe}' \
      | grep -qx 'db2u-parent-recipe' || fail "child recipe is not labeled for the parent"

    oc get db2uinstance "${instance}" -n "${src_ns}" -o jsonpath='{.metadata.labels.for-backup}' \
      | grep -qx 'true' || fail "${instance} is missing for-backup=true"
    state=$(oc get db2uinstance "${instance}" -n "${src_ns}" -o jsonpath='{.status.state}')
    [ "${state}" = "Ready" ] || fail "${instance} state is '${state}', expected Ready"
    oc get pods -n "${src_ns}" -l name=dashmpp-head-0 --no-headers | grep -q Running \
      || fail "dashmpp-head-0 is not Running in ${src_ns}"

    loc=$(phase_of backupstoragelocation dw-validation-backup-storage-location)
    echo "BackupStorageLocation phase: ${loc:-<empty>}"
    case "${loc}" in
      Connected|Available|Ready) ;;
      "") fail "storage location has no phase yet; wait, then re-run before" ;;
      *) fail "storage location phase is '${loc}'" ;;
    esac
    echo "PASS before — safe to start a backup (see examples/operate/README.md)"
    ;;

  after-backup|backup)
    echo "=== after backup ==="
    name=$(oc get backup -n "${fusion_ns}" --sort-by=.metadata.creationTimestamp \
      -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' | awk 'NF { last=$0 } END { print last }')
    [ -n "${name}" ] || fail "no Backup objects in ${fusion_ns}"
    phase=$(phase_of backup "${name}")
    echo "${name} phase: ${phase:-<empty>}"
    case "${phase}" in
      Completed|Succeeded|Success|Available) ;;
      "") fail "backup ${name} has no phase yet" ;;
      *) fail "backup ${name} phase is '${phase}'" ;;
    esac
    pause=$(oc get db2uinstance "${instance}" -n "${src_ns}" -o jsonpath='{.metadata.annotations.db2u\.databases\.ibm\.com/maintenance-pause-reconcile}')
    [ -z "${pause}" ] || fail "maintenance-pause-reconcile is still '${pause}' on source"
    echo "PASS after-backup ${name}"
    echo "Put this name in examples/operate/restore-to-qa.yaml as spec.backup"
    ;;

  after-restore|restore)
    echo "=== after restore ==="
    display=$(oc get ns "${tgt_ns}" -o jsonpath='{.metadata.annotations.openshift\.io/display-name}')
    # Comes from configure/01-namespace-target.yaml, created before restore.
    # The source name here means restore overwrote the Project metadata;
    # reapply the target manifest (or let GitOps reassert it).
    [ "${display}" = "Db2 Warehouse (QA)" ] || fail "display name is '${display}', expected Db2 Warehouse (QA)"
    restored=$(oc get db2uinstance "${instance}" -n "${tgt_ns}" -o jsonpath='{.metadata.annotations.db2u\.fusion/restored}')
    [ "${restored}" = "true" ] || fail "db2u.fusion/restored is '${restored}'"
    state=$(oc get db2uinstance "${instance}" -n "${tgt_ns}" -o jsonpath='{.status.state}')
    [ "${state}" = "Ready" ] || fail "restored instance state is '${state}'"
    src=$(oc get db2uinstance "${instance}" -n "${src_ns}" -o jsonpath='{.status.state}')
    [ "${src}" = "Ready" ] || fail "source instance state is '${src}'"
    echo "PASS after-restore. Confirm the enterprise license on ${tgt_ns}/${instance} yourself."
    ;;

  *)
    echo "Usage: $0 before|after-backup|after-restore" >&2
    echo "  before         required configure/ is ready (alias: preflight)" >&2
    echo "  after-backup   newest Backup succeeded (alias: backup)" >&2
    echo "  after-restore  QA target restored (alias: restore)" >&2
    exit 1
    ;;
esac
