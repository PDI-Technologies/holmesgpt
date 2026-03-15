# Production backend config for OpenTofu.
# Usage: cd infra && tofu init -backend-config=envs/backend-prod.hcl
#
# This file is NOT used in CI — the pdi-iac.yaml workflow injects
# backend config via -backend-config flags at init time.
#
# Prerequisites (run once in the prod account):
#   aws s3api create-bucket \
#     --bucket holmesgpt-tfstate-<PROD_ACCOUNT_ID> \
#     --region us-east-1 \
#     --profile pdi-platform-production
#   aws s3api put-bucket-versioning \
#     --bucket holmesgpt-tfstate-<PROD_ACCOUNT_ID> \
#     --versioning-configuration Status=Enabled \
#     --profile pdi-platform-production
#   aws s3api put-bucket-encryption \
#     --bucket holmesgpt-tfstate-<PROD_ACCOUNT_ID> \
#     --server-side-encryption-configuration \
#       '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}' \
#     --profile pdi-platform-production
#
# Then run:
#   cd infra && tofu init -backend-config=envs/backend-prod.hcl

bucket  = "holmesgpt-tfstate-<PROD_ACCOUNT_ID>"   # TODO: replace with prod account ID
key     = "holmesgpt/prod/terraform.tfstate"
region  = "us-east-1"
profile = "pdi-platform-production"
encrypt = true
