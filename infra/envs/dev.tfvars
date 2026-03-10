# Dev environment - pdi-platform-dev (account 717423812395)

aws_profile = "pdi-platform-dev"
aws_region  = "us-east-1"
environment = "dev"

# Networking - platform_dev_us-east-1_vpc
vpc_id = "vpc-03d8d8f4fb1f915c5"

private_subnet_ids = [
  "subnet-0175f2446e10155c8", # platform-dev-private-services-01-us-east-1a
  "subnet-09fa7974f71f07c2a", # platform-dev-private-services-01-us-east-1b
]

public_subnet_ids = [
  "subnet-08196139ac2b08687", # platform-dev-public-ext01-us-east-1a
  "subnet-00cd06ad109a88780", # platform-dev-public-ext01-us-east-1b
]

# EKS
eks_cluster_version = "1.32"
node_instance_type  = "t3.medium"
node_min_size       = 1
node_max_size       = 2
node_desired_size   = 1

# DNS & TLS
route53_zone_id     = "Z09344573OY2RCX1Q76DP"
route53_zone_name   = "dev.platform.pditechnologies.com"
acm_certificate_arn = "arn:aws:acm:us-east-1:717423812395:certificate/c99bb8a8-6506-487e-a628-5a084c9ef69c"
hostname            = "holmesgpt.dev.platform.pditechnologies.com"

# LLM
anthropic_api_base = "https://ai-gateway.platform.pditechnologies.com"
anthropic_api_key  = "" # Set via TF_VAR_anthropic_api_key or -var flag
holmes_model       = "anthropic/claude-sonnet-4-5-20250929"

# Holmes
holmes_replicas  = 1
holmes_image_tag = "latest"

# UI Auth
holmes_ui_username = "admin"
holmes_ui_password = "HolmesGPT@Dev2026!"

# MCP Integration API Keys
mcp_ado_api_key        = "" # Set via TF_VAR_mcp_ado_api_key or -var flag
mcp_atlassian_api_key  = "" # Set via TF_VAR_mcp_atlassian_api_key or -var flag
mcp_salesforce_api_key = "" # Set via TF_VAR_mcp_salesforce_api_key or -var flag

# Tags
tags = {
  Team        = "platform"
  CostCenter  = "engineering"
  Application = "holmesgpt"
}
