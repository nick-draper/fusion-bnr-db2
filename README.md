[![IBM Fusion](https://img.shields.io/badge/IBM%20Fusion-2.10%2B-0f62fe?logo=ibm&logoColor=white)](https://www.ibm.com/docs/en/fusion-software/2.12.0?topic=recipe-dynamic)
[![Db2uInstance](https://img.shields.io/badge/Db2uInstance-12.1.4%2B-0530ad)](https://github.com/IBM/storage-fusion/tree/master/backup-restore/recipes/Db2)
[![Scope](https://img.shields.io/badge/scope-operator%20%E2%86%92%20instance%20split-0e6027)](docs/end-to-end.md)
[![Last commit](https://img.shields.io/github/last-commit/nick-draper/fusion-bnr-db2)](https://github.com/nick-draper/fusion-bnr-db2/commits/main)

# Db2uInstance backup and restore for IBM Fusion

Recipes for protecting a **Db2uInstance** when the Db2u operator and the database are in different namespaces, and for restoring that backup into another namespace.

IBM’s [`db2u-instance-backup-restore-recipe.yaml`](https://github.com/IBM/storage-fusion/blob/master/backup-restore/recipes/Db2/db2u-instance-backup-restore-recipe.yaml) shows the mechanics correctly for a lab where the operator and the instance share a project. This repository is what we run instead on the layout OpenShift clusters actually use: one operator project, one namespace per instance.

Step-by-step deploy, backup, and restore is in [docs/end-to-end.md](docs/end-to-end.md).

## Who this is for

Platform and database engineers who followed the official recipe, got a Backup object, and then found the backup had not run. Or who restored into a new project and got an instance that still looked like production.

## The layout the sample does not cover

The operator lives in a namespace such as `db2-operator`. Each database is a `Db2uInstance` in its own project. That split is how you keep RBAC, tenancy, and upgrades apart. It is the normal pattern.

The sample searches for `control-plane=db2u-operator-manager` in the **instance** namespace:

```yaml
namespace: ${GROUP.db2u-volumes.namespace}
```

The manager pod is not there, so these hooks never run:

- `db2u-operator-manager-exec/maintenance-mode-on`
- `db2u-operator-manager-exec/engine-maintenance-mode-on`

Fusion still creates the Backup. The database is never placed in maintenance mode, and the snapshot is not taken. The failure is in the hook log, not in the Backup’s existence.

The same README also limits restore to the **same** namespace. Promoting prod to QA, rebuilding a project, or recovering onto a spoke all need a different target, rewritten affinity and labels, and a Project display name that belongs to that target.

The parent recipe owns the operator hooks. The child owns the instance. A PolicyAssignment names only the parent. Fusion finds the child from its labels.

![Parent recipe calls the child. Operator hooks stay in db2-operator. The instance namespace is the only thing backed up.](docs/images/architecture.svg)

## What changed from the sample

| Gap in the sample | What this repository does |
|-------------------|---------------------------|
| Operator hooks run in the instance namespace | Parent hooks target `db2-operator` |
| Operator, subscriptions, and the database are one backup | The Application includes the instance namespace only |
| Exclude-list, then copy everything else | Allow-list: volumes, configmaps, secrets, `Db2uInstance` |
| No undo if the snapshot fails after suspend | `inverseOp` resumes I/O and clears maintenance |
| Same-namespace restore only | Transform, `namespaceMapping`, and a Restore example |
| Target Project keeps the source display name | `set-display-name` uses the target suffix: `db2u-qa` becomes `Db2 Warehouse (QA)` |
| One flat recipe | Fusion 2.10 parent/child. The assignment names the parent |
| Readiness is only `state == Ready` | The instance check also requires `FormationStatus == OK` |
| Nothing marks a restored database | Annotation `db2u.fusion/restored=true` |

Two scripts from IBM’s folder are still required, and they are limited to `Db2uInstance`:

- [`scripts/backup-pre-req.sh`](scripts/backup-pre-req.sh) sets `for-backup=true`. The readiness check selects on that label. Without it, restore waits until timeout.
- [`scripts/restore-pre-req.sh`](scripts/restore-pre-req.sh) grants Fusion’s transaction-manager `get`, `list`, and `patch` on `db2uinstances` and `db2uengines`. A spoke restore fails with a permission error if this is missing. `patch` is what the restored annotation needs.

## How backup and restore run

Fusion 2.10 builds one workflow from a parent plus a child. The parent does not name the instance namespace. Hooks use `${GROUP.db2u-volumes.namespace}`, which follows `namespaceMapping` on restore.

```
backup:  maintenance on → engine maintenance on → instance-backup → maintenance off
restore: set-display-name → instance-restore → sleep 300s → maintenance off

instance-backup:  resources → Db2uInstance → suspend → volumes → resume
instance-restore: volumes → resources → Db2uInstance → engine Ready
                  → snapshot restore → resume → instance Ready
                  → annotate db2u.fusion/restored=true
```

The child carries:

```yaml
dp.isf.ibm.com/parent-recipe: db2u-parent-recipe
dp.isf.ibm.com/parent-recipe-namespace: ibm-spectrum-fusion-ns
```

Groups use `includedResourceTypes`. The sample uses an exclude list and then backs up whatever remains, which pulls operator and OLM objects into the backup when they share the namespace. An allow-list leaves a new type out until you add it. Run [`scripts/discover-instance-resources.sh`](scripts/discover-instance-resources.sh) against a real instance namespace before you widen the list.

`manage_snapshots` runs in container `db2u` on pod `dashmpp-head-0`. Maintenance patches run in the operator manager, using that pod’s service account. Those stay exec hooks. A Job hook starts another pod, with another image and identity, and cannot see the binary or the token.

Assign `db2u-parent-recipe` on the PolicyAssignment **before the first backup**. A backup taken with no recipe has no quiesce and no resource order, and a later restore cannot invent them. See [I didn’t use a recipe on backup](https://community.ibm.com/community/user/blogs/jim-smith/2024/03/13/fusion-recipe-tips-no-backup-recipe).

## Restoring into another namespace

A backup taken in namespace A does not apply unchanged in namespace C. Affinity still says prod. Labels still name the source environment. The OpenShift Project keeps the source `openshift.io/display-name`, so the console shows the backed-up environment on the target. The sample ships no Transform. Restores failed here more often than they failed in the backup hooks, including instances that returned and then sat in maintenance shutdown because those references were still the source values.

Three things have to move together:

1. `namespaceMapping` on the Restore (`db2u-prod` to `db2u-qa` in the example).
2. A Transform whose JSON paths match your `Db2uInstance`. The example is a starting point, not a schema for every cluster.
3. `set-display-name` on the target project. The text is `Db2 Warehouse (<SUFFIX>)`. The suffix is the segment after the last `-`, in upper case. `dw-stg` becomes `Db2 Warehouse (STG)`.

Create the target project before you apply the Restore. The display-name hook patches that namespace first.

![Source namespace, namespace mapping, JSON patch, and the target project display name.](docs/images/transform.svg)

Files on disk are not a working instance. Before Db2 12.1.4, OADP restored the database and left credentials and license configuration behind. The pod could start, the restore could look successful, and the instance still could not operate. The usual sign was a trial license, because `db2-lic` had not been preserved.

Db2 **12.1.4** added `db2u-velero-plugin` for that. Reporting the gap is part of why the plugin exists. Install it on the Fusion DataProtectionApplication with IBM’s current image, not a digest copied into git: [Fusion backup and restore utility](https://www.ibm.com/docs/en/software-hub/5.4.x?topic=utilities-fusion-backup-restore-utility). Confirm the enterprise license after every cross-namespace test. A Ready pod on a trial license is a failed restore.

On releases older than 12.1.4, the bridge was to put the enterprise license in `db2-lic` before backup so the restored files already contained it. Move to 12.1.4 and the plugin when you can.

## If the snapshot fails

Quiesce is what makes the copy consistent, and it is also how a failed backup takes the database out of service. Suspend and both maintenance-on steps name an `inverseOp`. If the volume snapshot fails, Fusion runs those undos in reverse: resume I/O, then clear engine maintenance, then clear instance maintenance.

![inverseOp resumes the database and clears maintenance when the volume snapshot fails.](docs/images/failover.svg)

That path puts the **source** database back into service. It is not a failover to another site. Recovery into another namespace is the Restore in the previous section. The pattern is IBM’s [undo an operation](https://community.ibm.com/community/user/blogs/sandeep-prajapati/2024/04/05/fusion-recipe-tips-how-to-undo-an-operation-in-cas) note.

## Slow restores and timeouts

The sample does not say how long Db2 recovery takes. Crash recovery, log replay, and rollback are heavy on CPU, memory, and disk. An undersized pod, a slow storage class, or an eviction can stretch a restore for hours. Fusion may report the recipe step complete while the database is still recovering, or the Restore may hit its timeout.

Size the target for recovery, not for steady state. Watch pod CPU, memory, and volume latency while `manage_snapshots restore` and the readiness checks run. Set the Restore timeout from a measured run in your cluster. Cancel a stuck restore before the timeout fires.

While implementing this we also saw a Restore timeout followed by deletion of the **target** namespace, rather than a partial apply left in place. Treat that as a data-loss risk:

- Measure restore time before you depend on it.
- Set the timeout above that measurement.
- If a target namespace disappears, read the Restore status and the audit log before you assume a person deleted the project.

## Put it on a cluster

You need Fusion Backup & Restore **2.10 or newer**, a Db2u operator in its own namespace, a `Db2uInstance` on Db2 **12.1.4 or newer**, the Velero plugin on the Fusion DataProtectionApplication, and `oc` and `jq` on the workstation.

![Order of operations from the plugin through a cross-namespace restore.](docs/images/deploy.svg)

```bash
./scripts/restore-pre-req.sh
oc apply -f recipe/db2u-parent-recipe.yaml
oc apply -f recipe/db2u-instance-child-recipe.yaml
./scripts/backup-pre-req.sh <DB2U_INSTANCE_NAMESPACE>
```

Point the PolicyAssignment at `db2u-parent-recipe`, then follow [docs/end-to-end.md](docs/end-to-end.md) for the backup and the restore into a new namespace. Edit the files in [`examples/`](examples/) before you apply them. The Velero file there is a reminder, not a DataProtectionApplication.

| Path | Role |
|------|------|
| [docs/end-to-end.md](docs/end-to-end.md) | Deploy, backup, restore, and what to check |
| [recipe/db2u-parent-recipe.yaml](recipe/db2u-parent-recipe.yaml) | Operator hooks, display name, workflow order |
| [recipe/db2u-instance-child-recipe.yaml](recipe/db2u-instance-child-recipe.yaml) | Volumes, secrets, instance, quiesce, readiness |
| [scripts/](scripts/) | Label, ClusterRole, and resource discovery |
| [examples/](examples/) | Transform, Restore, and plugin reminder |

## Out of scope

- `Db2uCluster`
- Backing up the operator, OLM subscriptions, or cluster-scoped objects
- Job hooks, and parallel children. Parallel execution only helps when one Application covers several instances and every parallel sequence is hooks only. A volume group forces sequential execution.
- Storage credentials and backup-location secrets

## Further reading

- [IBM Fusion Db2 recipes](https://github.com/IBM/storage-fusion/tree/master/backup-restore/recipes/Db2)
- [Dynamic parent/child recipes](https://community.ibm.com/community/user/blogs/ashish-gupta/2025/06/04/fusion-dynamic-recipe)
- [Undo with `inverseOp`](https://community.ibm.com/community/user/blogs/sandeep-prajapati/2024/04/05/fusion-recipe-tips-how-to-undo-an-operation-in-cas)
- [Make a recipe generic](https://community.ibm.com/community/user/blogs/ashish-gupta/2024/03/25/fusion-recipe-tips-keeping-database-credentials-a)
- [Check hook conditions](https://community.ibm.com/community/user/blogs/sandeep-prajapati/2025/06/12/how-to-write-fusion-recipe-check-hook-condition-st)
- [Label and annotation hooks](https://community.ibm.com/community/user/blogs/sandeep-prajapati/2025/06/12/using-fusion-label-and-annotation-hooks)
- [Resource discovery](https://community.ibm.com/community/user/blogs/sandeep-prajapati/2026/01/11/making-kubernetes-or-openshift-backup-and-restore)
