# dw-validation example pack

Worked example for protecting a **Db2uInstance** in namespace `dw-validation` and restoring it into `dw-validation-qa`.

| Folder | When you use it | What it is |
|--------|-----------------|------------|
| [`configure/`](configure/) | Once, before any backup | **Required** OpenShift + Fusion BNR objects for this application |
| [`operate/`](operate/) | Each backup / restore run | **Operational** Backup/Restore CRs (and how to start them) |

Recipes stay in [`../recipe/`](../recipe/) — apply those with configure; do not copy them per environment.

```
configure/   →  Foundation (projects, instance, storage, policy, app, assignment, transform)
operate/     →  Run a backup, run a restore
scripts/     →  verify-before / verify-after-backup / verify-after-restore
```

## Order for a Db2 user

1. Fill every `REPLACE_WITH_` in `configure/` (secret, storage location, instance license + storage class).
2. `./scripts/configure-bnr.sh` — applies `configure/`, both recipes, ClusterRole + `for-backup` label.
3. `./scripts/test-bnr.sh before` — must pass before the first backup.
4. Start a backup (Fusion UI **Back up now**, or see `operate/README.md`).
5. `./scripts/test-bnr.sh after-backup`
6. Edit `operate/restore-to-qa.yaml` with the Backup name, then apply it.
7. `./scripts/test-bnr.sh after-restore` — then confirm the enterprise license yourself.

Full narrative: [`../docs/end-to-end.md`](../docs/end-to-end.md).
