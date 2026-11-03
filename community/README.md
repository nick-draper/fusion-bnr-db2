# Db2u Fusion Backup & Restore — Community Recipe Pack

Deploy, backup, and cross-namespace restore steps: [`docs/end-to-end.md`](../docs/end-to-end.md).

Production-oriented Fusion recipes for **Db2uInstance** when the **operator and instance are in different namespaces**.

**Scope: `Db2uInstance` only.** This pack does not cover `Db2uCluster` or backing up the Db2u operator / OLM.

## Contents

| Path | What it is |
|------|------------|
| `recipe/db2u-parent-recipe.yaml` | Parent: operator maintenance hooks + backup/restore orchestration |
| `recipe/db2u-instance-child-recipe.yaml` | Child: volumes, secrets/configmaps, Db2uInstance CR, suspend/resume/restore |
| `scripts/backup-pre-req.sh` | Labels `Db2uInstance` with `for-backup=true` |
| `scripts/restore-pre-req.sh` | Extends Fusion ClusterRole (`get`/`list`/`patch`) for Db2u APIs |
| `scripts/discover-instance-resources.sh` | Inventory instance ns before changing the include-list |
| `transform/db2u-transform-prod-to-qa.example.yaml` | Example prod → qa JSON Patch transform |
| `restore/db2u-restore-cross-namespace.example.yaml` | Example Restore CR (namespace mapping + recipe + transform) |
| `velero/dpa-db2u-velero-plugin.example.yaml` | Reminder for the Db2u Velero plugin on the Fusion DPA |

## Requirements

- **IBM Fusion Backup & Restore 2.10+** (Dynamic / parent-child recipes)
- Db2u operator in a dedicated namespace (recipes default to `db2-operator`)
- Instance(s) in separate Application-included namespace(s)
- **Db2 12.1.4+** and the **Db2u Velero plugin** (see below)
- `for-backup=true` on Db2uInstance (via `scripts/backup-pre-req.sh`)

## Why this pack differs from IBM’s Db2 sample

