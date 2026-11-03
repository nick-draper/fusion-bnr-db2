# fusion-bnr-db2

IBM Fusion Backup & Restore recipes for **Db2uInstance** when the operator and the database are in different namespaces.

| Path | What it is |
|------|------------|
| [`docs/end-to-end.md`](docs/end-to-end.md) | Deploy, back up, and restore into a new namespace |
| [`community/`](community/) | Generic parent/child recipes, scripts, Transform and Restore examples |
| Repository root YAML | Environment-specific working set (projects, policies, storage). Not the publishable recipe |

Start with the end-to-end guide. Apply objects from `community/`, not from the root `recipe/` directory.
