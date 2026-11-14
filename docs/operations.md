# Operations — backup and restore

Step 5 of [end-to-end.md](end-to-end.md). Steps 1–4 must be done and every line of [Ready to back up?](end-to-end.md#ready-to-back-up) must pass. The commands use the shell names set in [end-to-end §0](end-to-end.md#0-before-you-start) (`FUSION_NS`, `SOURCE_NS`, `TARGET_NS`, `INSTANCE`, from `build/env.sh`).

| File | Role |
| --- | --- |
| [`ibm-backup-restore/operations/backup.yaml`](../ibm-backup-restore/operations/backup.yaml) | On-demand Backup of Application `db2u-instance` with `db2u-instance-backup-policy` |
| [`ibm-backup-restore/operations/restore.yaml`](../ibm-backup-restore/operations/restore.yaml) | Restore of a `db2u-instance` backup into `db2u-instance-dev`, with the parent recipe and the transform |

The policy also runs a scheduled backup daily at 04:00. The PolicyAssignment keeps `runNow: false`, so applying it does not start one.

## Back up

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

In the rendered copy, `build/ibm-backup-restore/operations/backup.yaml`, set a unique `metadata.name` for each run, then apply it. The namespaces and application are already filled in from `.env`. Running `./scripts/render.sh` again resets this file, so set the name after rendering.

```bash
oc apply -f build/ibm-backup-restore/operations/backup.yaml
oc get backups.data-protection.isf.ibm.com -n "$FUSION_NS" -w
```

### Check

List the backups with their application and phase. The newest `db2u-instance` row should show a completed phase:

```bash
oc get backups.data-protection.isf.ibm.com -n "$FUSION_NS" --sort-by=.metadata.creationTimestamp \
  -o custom-columns=NAME:.metadata.name,APPLICATION:.spec.application,PHASE:.status.phase
```

Then confirm the backup released the database. `PAUSED` must be `<none>` on every row; `true` means maintenance mode is still set:

```bash
oc get db2uinstances.db2u.databases.ibm.com,db2uengines.db2u.databases.ibm.com -n "$SOURCE_NS" \
  -o custom-columns='KIND:.kind,NAME:.metadata.name,PAUSED:.metadata.annotations.db2u\.databases\.ibm\.com/maintenance-pause-reconcile'
```

## Restore into another namespace

Before every restore into a new target:

- The target project exists (`build/db2u-instance/db2u-instance-dev-project.yaml`).
- The target is in the Db2 OperatorGroup and `namespace-scope` ConfigMap ([end-to-end §2.1](end-to-end.md#21-let-the-operator-watch-the-source-and-every-restore-target)).
- Nodes carry `my.cluster/environment=<ENV>` ([§2.2](end-to-end.md#22-label-worker-nodes)).
- The helper is Running on the restoring cluster, and its permission checks pass ([§4](end-to-end.md#4-recipe-helper)).

1. Copy the backup name from the completed backup job. It has the form `<application>-<policy>-<cluster>-<yyyymmddhhmm>`.

   ![Copy the backup name](screenshots/backup-completed-copy-name.png)

2. Edit the rendered copy, `build/ibm-backup-restore/operations/restore.yaml`. The namespaces come from `.env`; set the run's name and backup, and `ENV` if the target is not `dev`. In the example values:

   ```yaml
   metadata:
     name: custom-restore-db2u-instance-<yyyymmdd-hhmm>   # unique per run
   spec:
     backup: <backup name from step 1>
     namespaceMapping:
       recipe-helper: recipe-helper                      # HELPER_NS to itself; required, see below
       db2u-instance: db2u-instance-dev                  # SOURCE_NS to TARGET_NS
     recipe:
       name: db2u-instance-helper-parent
       namespace: ibm-spectrum-fusion-ns
     transform: db2u-instance-restore-transform
     transformMapping:
       ENV: dev                                          # affinity value and environment label
   ```

   The helper line is not optional. The parent's `helper-exec` hooks name that namespace, and Fusion's restore loader fails with `KeyError: 'recipe-helper'` if it is not mapped.

3. Apply and watch:

   ```bash
   oc apply -f build/ibm-backup-restore/operations/restore.yaml
   oc get restores.data-protection.isf.ibm.com -n "$FUSION_NS" -w
   oc get db2uinstances.db2u.databases.ibm.com,pods,pvc -n "$TARGET_NS"
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
   oc get project "$TARGET_NS" -o jsonpath='{.metadata.annotations.openshift\.io/display-name}'; echo
   oc get db2uinstances.db2u.databases.ibm.com "$INSTANCE" -n "$TARGET_NS" -L backup -L my.cluster/environment
   oc get pvc -n "$TARGET_NS" -L backup -L my.cluster/environment
   oc get db2uinstances.db2u.databases.ibm.com,db2uengines.db2u.databases.ibm.com -n "$TARGET_NS" \
     -o custom-columns='KIND:.kind,NAME:.metadata.name,PAUSED:.metadata.annotations.db2u\.databases\.ibm\.com/maintenance-pause-reconcile'
   oc get db2uinstances.db2u.databases.ibm.com "$INSTANCE" -n "$TARGET_NS" -o jsonpath='{.status.state}'; echo
   oc get db2uinstances.db2u.databases.ibm.com "$INSTANCE" -n "$SOURCE_NS" -o jsonpath='{.status.state}'; echo
   ```

   In order, expect: `DB2U Instance (Restored)`; `restored` and `dev` (your `ENV`) on the instance; the same two labels on every PVC; `<none>` under `PAUSED`; `Ready` for the restored instance; and `Ready` for the source, which the restore must not touch.

5. Confirm the **enterprise** license on the restored instance yourself. A Ready instance on a trial license means the Velero plugin did not run.

Measure how long the restore takes and set Restore timeouts above it. A timed-out restore has deleted the target namespace in practice; see [README: Slow restores and timeouts](../README.md#slow-restores-and-timeouts).