Compared with IBM’s [`db2u-instance-backup-restore-recipe.yaml`](https://github.com/IBM/storage-fusion/blob/master/backup-restore/recipes/Db2/db2u-instance-backup-restore-recipe.yaml):

1. **No production deployment has the operator and database in the same namespace.** The operator is centralized (e.g. `db2-operator`); each Db2uInstance lives in its own project. IBM’s sample runs operator hooks in `${GROUP.db2u-volumes.namespace}` (the instance ns) — that only works for co-located lab installs.
2. **You would not back up the operator with the database.** Operator lifecycle is independent of instance data protection. IBM’s sample includes `operatorgroups` / `subscriptions` in the instance recipe. This pack does not: Application includes the instance namespace only; parent recipes only *exec* into the operator namespace for maintenance hooks.
3. **Db2uInstance only.** No `Db2uCluster` recipes or labels.
4. **Include-lists, not exclude-lists.** IBM’s sample sets `excludedResourceTypes` and then backs up everything else in the namespace. This pack names only volumes, configmaps, secrets, and `Db2uInstance`. A new type is left out until you add it — fail closed, not fail open.
5. **Cross-namespace restore** is in scope here (Transform + Restore examples + `set-display-name` + restored annotation). IBM’s README states same-namespace restore only.

## Always assign the recipe before the first backup

Fusion can take a backup with no recipe. That backup will not have quiesce, maintenance pause, or the resource order this pack defines, and a later restore cannot invent that workflow. Assign `db2u-parent-recipe` on the PolicyAssignment **before** the first backup. See [I didn’t use a recipe on backup](https://community.ibm.com/community/user/blogs/jim-smith/2024/03/13/fusion-recipe-tips-no-backup-recipe).

## Resource discovery (before you publish or widen the include-list)

```bash
./scripts/discover-instance-resources.sh <DB2U_INSTANCE_NAMESPACE>
```

Uses [`oc get-resources`](https://github.com/Sandeep-Prajapati/kubectl-get-resources). Compare namespace-scoped kinds to `includedResourceTypes` in the child recipe. Do not add the operator namespace or cluster-scoped objects to this pack.

## Webhook contingency

If a restore log shows `failed calling webhook`, an admission webhook rejected a resource while its service was not ready. This pack does not back up operator webhooks. If you still hit it: set that webhook `failurePolicy` to `Ignore` for the restore, retry without wiping restored PVCs, then restore the original `failurePolicy`. See [applications with webhooks](https://community.ibm.com/community/user/blogs/sandeep-prajapati/2025/11/27/fusion-backup-and-restore-considerations-for-appli).

## Why not Job hooks?

Job hooks are for long-running work that should run as its own Kubernetes Job. These steps cannot:

- `manage_snapshots` only exists inside the `db2u` container on `dashmpp-head-0`
- maintenance patches use the operator manager pod’s service-account token
- `sleep` and the display-name patch are short

An exec hook in that container is the right tool. A Job would be a different pod, image, and identity.

## Pre-req scripts (why they exist)

### `scripts/backup-pre-req.sh`

**Problem:** The child recipe’s `db2uinstance-check` uses `labelSelector: for-backup=true`. Unlabeled instances are invisible to that check → restore appears stuck after snapshot restore.

**What it does:** Labels every `Db2uInstance` in the given namespace with `for-backup=true`.

```bash
./scripts/backup-pre-req.sh <DB2U_INSTANCE_NAMESPACE>
```

Run once per instance namespace before the first backup (and when new instances appear).

### `scripts/restore-pre-req.sh`

**Problem:** Restore hooks/checks call the Db2u APIs (`db2uinstances`, `db2uengines`). Fusion’s `transaction-manager-ibm-backup-restore` ClusterRole often lacks those resources → permission failures on the restore target (especially spokes).

**What it does:** Adds `get`/`list`/`patch` on `db2uengines` and `db2uinstances` (`patch` is required by the restored annotation hook). Not `db2uclusters`.

```bash
./scripts/restore-pre-req.sh
```

Run on the restore target before the first Db2u restore (and on the hub if hub == target).

## Db2u Velero plugin

We followed IBM Software Hub’s Fusion backup & restore utility to install/configure the plugin:

[Fusion backup and restore utility](https://www.ibm.com/docs/en/software-hub/5.4.x?topic=utilities-fusion-backup-restore-utility)

**Why it matters:** Without `db2u-velero-plugin`, restore can return volumes without usable credentials/license — the instance looks restored but cannot operate. Db2 12.1.4+ plus this plugin preserves that configuration.

**What to do (summary):**

1. Use the Software Hub utility / documented DPA patch flow for your version (do not invent image digests).
2. Ensure the Fusion-managed `DataProtectionApplication` (`velero` in `ibm-backup-restore`) lists the plugin under `spec.configuration.velero.customPlugins`.
3. Prefer the current documented image, e.g. from `cpd-cli oadp install --db2u-velero-plugin-image=…` (default example in 5.4 docs: `icr.io/db2u/db2u-velero-plugin:5.4.0`).

```bash
oc get dpa velero -n ibm-backup-restore \
  -o jsonpath='{.spec.configuration.velero.customPlugins}' ; echo
```

See `velero/dpa-db2u-velero-plugin.example.yaml` for a fragment-style reminder (not a full DPA to apply).

## Architecture

```
db2u-parent-recipe
  backup:  maintenance-on → engine-maintenance-on → [child: instance-backup] → maintenance-off
  restore: set-display-name → [child: instance-restore] → sleep → maintenance-off

db2u-instance-child-recipe  (labels → parent)
  instance-backup:  resources → Db2uInstance → suspend → volumes → resume
  instance-restore: volumes → resources → Db2uInstance → checks → restore → resume → ready (state + FormationStatus) → annotate restored
```

Instance namespace resolves via `${GROUP.db2u-volumes.namespace}` from the Fusion Application include list. Application should include the **instance** namespace only — not `db2-operator`.

### Why `set-display-name` matters

Cross-namespace restore often leaves the target Project with the **source** `openshift.io/display-name`. The parent restore workflow patches the target first.

- Namespace: `${GROUP.db2u-volumes.namespace}` (honours `namespaceMapping`)
- Display name from suffix after the last `-`:

  | Target namespace | `openshift.io/display-name` |
  |------------------|----------------------------|
  | `…-qa` / `dw-qa` | `Db2 Warehouse (QA)` |
  | `…-dev` | `Db2 Warehouse (DEV)` |
  | `dw-stg` | `Db2 Warehouse (STG)` |

## Failure safety (`inverseOp`)

| Op | `inverseOp` |
|----|-------------|
| `maintenance-mode-on` | `maintenance-mode-off` |
| `engine-maintenance-mode-on` | `engine-maintenance-mode-off` |
| `suspend` | `resume` |

See IBM’s [undo / inverseOp tip](https://community.ibm.com/community/user/blogs/sandeep-prajapati/2024/04/05/fusion-recipe-tips-how-to-undo-an-operation-in-cas).

## Apply

```bash
# 0. Cluster pre-reqs
./scripts/restore-pre-req.sh
./scripts/backup-pre-req.sh <DB2U_INSTANCE_NAMESPACE>
# Confirm Db2u Velero plugin on the Fusion DPA (see Velero section)

# 1. Recipes (parent first, then child)
oc apply -f recipe/db2u-parent-recipe.yaml
oc apply -f recipe/db2u-instance-child-recipe.yaml

# 2. Wire PolicyAssignment to db2u-parent-recipe
#    Application includes the instance namespace only — not db2-operator

# 3. Cross-namespace restore (edit placeholders first)
oc apply -f transform/db2u-transform-prod-to-qa.example.yaml
oc apply -f restore/db2u-restore-cross-namespace.example.yaml
```

```bash
oc get recipe -n ibm-spectrum-fusion-ns \
  -l dp.isf.ibm.com/parent-recipe=db2u-parent-recipe
```

## Customize before production use

1. **Operator namespace** — if not `db2-operator`, edit the parent hook `namespace`.
2. **Transform paths** — match your Db2uInstance affinity/labels.
3. **Restore** — real `spec.backup` name and `namespaceMapping`.
4. **Display name prefix** — edit `"Db2 Warehouse (...)"` in `set-display-name` if needed.
5. **Sleep / timeouts** — tune for your restore duration; monitor long restores.

## Optional later (not in this pack)

- **Label hook instead of `backup-pre-req.sh`** — could set `for-backup=true` inside the recipe. The script stays explicit and runs before backup selection.
- **Richer checks** — add more JSONPath clauses only after you confirm they exist on your `Db2uInstance` / `Db2uEngine` status.
- **Parallel child workflows** — only if one Application protects multiple instances and every parallel sequence is hooks-only. A group in the sequence forces sequential execution.

## What this pack intentionally omits

- **Job hooks** — quiesce and maintenance must run inside the existing Db2u and operator pods (see above)

- Operator / OLM backup (`operatorgroups`, `subscriptions`, CSV) — not colocated; not part of instance protection
- **`Db2uCluster`** — Db2uInstance only
- Cluster credentials / BackupStorageLocation secrets / full DPA exports
- Hardcoded instance namespace lists (use Application `includedNamespaces`)

## References

- [IBM storage-fusion Db2 recipes](https://github.com/IBM/storage-fusion/tree/master/backup-restore/recipes/Db2)
- [Fusion Dynamic Recipe (Parent-Child)](https://community.ibm.com/community/user/blogs/ashish-gupta/2025/06/04/fusion-dynamic-recipe)
- [Recipe undo with `inverseOp`](https://community.ibm.com/community/user/blogs/sandeep-prajapati/2024/04/05/fusion-recipe-tips-how-to-undo-an-operation-in-cas)
- [Label and annotation hooks](https://community.ibm.com/community/user/blogs/sandeep-prajapati/2025/06/12/using-fusion-label-and-annotation-hooks)
- [Check hook conditions](https://community.ibm.com/community/user/blogs/sandeep-prajapati/2025/06/12/how-to-write-fusion-recipe-check-hook-condition-st)
- [Resource discovery](https://community.ibm.com/community/user/blogs/sandeep-prajapati/2026/01/11/making-kubernetes-or-openshift-backup-and-restore)
- [IBM Software Hub — Fusion B&R utility / Velero plugins](https://www.ibm.com/docs/en/software-hub/5.4.x?topic=utilities-fusion-backup-restore-utility)
- Db2 12.1.4 — OADP / `db2u-velero-plugin` credential preservation
