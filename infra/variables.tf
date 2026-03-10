variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "AWS CLI profile name"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, prod)"
  type        = string
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "holmesgpt"
}

# Networking
variable "vpc_id" {
  description = "Existing VPC ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for EKS nodes"
  type        = list(string)
}

variable "public_subnet_ids" {
  description = "Public subnet IDs for ALB"
  type        = list(string)
}

# EKS
variable "eks_cluster_version" {
  description = "EKS Kubernetes version"
  type        = string
  default     = "1.32"
}

variable "node_instance_type" {
  description = "EC2 instance type for EKS managed node group"
  type        = string
  default     = "t3.medium"
}

variable "node_min_size" {
  description = "Minimum number of nodes"
  type        = number
  default     = 1
}

variable "node_max_size" {
  description = "Maximum number of nodes"
  type        = number
  default     = 3
}

variable "node_desired_size" {
  description = "Desired number of nodes"
  type        = number
  default     = 1
}

# DNS & TLS
variable "route53_zone_id" {
  description = "Route53 hosted zone ID"
  type        = string
}

variable "route53_zone_name" {
  description = "Route53 hosted zone domain name"
  type        = string
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for HTTPS"
  type        = string
}

variable "hostname" {
  description = "Hostname for Holmes (e.g., holmesgpt.dev.platform.pditechnologies.com)"
  type        = string
}

# LLM Configuration
variable "anthropic_api_base" {
  description = "Anthropic API base URL"
  type        = string
  default     = "https://ai-gateway.platform.pditechnologies.com"
}

variable "anthropic_api_key" {
  description = "Anthropic API key (stored in Secrets Manager)"
  type        = string
  sensitive   = true
}

variable "holmes_model" {
  description = "LLM model to use"
  type        = string
  default     = "anthropic/claude-sonnet-4-5-20250929"
}

# Holmes
variable "holmes_replicas" {
  description = "Number of Holmes replicas"
  type        = number
  default     = 1
}

variable "holmes_image_tag" {
  description = "Holmes container image tag"
  type        = string
  default     = "latest"
}

# UI Authentication
variable "holmes_ui_username" {
  description = "Username for Holmes UI login"
  type        = string
  default     = "admin"
}

variable "holmes_ui_password" {
  description = "Password for Holmes UI login"
  type        = string
  sensitive   = true
}

# MCP Integration API Keys
variable "mcp_ado_api_key" {
  description = "API key for Azure DevOps MCP server"
  type        = string
  sensitive   = true
  default     = ""
}

variable "mcp_atlassian_api_key" {
  description = "API key for Atlassian MCP server"
  type        = string
  sensitive   = true
  default     = ""
}

variable "mcp_salesforce_api_key" {
  description = "API key for Salesforce MCP server"
  type        = string
  sensitive   = true
  default     = ""
}

# Tags
variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}
