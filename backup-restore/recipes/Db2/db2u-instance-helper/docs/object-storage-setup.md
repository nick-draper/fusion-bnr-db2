# Object storage setup

Step 1 of [end-to-end.md](end-to-end.md). Create a bucket for Fusion backups, a policy limited to that bucket, a user with only that policy, and an access key for the user. The examples use MinIO's `mc` client; any S3-compatible store works if you create the same objects.

| Object | Name in this repository |
| --- | --- |
| Bucket | `db2u-instance-bucket` |
| Policy | `db2u-instance-policy` |
| User | `db2u-instance-user` |

Set an alias for your object store first:

```bash
mc alias set backup https://s3.my.cluster:9200 <admin-user> <admin-password>
```

## 1. Create the bucket

```bash
mc mb backup/db2u-instance-bucket
```

## 2. Create the policy

Save as `db2u-instance-policy.json`. It allows listing the bucket and reading, writing, and deleting its objects, nothing else.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": ["arn:aws:s3:::db2u-instance-bucket"]
    },
    {
      "Effect": "Allow",
      "Action": ["s3:DeleteObject", "s3:GetObject", "s3:PutObject"],
      "Resource": ["arn:aws:s3:::db2u-instance-bucket/*"]
    }
  ]
}
```

```bash
mc admin policy create backup db2u-instance-policy db2u-instance-policy.json
```

## 3. Create the user and attach the policy

```bash
mc admin user add backup db2u-instance-user <password>
mc admin policy attach backup db2u-instance-policy --user db2u-instance-user
```

## 4. Create the access key

```bash
mc admin user svcacct add backup db2u-instance-user
```

Record the access key and secret key. The secret key is shown once.

## Where the values go

| Value | File | Field |
| --- | --- | --- |
| Bucket | [`backup-storage-location.yaml`](../examples/ibm-backup-restore/backup-storage-location/backup-storage-location.yaml) | `spec.params.bucket` |
| Endpoint URL | same | `spec.params.endpoint` |
| Endpoint CA certificate | secret `minio-registry-cert-secret` in `ibm-spectrum-fusion-ns` | `spec.privateCertificateName` |
| Access key | [`secret.yaml`](../examples/ibm-backup-restore/backup-storage-location/secret.yaml) | `stringData.access-key-id` |
| Secret key | same | `stringData.secret-access-key` |

`region` (`us-west-2`) is required by the S3 client; MinIO ignores it. Use your provider's region otherwise.

Never commit `secret.yaml` with real keys.
