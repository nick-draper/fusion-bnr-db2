# Db2u Fusion Backup & Restore — end to end (dw-validation)

Deploy and prove the recipes using the **dw-validation** example pack.

| Namespace | Role |
|-----------|------|
| `dw-validation` | Source — live `Db2uInstance` `dwdb` |
| `dw-validation-qa` | Target — empty project you restore into |
| `db2-operator` | Operator only (not in the Application) |
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

**Backup:** maintenance on → child `instance-backup` → maintenance off  
**Restore to QA:** set-display-name → child `instance-restore` → sleep → maintenance off  

![Parent and child](images/architecture.svg)

---

## 2. Prerequisites

- Fusion Backup & Restore **2.10+**
- Db2u operator in `db2-operator` (parent group `db2-operator`; change `includedNamespaces` if yours differs)
- Db2 **12.1.4+** and `db2u-velero-plugin` on the Fusion DPA ([IBM utility](https://www.ibm.com/docs/en/software-hub/5.4.x?topic=utilities-fusion-backup-restore-utility))
- `oc`, `jq`

```bash
./scripts/restore-pre-req.sh
oc get pods -n db2-operator -l control-plane=db2u-operator-manager
```

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

That applies every file under `examples/configure/` (except the DPA note), both recipes, ClusterRole patch, and `for-backup=true` on `dwdb`.

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

Pass: display name `Db2 Warehouse (QA)`, annotation `db2u.fusion/restored=true`, Ready on QA and source. Then confirm the **enterprise** license on the restored instance yourself.

![Transform](images/transform.svg)

---

## 6. Display name rule

`set-display-name` uppercases the segment after the final `-` on the **target** namespace:

| Target | Display name |
|--------|----------------|
| `dw-validation-qa` | `Db2 Warehouse (QA)` |
| `dw-stg` | `Db2 Warehouse (STG)` |

---

## 7. Failures

![Failure undo](images/failover.svg)

| Symptom | Check |
|---------|--------|
| Operator hook miss | `groups.db2-operator.includedNamespaces`, manager pod label |
| Variables / op command | Only `${GROUP.*}` in commands; shell vars use `$name` |
| Restore permission | `./scripts/restore-pre-req.sh` |
| FormationStatus never OK | Simplify child instance check to Ready-only |
| Ready but license/trial | Velero plugin / Db2 12.1.4+ |

---

## 8. File map

| Path | Role |
|------|------|
| `examples/configure/*` | Required Fusion + Db2 setup for `dw-validation` |
| `examples/operate/restore-to-qa.yaml` | Restore job CR |
| `recipe/db2u-parent-recipe.yaml` | Operator hooks + workflow order |
| `recipe/db2u-instance-child-recipe.yaml` | Volumes, quiesce, readiness |
| `scripts/configure-bnr.sh` | Apply configure + recipes + prereqs |
| `scripts/test-bnr.sh` | `before` / `after-backup` / `after-restore` |
| `scripts/backup-pre-req.sh` | `for-backup=true` |
| `scripts/restore-pre-req.sh` | ClusterRole get/list/patch |
