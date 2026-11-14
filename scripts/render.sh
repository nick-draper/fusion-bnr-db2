#!/bin/bash
# Fill the manifest templates from .env and write them to build/.
#
# Why this exists:
#   The YAML files in db2u-instance/, ibm-backup-restore/ and recipe-helper/
#   are templates holding ${NAME} placeholders for your namespaces, license,
#   storage class and object-storage details. This writes filled copies to
#   build/, which you then apply with oc. It only writes local files: it never
#   runs oc or contacts a cluster.
#
#   Only the names below are replaced. ${GROUP...} in the recipes and ${ENV}
#   in the transform are Fusion's own variables and pass through unchanged.
#
# Usage (from the repository root):
#   cp .env.example .env      # once, then fill it in
#   ./scripts/render.sh [env-file]
#
# build/ holds your license and keys. It and .env are git-ignored.

set -euo pipefail
shopt -u patsub_replacement 2>/dev/null || true   # bash 5.2+: keep & literal in replacements

root=$(cd "$(dirname "$0")/.." && pwd)
cd "${root}"
env_file=${1:-.env}
out=build

NAMES="FUSION_NS OP_NS SOURCE_NS TARGET_NS HELPER_NS DB2_LICENSE STORAGE_CLASS S3_BUCKET_NAME S3_ENDPOINT S3_REGION S3_ACCESS_KEY_ID S3_ACCESS_KEY"
# Values the templates hold inside single quotes; a ' in them is doubled for YAML.
QUOTED=" DB2_LICENSE S3_ENDPOINT S3_ACCESS_KEY_ID S3_ACCESS_KEY "

fail() { echo "ERROR: $*" >&2; exit 1; }

[ -f "${env_file}" ] || fail "${env_file} not found. Copy .env.example to .env and fill it in."

# Read KEY=value lines without running the file as shell code.
while IFS= read -r line || [ -n "${line}" ]; do
  line=${line%$'\r'}
  case "${line}" in ''|'#'*) continue ;; esac
  [[ "${line}" == *=* ]] || fail "${env_file}: not KEY=value: ${line}"
  key=${line%%=*}; key=${key//[[:space:]]/}
  val=${line#*=}
  if [[ "${val}" =~ ^\"(.*)\"$ ]] || [[ "${val}" =~ ^\'(.*)\'$ ]]; then val=${BASH_REMATCH[1]}; fi
  case " ${NAMES} " in
    *" ${key} "*) printf -v "v_${key}" '%s' "${val}" ;;
    *) echo "WARN: ${env_file}: ${key} is not used by the templates" >&2 ;;
  esac
done < "${env_file}"

value() { local n="v_$1"; printf '%s' "${!n-}"; }

# Every value is required; check the ones with a fixed shape.
dns='^[a-z0-9]([-a-z0-9]*[a-z0-9])?$'
missing=""
for n in ${NAMES}; do [ -n "$(value "${n}")" ] || missing="${missing} ${n}"; done
[ -z "${missing}" ] || fail "set these in ${env_file}:${missing}"
for n in FUSION_NS OP_NS SOURCE_NS TARGET_NS HELPER_NS; do
  v=$(value "${n}")
  [[ "${v}" =~ ${dns} ]] && [ ${#v} -le 63 ] || fail "${n} must be a valid namespace name (lowercase letters, digits, -)"
done
[[ "$(value STORAGE_CLASS)" =~ ^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$ ]] || fail "STORAGE_CLASS must be a valid storage class name"
[[ "$(value S3_BUCKET_NAME)" =~ ^[a-z0-9][-a-z0-9.]{1,61}[a-z0-9]$ ]] || fail "S3_BUCKET_NAME must be a valid bucket name"
[[ "$(value S3_REGION)" =~ ^[a-z0-9-]+$ ]] || fail "S3_REGION must be letters, digits and -"
[[ "$(value S3_ENDPOINT)" =~ ^https?://[^[:space:]]+$ ]] || fail "S3_ENDPOINT must be an http(s) URL"
[ "$(value SOURCE_NS)" != "$(value TARGET_NS)" ] || fail "SOURCE_NS and TARGET_NS must differ"
for n in ${NAMES}; do
  case "$(value "${n}")" in *$'\n'*) fail "${n} must be on one line" ;; esac
done

# Write the filled copies. build/ holds secrets, so keep it private to you.
umask 077
rm -rf "${out}"
count=0
while IFS= read -r -d '' src; do
  content=$(cat "${src}"; printf x); content=${content%x}
  for n in ${NAMES}; do
    v=$(value "${n}")
    case "${QUOTED}" in *" ${n} "*) v=${v//\'/\'\'} ;; esac
    content=${content//"\${${n}}"/"${v}"}
  done
  dst="${out}/${src}"
  mkdir -p "$(dirname "${dst}")"
  printf '%s' "${content}" > "${dst}"
  count=$((count + 1))
done < <(find db2u-instance ibm-backup-restore recipe-helper -name '*.yaml' -print0 | sort -z)

# Anything left in ${...} must be one of Fusion's own variables.
left=$(grep -rhoE '\$\{[A-Za-z_][A-Za-z0-9_.-]*\}' "${out}" | sort -u | grep -vE '^\$\{(GROUP\..*|ENV)\}$' || true)
[ -z "${left}" ] || fail "unfilled placeholders in ${out}/: ${left//$'\n'/ }"

# The namespace and storage class names, for the commands in docs/end-to-end.md: source build/env.sh
{
  echo "# Written by scripts/render.sh from ${env_file}. Namespace and storage class names only; no secrets."
  for n in FUSION_NS OP_NS SOURCE_NS TARGET_NS HELPER_NS STORAGE_CLASS; do printf 'export %s=%q\n' "${n}" "$(value "${n}")"; done
} > "${out}/env.sh"

echo "Wrote ${count} manifests and env.sh to ${out}/ from ${env_file}."
echo "Next: source ${out}/env.sh, then apply from ${out}/ as docs/end-to-end.md describes."
