1-create-bucket

db2u-instance-bucket

2-create-policy

db2u-instance-policy

{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::db2u-instance-bucket"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:DeleteObject",
                "s3:GetObject",
                "s3:PutObject"
            ],
            "Resource": [
                "arn:aws:s3:::db2u-instance-bucket/*"
            ]
        }
    ]
}

3-create-user

db2u-instance-user and assign the above policy

4-create-access-token

generate access token

