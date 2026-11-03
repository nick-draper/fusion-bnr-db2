[![IBM Fusion](https://img.shields.io/badge/IBM%20Fusion-2.10%2B-0f62fe?logo=ibm&logoColor=white)](https://www.ibm.com/docs/en/fusion-software/2.12.0?topic=recipe-dynamic)
[![Db2uInstance](https://img.shields.io/badge/Db2uInstance-12.1.4%2B-0530ad)](https://github.com/IBM/storage-fusion/tree/master/backup-restore/recipes/Db2)
[![Scope](https://img.shields.io/badge/scope-operator%20%E2%86%92%20instance%20split-0e6027)](docs/end-to-end.md)
[![Last commit](https://img.shields.io/github/last-commit/nick-draper/fusion-bnr-db2)](https://github.com/nick-draper/fusion-bnr-db2/commits/main)

# Db2uInstance backup and restore for IBM Fusion

Production recipes for protecting a **Db2uInstance** with IBM Fusion Backup & Restore when the Db2u operator and the database do not share a namespace.

IBM’s sample, [`db2u-instance-backup-restore-recipe.yaml`](https://github.com/IBM/storage-fusion/blob/master/backup-restore/recipes/Db2/db2u-instance-backup-restore-recipe.yaml), is a solid example. It is not a production blueprint. This repository is the recipe we ended up running after that example failed in a normal OpenShift layout: one operator project, one namespace per instance, and restores into a different environment.

Deploy and test steps are in [docs/end-to-end.md](docs/end-to-end.md).

![Parent and child recipe](docs/images/architecture.svg)

![Transform on restore](docs/images/transform.svg)

![Failure undo](docs/images/failover.svg)

## Why this exists

Fusion is the natural way to protect Db2 on OpenShift. The official recipe shows the mechanics: pause reconcile, `manage_snapshots` suspend, snapshot volumes, resume. Follow it in a lab where the operator and the instance live in the same namespace and it works.

Production clusters are not built that way. The operator sits in a dedicated namespace such as `db2-operator`. Each database is a `Db2uInstance` in its own project. That split is how you isolate RBAC, tenancy, and upgrades. It is the common pattern, not an edge case.

The sample looks for the operator manager with `control-plane=db2u-operator-manager` **in the instance namespace**:

```yaml
namespace: ${GROUP.db2u-volumes.namespace}
```

The pod is not there. These hooks never run:

- `db2u-operator-manager-exec/maintenance-mode-on`
- `db2u-operator-manager-exec/engine-maintenance-mode-on`

The Backup object is created. The backup does not. Logs show the hook could not find the manager pod. Without maintenance mode, you do not get a consistent snapshot.

IBM’s own Db2 recipe README states the other limit directly: restore to the **same** namespace only. A backup you cannot place in another project is not a service-protection strategy. Promoting prod into QA, rebuilding a namespace, or recovering onto a spoke all require a different target namespace, rewritten affinity and labels, and a Project display name that is not the source environment’s name.

This pack is that missing layer. Fusion stays the engine. The recipe is what makes Db2u protection match the cluster you actually run.

## What we had to add

| Gap in the sample | What this pack does |
|-------------------|---------------------|
| Operator hooks run in the instance namespace | Parent hooks target `db2-operator` |
| Operator, subscriptions, and the database are one backup | Instance namespace only. The operator is not backed up with the data |
| Exclude-list, then copy everything else | Allow-list: volumes, configmaps, secrets, `Db2uInstance` |
| No undo if snapshot fails after suspend | `inverseOp` resumes I/O and clears maintenance |
| Same-namespace restore only | Transform + `namespaceMapping` + Restore example |
| Target Project keeps the source display name | `set-display-name` from the target suffix: `db2u-qa` → `Db2 Warehouse (QA)` |
| One flat recipe | Fusion 2.10 parent/child recipe. PolicyAssignment names the parent only |
| Readiness is `state == Ready` | Instance check also requires `FormationStatus == OK` |
| Nothing marks a restored database | Annotation `db2u.fusion/restored=true` |

Two scripts from IBM’s folder are still required, narrowed to `Db2uInstance`:

- `community/scripts/backup-pre-req.sh` labels `for-backup=true`. The readiness check selects on that label. Without it, restore waits until timeout.
- `community/scripts/restore-pre-req.sh` grants Fusion’s transaction-manager `get`, `list`, and `patch` on `db2uinstances` and `db2uengines`. Restore hooks fail with a permission error on a spoke if this is missing. `patch` is what the restored annotation needs.

## Credentials and the 12.1.4 plugin

Backup and restore of files are not enough. On Db2 before 12.1.4, OADP restored the database files and left credentials and license configuration behind. The pod could start, the restore could look successful, and the instance still could not operate. The usual symptom was a default trial license instead of the enterprise license, because the `db2-lic` material was not preserved.

Db2 **12.1.4** added `db2u-velero-plugin` so a restored deployment keeps credentials and configuration. That change came out of this gap being reported. Install the plugin on the Fusion `DataProtectionApplication` using IBM’s Software Hub steps, not a digest copied into git:

[Fusion backup and restore utility](https://www.ibm.com/docs/en/software-hub/5.4.x?topic=utilities-fusion-backup-restore-utility)

A Ready pod with a trial license is a failed restore. Confirm the license after every cross-namespace test.

On releases older than 12.1.4 the practical bridge was to place the enterprise license in `db2-lic` before backup so the restored files already contained it. Prefer the plugin. Do not stay on the workaround once you can move to 12.1.4.

## Restore is not backup run backwards

A backup from namespace A, taken while the instance lived in that project, does not apply unchanged in namespace C.

- Node affinity still says prod.
- Labels still name the source environment.
- The OpenShift Project `openshift.io/display-name` is the source name, so the console shows the backup’s environment on the target.
- Secrets and config that embed the old namespace are stale.

IBM’s sample does not ship a Transform. Most failed restores we hit were here, including instances that came back and then sat in maintenance shutdown because operator and namespace references were still the source values.

This pack restores with three pieces:

1. `namespaceMapping` on the Restore (`db2u-prod` → `db2u-qa` in the example).
2. A Transform you edit to match your `Db2uInstance` affinity and labels.
3. `set-display-name` on the target namespace. The label is `Db2 Warehouse (<SUFFIX>)`, where the suffix is the segment after the last `-`, uppercased. `dw-stg` becomes `Db2 Warehouse (STG)`.

Create the target project before the Restore. The display-name hook patches that namespace first.

## Quiesce, and undoing it

Consistent backups need the database quiesced and the operator told not to reconcile mid-snapshot.

Backup order:

1. Pause `Db2uInstance` reconcile.
2. Pause `Db2uEngine` reconcile.
3. Child recipe: configmaps and secrets, the `Db2uInstance`, `manage_snapshots suspend`, volume snapshot, `manage_snapshots resume`.
4. Clear both maintenance annotations.

`manage_snapshots` runs inside container `db2u` on pod `dashmpp-head-0`. Maintenance patches run inside the operator manager, using that pod’s service account. Those are exec hooks on purpose. A Job hook starts a different pod, with a different image and identity, and cannot see `manage_snapshots` or the operator token.

If the volume snapshot fails after suspend, Fusion runs `inverseOp` and resumes I/O. The same pairing clears maintenance if a later step fails. Without that, a failed backup leaves the database locked. The pattern is the one in IBM’s [undo an operation](https://community.ibm.com/community/user/blogs/sandeep-prajapati/2024/04/05/fusion-recipe-tips-how-to-undo-an-operation-in-cas) note.

Assign `db2u-parent-recipe` on the PolicyAssignment **before the first backup**. A backup taken with no recipe has no quiesce and no resource order. You cannot invent that on restore. See [I didn’t use a recipe on backup](https://community.ibm.com/community/user/blogs/jim-smith/2024/03/13/fusion-recipe-tips-no-backup-recipe).

## Parent and child

Fusion 2.10 can build one workflow from a parent recipe plus child recipes. That matches this layout: the parent owns operator orchestration, the child owns one instance.

```
db2u-parent-recipe
  backup:  maintenance on → engine maintenance on → instance-backup → maintenance off
  restore: set-display-name → instance-restore → sleep 300s → maintenance off

db2u-instance-child-recipe
  instance-backup:  resources → Db2uInstance → suspend → volumes → resume
  instance-restore: volumes → resources → Db2uInstance → engine Ready
                    → manage_snapshots restore → resume → instance Ready
                    → annotate db2u.fusion/restored=true
```

The child is discovered by labels, not by a name on the Restore:

```yaml
dp.isf.ibm.com/parent-recipe: db2u-parent-recipe
dp.isf.ibm.com/parent-recipe-namespace: ibm-spectrum-fusion-ns
```

The instance namespace comes from `${GROUP.db2u-volumes.namespace}` after `namespaceMapping`. Nothing in the recipe hardcodes an application name.

Groups use `includedResourceTypes`. IBM’s sample uses an exclude list and then backs up whatever remains, which pulls in operator and OLM objects when they share the namespace. An allow-list leaves a new resource type out until you add it. Run `community/scripts/discover-instance-resources.sh` against a real instance namespace before you widen that list.

## Slow restores and timeouts

The sample never mentions how long Db2 recovery takes. Crash recovery, log replay, and rollback are heavy on CPU, memory, and disk. An undersized pod, a slow storage class, or a pod eviction stretches a restore for hours. Fusion will report the recipe step finished while the database is still recovering, or the Restore will hit its timeout.

Size the target for recovery, not for steady state. Watch pod CPU, memory, and volume latency while `manage_snapshots restore` and the readiness checks run. Raise the Restore timeout and the check timeouts to match a measured run in your cluster. A timeout you cancel is safer than one you discover afterwards.

While implementing this we also saw a Restore timeout followed by deletion of the **target** namespace, not a clean partial apply. Treat a long or timed-out restore as a data-loss risk:

- Measure restore time before you depend on it.
- Set the timeout above that measurement.
- Watch the Restore and cancel it before the timeout if it is stuck.
- If a target namespace disappears, check the Restore status and the audit log before you assume someone deleted the project.

## What you need

- IBM Fusion Backup & Restore **2.10+**
- Db2u operator in its own namespace (default in the recipe: `db2-operator`)
- A `Db2uInstance` in a separate namespace, Db2 **12.1.4+**
- `db2u-velero-plugin` on the Fusion DataProtectionApplication
- `oc` and `jq` on the workstation

The Application includes the instance namespace only.

## Layout

| Path | Role |
|------|------|
| [docs/end-to-end.md](docs/end-to-end.md) | Deploy, back up, restore into a new namespace, and what to check |
| [community/recipe/db2u-parent-recipe.yaml](community/recipe/db2u-parent-recipe.yaml) | Operator hooks, display name, backup and restore order |
| [community/recipe/db2u-instance-child-recipe.yaml](community/recipe/db2u-instance-child-recipe.yaml) | Volumes, secrets, instance CR, quiesce, readiness, restored annotation |
| [community/scripts/](community/scripts/) | Label, ClusterRole, and resource-discovery helpers |
| [community/transform/](community/transform/) | Example prod → qa JSON patches. Edit before apply |
| [community/restore/](community/restore/) | Example Restore. Edit the backup name and namespace map |
| [community/velero/](community/velero/) | Reminder for the Velero plugin. Not a DataProtectionApplication to apply |

```bash
cd community
./scripts/restore-pre-req.sh
oc apply -f recipe/db2u-parent-recipe.yaml
oc apply -f recipe/db2u-instance-child-recipe.yaml
./scripts/backup-pre-req.sh <DB2U_INSTANCE_NAMESPACE>
```

Then wire a PolicyAssignment at `db2u-parent-recipe` and follow [docs/end-to-end.md](docs/end-to-end.md) for the backup and the cross-namespace restore.

## Out of scope

- `Db2uCluster` recipes
- Backing up the operator, OLM subscriptions, or cluster-scoped objects
- Job hooks and parallel child workflows. Parallel execution only helps when several instances share one Application and every parallel sequence is hooks-only. A volume group forces sequential execution.
- Storage credentials and backup-location secrets

## Further reading

- [IBM Fusion Db2 recipes](https://github.com/IBM/storage-fusion/tree/master/backup-restore/recipes/Db2)
- [Dynamic parent/child recipes](https://community.ibm.com/community/user/blogs/ashish-gupta/2025/06/04/fusion-dynamic-recipe)
- [Undo with `inverseOp`](https://community.ibm.com/community/user/blogs/sandeep-prajapati/2024/04/05/fusion-recipe-tips-how-to-undo-an-operation-in-cas)
- [Make a recipe generic](https://community.ibm.com/community/user/blogs/ashish-gupta/2024/03/25/fusion-recipe-tips-keeping-database-credentials-a)
- [Check hook conditions](https://community.ibm.com/community/user/blogs/sandeep-prajapati/2025/06/12/how-to-write-fusion-recipe-check-hook-condition-st)
- [Label and annotation hooks](https://community.ibm.com/community/user/blogs/sandeep-prajapati/2025/06/12/using-fusion-label-and-annotation-hooks)
- [Resource discovery](https://community.ibm.com/community/user/blogs/sandeep-prajapati/2026/01/11/making-kubernetes-or-openshift-backup-and-restore)
