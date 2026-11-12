# Transforms: a primer

A Transform rewrites resources while Fusion restores them, before they are created on the target. It is what turns a backup of namespace A into a working application in namespace C: different labels, node placement, hosts, storage classes and configuration, from the same backup.

The [upstream samples](https://github.com/IBM/storage-fusion/tree/master/backup-restore/transform) show each patch type once, against placeholder resources. This folder adds what we needed to make one work: when to use which patch, the JSON patch rules that fail quietly, and a tested Db2 restore as the worked example.

IBM reference: [Resource transformation](https://www.ibm.com/docs/en/fusion-software/2.12.0?topic=workflows-resource-transformation).

## Files

| File | What it shows | Tested |
| --- | --- | --- |
| [`../recipes/Db2/db2u-instance-helper/db2u-instance-restore-transform.yaml`](../recipes/Db2/db2u-instance-helper/db2u-instance-restore-transform.yaml) | Db2uInstance prod to dev: affinity, environment label, restored marker | `update-db2uinstance`: yes, Fusion 2.12.2. `update-pvcs`: corrected after testing, not yet re-run |
| [`transform-namespace-promotion.yaml`](transform-namespace-promotion.yaml) | Labels, node placement, route host and a marker for an environment promotion | No |
| [`transform-storage-class-migration.yaml`](transform-storage-class-migration.yaml) | PVCs onto other storage classes, one guarded rule per class | No |
| [`transform-config-and-secrets.yaml`](transform-config-and-secrets.yaml) | Values inside ConfigMap and Secret data with string and merge patches | No |
| [`restore-with-transform.yaml`](restore-with-transform.yaml) | The Restore fields that connect a backup, a namespace mapping and a Transform | No |

"No" means the YAML follows the documented schema but has not been run. Test it on a throwaway restore first.

## Where a Transform fits

```text
Backup (namespace A)
   │
Restore ── namespaceMapping   A → C          moves metadata.namespace
   │   ├── transform          <one CR name>  rewrites everything else
   │   └── transformMapping   ENV: dev ...   fills the variables
   │
Resources created in C
   │
Recipe hooks run (restore workflow)
```

- `namespaceMapping` only changes the namespace. Labels, affinity, hosts and data that name the source environment come back unchanged unless a Transform rewrites them.
- A Restore names **one** Transform. Put every rule that restore needs in that CR.
- The Transform must exist in `ibm-spectrum-fusion-ns` on the **target** cluster, the one doing the restore.

## Anatomy of a rule

```yaml
spec:
  transforms:
    - name: unique-rule-name            # unique in this CR
      json: [...]                       # one patch section: json | mergePatches | strategicPatches | stringPatch
      subject:
        groupResource: deployments.apps # plural.group, core types without a group: configmaps
        resourceNameRegex: ^orders-api$ # optional
        labelSelector: app=orders       # optional
```

Anchor `resourceNameRegex` (`^name$`). An unanchored `api` also matches `orders-api-cache`.

Don't select on a label that another rule rewrites. The order Fusion applies rules in isn't documented. Select on a label no rule touches, such as `app.kubernetes.io/part-of`.

## Choosing a patch type

| Patch | Use it for | Notes |
| --- | --- | --- |
| `json` (RFC 6902) | One precise field: a label, an array element, a scalar | The only type PVCs accept. `test` guards the rule |
| `strategicPatches` | Part of a pod template: `nodeSelector`, one container's image or resources | Matches containers by `name`. Without `name` the array merge is skipped |
| `mergePatches` (RFC 7386) | Whole keys you own, e.g. `data` keys of a ConfigMap | Arrays are replaced, not merged |
| `stringPatch` | Text inside one value: embedded JSON, properties, URLs | No parsing. Make `old` match exactly one place |

## JSON patch rules that bite

These are RFC 6901 and 6902 rules. A mistake doesn't always show as a failed restore. The rule can stop, the resource comes back unchanged, and you only notice later.

1. **Write `/` in a key as `~1`** (and `~` as `~0`). The label `my.cluster/environment` is `/metadata/labels/my.cluster~1environment`. Written as `/metadata/labels/my.cluster/environment`, the path means a label `my.cluster` containing a field `environment`, which doesn't exist.
2. **`replace` and `remove` need the path to exist.** To set a label that may be missing, use `add`.
3. **`add` on a key sets that key. `add` on the map replaces the map.** `add /metadata/labels/backup` adds one label. `add /metadata/labels` with an object drops every label that was there.
4. **`add` needs the parent to exist.** `/metadata/annotations/x` fails on an object with no annotations at all.
5. **A failed `test` stops the whole rule.** IBM documents this, and it's the point: put a `test` first so the rule only rewrites what you expect, for example the label is still `prod` or the array element is still the one you think.
6. **Array indexes are positions.** `.../matchExpressions/0/values/0` is whatever sits first. Guard it with a `test` on the value, or on the `key` beside it.

## Variables

`${NAME}` in a Transform is replaced with `transformMapping.NAME` from the Restore. Quote values in YAML (`'${ENV}'`). Set every variable the Transform uses, because the docs don't say what happens to a missing one. Recipes read dollar-brace text even in comments, so we keep it out of Transform comments too.

## Operator-managed applications: transform the custom resource

With an operator (Db2u, most databases), the StatefulSets, pods and Services are generated from one custom resource. If you patch the generated objects, the operator puts them back the next time it reconciles. Patch the custom resource instead, and check that its recipe restores that resource.

## Worked example: Db2uInstance prod to dev

The tested case is a restore of `db2u-instance` into `db2u-instance-dev`. Full recipe: [recipes/Db2/db2u-instance-helper](../recipes/Db2/db2u-instance-helper/README.md).

The source `Db2uInstance` is labelled and scheduled for prod:

```yaml
metadata:
  labels:
    my.cluster/environment: prod
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
          - matchExpressions:
            - key: my.cluster/environment
              operator: In
              values:
                - prod
```

Restored unchanged into `db2u-instance-dev`, it still says prod. It either schedules onto prod nodes or doesn't schedule at all, and nothing marks it as a copy. The Transform rewrites the custom resource, not the pods:

```yaml
- name: update-db2uinstance
  json:
    - op: replace
      path: /spec/affinity/nodeAffinity/requiredDuringSchedulingIgnoredDuringExecution/nodeSelectorTerms/0/matchExpressions/0/values/0
      value: '${ENV}'
    - op: replace
      path: /metadata/labels/my.cluster~1environment
      value: '${ENV}'
    - op: add
      path: /metadata/labels/backup
      value: restored
  subject:
    groupResource: db2uinstances.db2u.databases.ibm.com
    resourceNameRegex: dwdb
```

The Restore connects it:

```yaml
spec:
  namespaceMapping:
    db2u-bnr-recipe-helper: db2u-bnr-recipe-helper
    db2u-instance: db2u-instance-dev
  transform: db2u-instance-restore-transform
  transformMapping:
    ENV: dev
```

The Transform isn't enough on its own. These have to be in place too:

- Worker nodes labelled `my.cluster/environment=dev`, or the rewritten affinity can't schedule.
- The Db2u operator watching `db2u-instance-dev` (OperatorGroup and `namespace-scope` ConfigMap), or nothing reconciles the restored instance.
- The target Project created before the Restore. The recipe's `set-display-name` hook then names it `DB2U Instance (Restored)`.

To check it worked, `scripts/test-bnr.sh after-restore` reads the `backup` and `my.cluster/environment` labels on the restored instance. Look at the affinity yourself:

```bash
oc get db2uinstance dwdb -n db2u-instance-dev \
  -o jsonpath='{.metadata.labels}{"\n"}{.spec.affinity.nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution.nodeSelectorTerms[0].matchExpressions[0].values}{"\n"}'
```

## Checking a Transform before you depend on it

1. Apply it on the target cluster: `oc apply -f <file>`, then `oc get transform -n ibm-spectrum-fusion-ns`.
2. Restore into a scratch namespace with the real `transformMapping`.
3. Read back every field the Transform should change. A rule that stopped on a failed `test`, or on a path that doesn't exist, leaves the field as it was in the source.
4. Only then use it for a real restore.
