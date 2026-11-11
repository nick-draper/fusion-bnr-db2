# operate/ — backup and restore runs

Use this folder when you **run** protection, not when you first wire Fusion.

| File | Role |
|------|------|
| `restore-to-qa.yaml` | Restore CR: `dw-validation` → `dw-validation-qa` using the parent recipe + transform |

There is no checked-in Backup CR. Start backups from the Fusion UI (**Back up now** on the policy assignment) or your platform’s Backup API. The PolicyAssignment in `configure/` keeps `runNow: false` so configure does not fire a backup.

## Before a backup

```bash
./scripts/test-bnr.sh before
```

## After a backup

```bash
./scripts/test-bnr.sh after-backup
# Note the Backup name it prints
```

## Restore into QA

1. Ensure project `dw-validation-qa` exists (`configure/01-namespace-target.yaml`).
2. Set `spec.backup` in `restore-to-qa.yaml` to that Backup name.
3. Apply:

```bash
oc apply -f examples/operate/restore-to-qa.yaml
```

4. Verify:

```bash
./scripts/test-bnr.sh after-restore
```

Then confirm the enterprise license on the restored instance (Velero plugin responsibility).
