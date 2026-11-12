#!/bin/bash
# Verify the db2u-instance example before backup and after backup/restore.
#
# Usage (from the repository root):
#   ./scripts/test-bnr.sh before          # required config is ready; safe to back up
#   ./scripts/test-bnr.sh after-backup    # newest Backup succeeded; source unlocked
#   ./scripts/test-bnr.sh after-restore   # target looks restored; source still Ready
#
# Aliases: preflight=before, backup=after-backup, restore=after-restore
#
# Override the defaults with SRC_NS, TGT_NS and RESTORE_ENV (the ENV value in
# the Restore's transformMapping).

set -euo pipefail

fusion_ns=ibm-spectrum-fusion-ns
op_ns=db2-operator
helper=db2u-bnr-recipe-helper
src_ns=${SRC_NS:-db2u-instance}
tgt_ns=${TGT_NS:-db2u-instance-dev}
restore_env=${RESTORE_ENV:-dev}
instance=dwdb
parent=db2u-instance-helper-parent
child=db2u-instance-helper-child
assignment=db2u-instance-recipe-policy-assignment
bsl=db2u-instance-backup-storage-location
pause_path='{.metadata.annotations.db2u\.databases\.ibm\.com/maintenance-pause-reconcile}'
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

# Fail if any Db2uInstance or Db2uEngine in $1 still has maintenance-pause-reconcile.
unpaused() {
  local ns=$1 pause
  pause=$(oc get db2uinstances.db2u.databases.ibm.com,db2uengines.db2u.databases.ibm.com \
    -n "${ns}" -o jsonpath="{range .items[*]}${pause_path}{end}")
  [ -z "${pause}" ] || fail "maintenance-pause-reconcile is still set in ${ns}"
}

