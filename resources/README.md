# resources/

Manifests for protecting the `Db2uInstance` `dwdb` in `db2u-instance` and restoring it into `db2u-instance-dev`, in apply order. The step numbers match [`../docs/end-to-end.md`](../docs/end-to-end.md); step 1 (object storage) has no manifests, and step 5 uses [`../operations/`](../operations/).

`./scripts/configure-bnr.sh` applies steps 2–4 after checking placeholders and the manual prerequisites.

## 2. Db2 operator, projects and instance — [`db2u-instance/`](db2u-instance/)

| File | Notes |
| --- | --- |
| [`config/db2-operator-group.yaml`](db2u-instance/config/db2-operator-group.yaml) | Target state only. **Edit** the existing OperatorGroup in `db2-operator`; never apply a second one |
| [`config/namespace-scope-configmap.yaml`](db2u-instance/config/namespace-scope-configmap.yaml) | Namespaces the operator watches. Add every restore target |
| [`db2u-instance-project.yaml`](db2u-instance/db2u-instance-project.yaml) | Source project |
| [`db2u-instance-dev-project.yaml`](db2u-instance/db2u-instance-dev-project.yaml) | Restore target project. Create before restoring |
| [`db2u-instance.yaml`](db2u-instance/db2u-instance.yaml) | **Placeholders:** `<Insert License>`, `<storage-class>`. Carries `for-backup: 'true'` |

## 3. Fusion Backup & Restore — [`ibm-backup-restore/`](ibm-backup-restore/)

| File | Notes |
| --- | --- |
| [`config/dpa-db2u-velero-plugin.note.yaml`](ibm-backup-restore/config/dpa-db2u-velero-plugin.note.yaml) | Note only, do not apply. Install `db2u-velero-plugin` with IBM's utility |
| [`backup-storage-location/secret.yaml`](ibm-backup-restore/backup-storage-location/secret.yaml) | **Placeholders:** `<access-key-id>`, `<secret-access-key>`. Never commit filled |
| [`backup-storage-location/backup-storage-location.yaml`](ibm-backup-restore/backup-storage-location/backup-storage-location.yaml) | Bucket and endpoint. Needs CA secret `minio-registry-cert-secret` |
| [`backup-storage-location/backup-policy.yaml`](ibm-backup-restore/backup-storage-location/backup-policy.yaml) | Daily 04:00, 5 days retention |
| [`recipe/db2u-instance-helper-parent-recipe.yaml`](ibm-backup-restore/recipe/db2u-instance-helper-parent-recipe.yaml) | Maintenance mode via the helper, display name, workflow order |
| [`recipe/db2u-instance-helper-child-recipe.yaml`](ibm-backup-restore/recipe/db2u-instance-helper-child-recipe.yaml) | Volumes, configmaps, secrets, `Db2uInstance`, `manage_snapshots`, readiness |
| [`recipe/transform.yaml`](ibm-backup-restore/recipe/transform.yaml) | Rewrites affinity and `my.cluster/environment` to `${ENV}`, adds `backup=restored` |
| [`recipe/policy-assignment.yaml`](ibm-backup-restore/recipe/policy-assignment.yaml) | Application `db2u-instance` + policy + parent recipe. Apply before the first backup |

## 4. Recipe helper — [`db2u-bnr-recipe-helper/`](db2u-bnr-recipe-helper/)

Apply with `./scripts/configure-recipe-helper.sh` on every cluster that backs up or restores.

| File | Notes |
| --- | --- |
| [`project.yaml`](db2u-bnr-recipe-helper/project.yaml) | Pod Security `restricted` |
| [`service-account.yaml`](db2u-bnr-recipe-helper/service-account.yaml) | Identity the hook `curl` calls use |
| [`cluster-role.yaml`](db2u-bnr-recipe-helper/cluster-role.yaml) | Db2u instances/engines, namespaces |
| [`cluster-role-binding.yaml`](db2u-bnr-recipe-helper/cluster-role-binding.yaml) | Binds the role to the service account |
| [`deployment.yaml`](db2u-bnr-recipe-helper/deployment.yaml) | **Set `image`** to your mirrored UBI 9 minimal (needs `curl`) |

Every Restore maps `db2u-bnr-recipe-helper: db2u-bnr-recipe-helper` in `namespaceMapping`; the parent's hooks name that namespace.
