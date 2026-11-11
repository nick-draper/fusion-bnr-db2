# configure/ — required Fusion BNR application setup

Apply these **once** (after editing placeholders) so Fusion can protect `dw-validation`.

These are not one-off jobs. They are the durable configuration for the application:

| File | Role |
|------|------|
| `00-namespace-source.yaml` | Project `dw-validation` (source instance) |
| `01-namespace-target.yaml` | Project `dw-validation-qa` (restore target; create before restore) |
| `02-db2uinstance.yaml` | Sample `Db2uInstance` `dwdb` — replace license + storage class |
| `03-backup-secret.yaml` | Object-storage credentials for the BackupStorageLocation |
| `04-backup-storage-location.yaml` | S3-compatible backup target |
| `05-backup-policy.yaml` | Schedule + retention |
| `06-application.yaml` | Fusion Application — **instance namespace only** (never `db2-operator`) |
| `07-policy-assignment.yaml` | Ties Application + policy + **parent** recipe (`runNow: false`) |
| `08-transform.yaml` | JSON patches for cross-namespace restore (affinity / labels → qa) |
| `dpa-db2u-velero-plugin.note.yaml` | Reminder only — do **not** apply; install the plugin per IBM docs |

Also required (applied by `scripts/configure-bnr.sh`, not duplicated here):

- `recipe/db2u-parent-recipe.yaml`
- `recipe/db2u-instance-child-recipe.yaml`
- `scripts/restore-pre-req.sh` (transaction-manager RBAC)
- `scripts/backup-pre-req.sh dw-validation` (`for-backup=true`)

Prefer `./scripts/configure-bnr.sh` from the repo root over applying files by hand.
