[![IBM Fusion](https://img.shields.io/badge/IBM%20Fusion-tested%202.12.2-0f62fe?logo=ibm&logoColor=white)](https://www.ibm.com/docs/en/fusion-software/2.12.0?topic=recipe-dynamic)
[![Db2uInstance](https://img.shields.io/badge/Db2uInstance-12.1.4%2B-0530ad)](https://github.com/IBM/storage-fusion/tree/master/backup-restore/recipes/Db2)
[![Last commit](https://img.shields.io/github/last-commit/nick-draper/fusion-bnr-db2)](https://github.com/nick-draper/fusion-bnr-db2/commits/main)

# Db2uInstance backup and restore for IBM Fusion

A tested Db2uInstance recipe for IBM Fusion Backup & Restore, offered as an addition to the Db2 recipes in [IBM/storage-fusion](https://github.com/IBM/storage-fusion/tree/master/backup-restore/recipes/Db2).

IBM’s [`db2u-instance-backup-restore-recipe.yaml`](https://github.com/IBM/storage-fusion/blob/master/backup-restore/recipes/Db2/db2u-instance-backup-restore-recipe.yaml) works when the Db2u operator and the instance share a project, and restores into the same namespace. This variant covers the layout most clusters use, with the operator in one project and each instance in its own, and it restores into a different namespace.

- Maintenance mode is set and cleared from a small recipe helper pod, so no hook runs in the operator namespace
- Parent/child dynamic recipe with an allow-list of resource types
- `inverseOp` undo if the snapshot fails after suspend
- Cross-namespace restore with a Transform, `namespaceMapping` and a target display name
- Scripts that check the setup before a backup, after it, and after a restore

## Layout

The folders mirror upstream, so the variant can be dropped into `backup-restore/recipes/Db2/` as it is.

```text
backup-restore/recipes/Db2/db2u-instance-helper/
├── README.md                                  why, how it runs, what changed from the sample
├── db2u-instance-helper-parent-recipe.yaml
├── db2u-instance-helper-child-recipe.yaml
├── db2u-instance-restore-transform.yaml
├── db2u-bnr-recipe-helper/                    helper project, service account, RBAC, deployment
├── scripts/                                   configure, test, pre-req, discovery
├── examples/                                  environment for the worked example
│   ├── db2u-instance/
│   ├── ibm-backup-restore/
│   └── operations/                            Backup and Restore CRs
└── docs/                                      end-to-end runbook, object storage, operations
```

Start with [the variant README](backup-restore/recipes/Db2/db2u-instance-helper/README.md), then [docs/end-to-end.md](backup-restore/recipes/Db2/db2u-instance-helper/docs/end-to-end.md).

## Disclaimer

Provided as is, without warranty, in line with the [IBM/storage-fusion recipes disclaimer](https://github.com/IBM/storage-fusion/tree/master/backup-restore/recipes#disclaimer). Review and test everything in your own environment before you use it in production.