case "${mode}" in
  before|preflight)
    echo "=== before backup: required configuration ==="
    oc get project "${src_ns}" "${tgt_ns}" "${helper}" >/dev/null \
      || fail "${src_ns}, ${tgt_ns} or ${helper} project is missing"
    # The recipes never run in the operator namespace, but the operator must be
    # up, and must watch the target, to act on the maintenance annotations.
    oc get pods -A -l control-plane=db2u-operator-manager --no-headers | grep -q Running \
      || fail "no Running db2u-operator-manager pod found"
    og=$(oc get operatorgroup -n "${op_ns}" -o jsonpath='{.items[*].spec.targetNamespaces}')
    for ns in "${src_ns}" "${tgt_ns}"; do
      grep -q "\"${ns}\"" <<<"${og}" || fail "OperatorGroup in ${op_ns} does not target ${ns}"
    done

    oc get pods -n "${helper}" -l app="${helper}" --no-headers | grep -q Running \
      || fail "${helper} pod is not Running; run scripts/configure-recipe-helper.sh"
    sa=system:serviceaccount:${helper}:${helper}
    for check in "patch db2uinstances.db2u.databases.ibm.com" \
                 "patch db2uengines.db2u.databases.ibm.com" \
                 "patch namespaces"; do
      # shellcheck disable=SC2086
      oc auth can-i ${check} --all-namespaces --as="${sa}" >/dev/null \
        || fail "${helper} cannot ${check}; run scripts/configure-recipe-helper.sh"
    done

    need secret db2u-instance-backup-secret "${fusion_ns}"
    need secret minio-registry-cert-secret "${fusion_ns}"
    need backupstoragelocation "${bsl}" "${fusion_ns}"
    need backuppolicy db2u-instance-backup-policy "${fusion_ns}"
    need application "${src_ns}" "${fusion_ns}"
    need policyassignment "${assignment}" "${fusion_ns}"
    need recipe "${parent}" "${fusion_ns}"
    need recipe "${child}" "${fusion_ns}"
    need transform db2u-instance-restore-transform "${fusion_ns}"

    access_key=$(oc get secret db2u-instance-backup-secret -n "${fusion_ns}" -o jsonpath='{.data.access-key-id}' | base64 -d)
    secret_key=$(oc get secret db2u-instance-backup-secret -n "${fusion_ns}" -o jsonpath='{.data.secret-access-key}' | base64 -d)
    case "${access_key}${secret_key}" in
      *"<"*) fail "backup secret still contains a <...> placeholder" ;;
    esac
    lic=$(oc get db2uinstance "${instance}" -n "${src_ns}" -o jsonpath='{.spec.license.value}')
    case "${lic}" in
      ""|"<Insert License>") fail "Db2uInstance license is empty or still the placeholder" ;;
    esac

    recipe=$(oc get policyassignment "${assignment}" -n "${fusion_ns}" -o jsonpath='{.spec.recipe.name}')
    [ "${recipe}" = "${parent}" ] || fail "policy assignment recipe is '${recipe}'"
    run_now=$(oc get policyassignment "${assignment}" -n "${fusion_ns}" -o jsonpath='{.spec.runNow}')
    [ "${run_now}" = "false" ] || fail "runNow is '${run_now}', expected false until you choose to back up"

    oc get recipe "${child}" -n "${fusion_ns}" \
      -o jsonpath='{.metadata.labels.dp\.isf\.ibm\.com/parent-recipe}' \
      | grep -qx "${parent}" || fail "child recipe is not labeled for the parent"

    oc get db2uinstance "${instance}" -n "${src_ns}" -o jsonpath='{.metadata.labels.for-backup}' \
      | grep -qx 'true' || fail "${instance} is missing for-backup=true"
    state=$(oc get db2uinstance "${instance}" -n "${src_ns}" -o jsonpath='{.status.state}')
    [ "${state}" = "Ready" ] || fail "${instance} state is '${state}', expected Ready"
    oc get pods -n "${src_ns}" -l name=dashmpp-head-0 --no-headers | grep -q Running \
      || fail "dashmpp-head-0 is not Running in ${src_ns}"

    loc=$(phase_of backupstoragelocation "${bsl}")
    echo "BackupStorageLocation phase: ${loc:-<empty>}"
    case "${loc}" in
      Connected|Available|Ready) ;;
      "") fail "storage location has no phase yet; wait, then re-run before" ;;
      *) fail "storage location phase is '${loc}'" ;;
    esac
    echo "PASS before — safe to start a backup (see docs/operations.md)"
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
    unpaused "${src_ns}"
    echo "PASS after-backup ${name}"
    echo "Restores use the backup name shown in the Fusion UI (see docs/operations.md) as spec.backup in operations/restore.yaml"
    ;;

  after-restore|restore)
    echo "=== after restore ==="
    display=$(oc get ns "${tgt_ns}" -o jsonpath='{.metadata.annotations.openshift\.io/display-name}')
    # set-display-name writes fixed text over the Project manifest's name.
    [ "${display}" = "DB2U Instance (Restored)" ] || fail "display name is '${display}', expected DB2U Instance (Restored)"
    # Labels written by the Transform.
    marker=$(oc get db2uinstance "${instance}" -n "${tgt_ns}" -o jsonpath='{.metadata.labels.backup}')
    [ "${marker}" = "restored" ] || fail "label backup is '${marker}', expected restored"
    env=$(oc get db2uinstance "${instance}" -n "${tgt_ns}" -o jsonpath='{.metadata.labels.my\.cluster/environment}')
    [ "${env}" = "${restore_env}" ] || fail "label my.cluster/environment is '${env}', expected ${restore_env}"
    unpaused "${tgt_ns}"
    state=$(oc get db2uinstance "${instance}" -n "${tgt_ns}" -o jsonpath='{.status.state}')
    [ "${state}" = "Ready" ] || fail "restored instance state is '${state}'"
    src=$(oc get db2uinstance "${instance}" -n "${src_ns}" -o jsonpath='{.status.state}')
    [ "${src}" = "Ready" ] || fail "source instance state is '${src}'"
    echo "PASS after-restore. Confirm the enterprise license on ${tgt_ns}/${instance} yourself."
    ;;

  *)
    echo "Usage: $0 before|after-backup|after-restore" >&2
    echo "  before         required configuration is ready (alias: preflight)" >&2
    echo "  after-backup   newest Backup succeeded (alias: backup)" >&2
    echo "  after-restore  restore target restored (alias: restore)" >&2
    exit 1
    ;;
esac
