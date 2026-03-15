terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }

  # Remote state in S3 — backend config is injected at `tofu init` time via
  # -backend-config flags (see .github/workflows/pdi-iac.yaml and the ship skill).
  # For local development, run:
  #   tofu init -backend-config=envs/backend-dev.hcl
  # where backend-dev.hcl contains (see envs/backend-dev.hcl.example):
  #   bucket  = "holmesgpt-tfstate-<ACCOUNT_ID>"
  #   key     = "holmesgpt/dev/terraform.tfstate"
  #   region  = "us-east-1"
  #   profile = "<AWS_PROFILE>"
  #   encrypt = true
  backend "s3" {}

}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  default_tags {
    tags = merge(var.tags, {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "opentofu"
    })
  }
}

provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      # Always pass --region explicitly so `aws eks get-token` works in CI
      # (env-var credentials have no profile config to derive the region from).
      # When aws_profile is empty (CI uses env-var credentials), omit --profile flag.
      args = var.aws_profile != "" ? [
        "eks", "get-token", "--cluster-name", module.eks.cluster_name,
        "--region", var.aws_region,
        "--profile", var.aws_profile
      ] : [
        "eks", "get-token", "--cluster-name", module.eks.cluster_name,
        "--region", var.aws_region
      ]
    }
  }
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    # Always pass --region explicitly so `aws eks get-token` works in CI
    # (env-var credentials have no profile config to derive the region from).
    # When aws_profile is empty (CI uses env-var credentials), omit --profile flag.
    args = var.aws_profile != "" ? [
      "eks", "get-token", "--cluster-name", module.eks.cluster_name,
      "--region", var.aws_region,
      "--profile", var.aws_profile
    ] : [
      "eks", "get-token", "--cluster-name", module.eks.cluster_name,
      "--region", var.aws_region
    ]
  }
}

locals {
  cluster_name = "${var.project_name}-${var.environment}"
  ecr_repo     = var.project_name
}

data "aws_caller_identity" "current" {}
