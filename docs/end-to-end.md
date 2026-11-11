# Db2u Fusion Backup & Restore — end to end (dw-validation)

Deploy and prove the recipes using the **dw-validation** example pack.

| Namespace | Role |
|-----------|------|
| `dw-validation` | Source — live `Db2uInstance` `dwdb` |
| `dw-validation-qa` | Target — empty project you restore into |
| `db2-operator` | Operator only (not in the Application; the recipes never reference it) |
| `ibm-spectrum-fusion-ns` | Recipes, policies, backups, restores |

Layout on disk:

| Path | Purpose |
|------|---------|
| [`examples/configure/`](../examples/configure/) | **Required** Fusion BNR + Db2 configuration (apply once) |
| [`examples/operate/`](../examples/operate/) | **Operational** Restore CR (and how to run backups) |
| [`recipe/`](../recipe/) | Parent + child recipes (portable; not per-environment copies) |
| [`scripts/`](../scripts/) | `configure-bnr.sh`, `test-bnr.sh before\|after-backup\|after-restore` |

---

## 1. What you are deploying

```
PolicyAssignment  (configure/)
  Application       dw-validation only
  BackupPolicy      schedule + retention + storage
  Recipe            db2u-parent-recipe
        |
        +-- discovers db2u-instance-child-recipe (labels)
```

**Backup:** pause instance + engine → child `instance-backup` → unpause  
**Restore to QA:** child `instance-restore-data` → unpause → child `instance-restore-post` (settled → Ready → snapshot restore → Ready → restored marker) → display name  

Pause and unpause are **annotation hooks** on the `Db2uInstance` and `Db2uEngine` (`maintenance-pause-reconcile`), run by Fusion's `transaction-manager` in the instance namespace. No hook runs in `db2-operator`, so a Restore needs no `namespaceMapping` entry for it. A fixed hook namespace there made restore fail with `KeyError: 'db2-operator'`.

The instance is backed up paused, so it comes back paused; restore unpauses it before the readiness checks.

![Parent and child](images/architecture.svg)

---

## 2. Prerequisites

- Fusion Backup & Restore **2.10+**
- Db2u operator installed and Running (any namespace)
- Db2 **12.1.4+** and `db2u-velero-plugin` on the Fusion DPA ([IBM utility](https://www.ibm.com/docs/en/software-hub/5.4.x?topic=utilities-fusion-backup-restore-utility))
- `oc`, `jq`

```bash
./scripts/restore-pre-req.sh
```

Applies [`rbac/transaction-manager-db2u.yaml`](../rbac/transaction-manager-db2u.yaml): `get`, `list`, `patch` on `db2uinstances`, `db2uengines`, and `namespaces` for `transaction-manager` in `ibm-backup-restore`. Every annotation hook runs as that account, so run it on every cluster that **backs up** and every cluster that **restores**. Edit the binding if your Fusion release runs `transaction-manager` elsewhere.

---

## 3. Configure (required application content)

Edit placeholders in:

- `examples/configure/02-db2uinstance.yaml` — license + storage class  
- `examples/configure/03-backup-secret.yaml` — access keys  
- `examples/configure/04-backup-storage-location.yaml` — bucket + endpoint  

Do not commit filled secrets or licenses.

```bash
./scripts/configure-bnr.sh
```

That applies every file under `examples/configure/` (except the DPA note), both recipes, the transaction-manager RBAC, and `for-backup=true` on `dwdb`.

```bash
./scripts/test-bnr.sh before
```

Do not start a backup until this passes.

---

## 4. Operate — backup

Start a backup from the Fusion UI (**Back up now** on `dw-validation-policy-assignment`), or your usual Backup API. Configure keeps `runNow: false`.

```bash
./scripts/test-bnr.sh after-backup
```

Pass: newest Backup phase succeeded; `maintenance-pause-reconcile` cleared on `dw-validation/dwdb`. Note the Backup name for restore.

---

## 5. Operate — restore to QA

Target project must already exist (`configure/01-namespace-target.yaml`).

1. Set `spec.backup` in `examples/operate/restore-to-qa.yaml`.
2. Apply:

```bash
oc apply -f examples/operate/restore-to-qa.yaml
```

3. Watch:

```bash
oc get restore -n ibm-spectrum-fusion-ns
oc get db2uinstance,pods,pvc -n dw-validation-qa -w
```

4. Verify:

```bash
./scripts/test-bnr.sh after-restore
```

Pass: display name `Db2 Warehouse (Restored)`, annotation `db2u.fusion/restored=true`, Ready on QA and source. Then confirm the **enterprise** license on the restored instance yourself.

![Transform](images/transform.svg)

---

## 6. Display name rule

`ns-display-name` is an annotation hook, so it writes fixed text: `Db2 Warehouse (Restored)`. It cannot derive the old per-environment suffix (`dw-validation-qa` → `Db2 Warehouse (QA)`). For a per-environment name, keep it on the target Project manifest (`configure/01-namespace-target.yaml`) or in GitOps, and remove `ns-display-name/set` from the parent `restore` workflow.

The hook selects the namespace by `kubernetes.io/metadata.name` using the GROUP variable. IBM documents variable substitution in hook namespaces and exec commands only; if the name does not change after a restore, the variable was not substituted there. The hook is `onError: continue`, so a miss does not fail the restore.

---

## 7. Failures

![Failure undo](images/failover.svg)

| Symptom | Check |
|---------|--------|
| `KeyError: 'db2-operator'` on restore | A hook still has a fixed namespace outside the Application. Apply the current recipes. |
| Annotation hook `Forbidden` | `./scripts/restore-pre-req.sh` on that cluster; binding subject namespace |
| Restored instance stays paused | `for-backup=true` on the instance; engine labels in `db2u-engine-maint` |
| Variables / op command | Only `${GROUP.*}` in commands; shell vars use `$name`; no dollar-brace text in recipe comments |
| `manage_snapshots` op does not run | Use the JSON-array command form `["/bin/bash", "-c", "..."]` |
| Restore permission | `./scripts/restore-pre-req.sh` |
| `settled` / FormationStatus never OK | CR does not publish it, or it turns OK only after the snapshot restore; change the `settled` condition, simplify `stateReady` to Ready-only |
| Ready but license/trial | Velero plugin / Db2 12.1.4+ |

---

## 8. File map

| Path | Role |
|------|------|
| `examples/configure/*` | Required Fusion + Db2 setup for `dw-validation` |
| `examples/operate/restore-to-qa.yaml` | Restore job CR |
| `recipe/db2u-parent-recipe.yaml` | Maintenance annotation hooks, display name, workflow order |
| `rbac/transaction-manager-db2u.yaml` | ClusterRole + binding for the annotation and check hooks |
| `recipe/db2u-instance-child-recipe.yaml` | Volumes, quiesce, readiness |
| `scripts/configure-bnr.sh` | Apply configure + recipes + prereqs |
| `scripts/test-bnr.sh` | `before` / `after-backup` / `after-restore` |
| `scripts/backup-pre-req.sh` | `for-backup=true` |
| `scripts/restore-pre-req.sh` | Applies and verifies the RBAC (backup and restore clusters) |
