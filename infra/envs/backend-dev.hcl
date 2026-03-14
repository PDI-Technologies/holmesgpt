# Local development backend config for OpenTofu.
# Usage: cd infra && tofu init -backend-config=envs/backend-dev.hcl
#
# This file is NOT used in CI — the pdi-iac.yaml workflow injects
# backend config via -backend-config flags at init time.
#
# One-time S3 bucket setup (run once per AWS account):
#   aws s3api create-bucket \
#     --bucket holmesgpt-tfstate-717423812395 \
#     --region us-east-1 \
#     --profile pdi-platform-dev
#   aws s3api put-bucket-versioning \
#     --bucket holmesgpt-tfstate-717423812395 \
#     --versioning-configuration Status=Enabled \
#     --profile pdi-platform-dev
#   aws s3api put-bucket-encryption \
#     --bucket holmesgpt-tfstate-717423812395 \
#     --server-side-encryption-configuration \
#       '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}' \
#     --profile pdi-platform-dev

bucket  = "holmesgpt-tfstate-717423812395"
key     = "holmesgpt/dev/terraform.tfstate"
region  = "us-east-1"
profile = "pdi-platform-dev"
encrypt = true
