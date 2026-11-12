# Operations — backup and restore

Step 5 of [end-to-end.md](end-to-end.md). Steps 1–4 must be done and `./scripts/test-bnr.sh before` must pass.

| File | Role |
| --- | --- |
| [`examples/operations/backup.yaml`](../examples/operations/backup.yaml) | On-demand Backup of Application `db2u-instance` with `db2u-instance-backup-policy` |
| [`examples/operations/restore.yaml`](../examples/operations/restore.yaml) | Restore of a `db2u-instance` backup into `db2u-instance-dev`, with the parent recipe and the transform |

The policy also runs a scheduled backup daily at 04:00. The PolicyAssignment keeps `runNow: false`, so applying it does not start one.

## Back up

```bash
./scripts/test-bnr.sh before
```

### From the Fusion UI

1. **Backed up applications**, filter on `db2u-instance`. The recipe column shows `db2u-instance-helper-parent`.

   ![Backed up applications](screenshots/backed-up-applications-summary.png)

2. Open `db2u-instance`, **Backups** tab, then **Actions → Back up now**.

   ![Back up now](screenshots/backup-now-button.png)

3. Confirm the policy and **Back up**.

   ![Back up now dialog](screenshots/backup-now.png)

4. The job moves through pending, checking inventory, and snapshot. The parent pauses the instance and engine first; the child suspends Db2 writes for the volume snapshot and resumes them.

   ![Backup pending](screenshots/backup-pending-application-screen.png)
   ![Checking inventory](screenshots/backup-application-screen.png)
   ![Inventory in the job view](screenshots/backup-checking-inventory.png)
   ![Snapshot in progress](screenshots/backup-snapshot-in-progress.png)

5. Completed:

   ![Backup completed](screenshots/backup-completed-application-screen.png)
   ![Backup job completed](screenshots/backup-completed.png)
   ![End of the job page](screenshots/backup-completed-end-of-page.png)

### From the CLI

Set a unique `metadata.name` in [`examples/operations/backup.yaml`](../examples/operations/backup.yaml) for each run, then:

```bash
oc apply -f examples/operations/backup.yaml
oc get backup -n ibm-spectrum-fusion-ns -w
```

### Check

```bash
./scripts/test-bnr.sh after-backup
```

Passes when the newest Backup succeeded and `maintenance-pause-reconcile` is cleared on every `Db2uInstance` and `Db2uEngine` in `db2u-instance`.

## Restore into another namespace

Before every restore into a new target:

- The target project exists (`examples/db2u-instance/db2u-instance-dev-project.yaml`).
- The target is in the Db2 OperatorGroup and `namespace-scope` ConfigMap ([end-to-end §2.1](end-to-end.md#21-let-the-operator-watch-the-source-and-every-restore-target)).
- Nodes carry `my.cluster/environment=<ENV>` ([§2.2](end-to-end.md#22-label-worker-nodes)).
- The helper is Running on the restoring cluster (`./scripts/configure-recipe-helper.sh`).

1. Copy the backup name from the completed backup job. It has the form `<application>-<policy>-<cluster>-<yyyymmddhhmm>`.

   ![Copy the backup name](screenshots/backup-completed-copy-name.png)

2. Edit [`examples/operations/restore.yaml`](../examples/operations/restore.yaml):

   ```yaml
   metadata:
     name: custom-restore-db2u-instance-<yyyymmdd-hhmm>   # unique per run
   spec:
     backup: <backup name from step 1>
     namespaceMapping:
       db2u-bnr-recipe-helper: db2u-bnr-recipe-helper    # required, see below
       db2u-instance: db2u-instance-dev
     recipe:
       name: db2u-instance-helper-parent
       namespace: ibm-spectrum-fusion-ns
     transform: db2u-instance-restore-transform
     transformMapping:
       ENV: dev                                          # affinity value and environment label
   ```

   The helper line is not optional. The parent's `helper-exec` hooks name that namespace, and Fusion's restore loader fails with `KeyError: 'db2u-bnr-recipe-helper'` if it is not mapped.

3. Apply and watch:

   ```bash
   oc apply -f examples/operations/restore.yaml
   oc get restore -n ibm-spectrum-fusion-ns -w
   oc get db2uinstance,pods,pvc -n db2u-instance-dev -w
   ```

   The restore sets the target display name, restores volumes, resources and the `Db2uInstance`, waits for the engine to be Ready, runs `manage_snapshots --action restore` and `resume`, waits for the instance to be Ready, waits 300 s, then clears maintenance.

   ![Restore pending](screenshots/restore-pending-application-screen.png)
   ![Restore checking inventory](screenshots/restore-checking-inventory-application-screen.png)
   ![Restore snapshot](screenshots/restore-snapshot-in-progress.png)
   ![Restore data transfer](screenshots/restore-data-transfer.png)
   ![Restore recipe in progress](screenshots/restore-recipe-in-progress-application-screen.png)
   ![Restore completed](screenshots/restore-completed-application-screen.png)

4. Check the target:

   ![Restored pods in db2u-instance-dev](screenshots/restored-app-namespace.png)
   ![Restored Db2uInstance](screenshots/restored-app-instance.png)
   ![Restored pod labels: backup=restored, environment=dev](screenshots/restored-app-instance-labels.png)
   ![Restored PVCs](screenshots/restored-app-pvcs.png)

   ```bash
   ./scripts/test-bnr.sh after-restore          # RESTORE_ENV=dev by default
   ```

   Passes when the target display name is `DB2U Instance (Restored)`, the restored `Db2uInstance` has `backup=restored` and `my.cluster/environment=<ENV>`, maintenance is cleared, and both target and source are Ready.

5. Confirm the **enterprise** license on the restored instance yourself. A Ready instance on a trial license means the Velero plugin did not run.

Measure how long the restore takes and set Restore timeouts above it. A timed-out restore has deleted the target namespace in practice; see [README: Slow restores and timeouts](../README.md#slow-restores-and-timeouts).
