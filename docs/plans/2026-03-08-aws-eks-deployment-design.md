# HolmesGPT AWS EKS Deployment Design

## Overview

Deploy HolmesGPT to AWS using EKS with managed node groups, using OpenTofu for infrastructure-as-code. Supports dev and prod environments via separate tfvars files.

## Architecture

```
Internet -> Route53 -> ALB (HTTPS, ACM cert) -> EKS Cluster -> Holmes Pod(s)
                                                    |
                                          Secrets Manager (API keys)
                                                    |
                                          ECR (container image)
```

## AWS Resources

| Resource | Details |
|----------|---------|
| EKS Cluster | v1.32, private API endpoint |
| Managed Node Group | t3.medium, min 1 / max 3 |
| ECR | Private repo `holmesgpt` |
| IAM (IRSA) | Service account role for Secrets Manager read |
| Secrets Manager | ANTHROPIC_API_KEY, ANTHROPIC_API_BASE |
| Route53 | holmesgpt.{env}.platform.pditechnologies.com |
| ACM | Existing wildcard certs |
| ALB | AWS Load Balancer Controller, HTTPS termination |

## Environment Configuration

### Dev (pdi-platform-dev, account 717423812395)

- VPC: `vpc-03d8d8f4fb1f915c5` (platform_dev_us-east-1_vpc, 10.167.0.0/21)
- Private subnets (nodes): services-01-a/b
- Public subnets (ALB): ext01-a/b
- Route53 zone: dev.platform.pditechnologies.com (Z09344573OY2RCX1Q76DP)
- ACM: *.dev.platform.pditechnologies.com (c99bb8a8-6506-487e-a628-5a084c9ef69c)
- Node group: 1x t3.medium (min 1, max 2)
- LLM: PDI AI Gateway (ai-gateway.platform.pditechnologies.com)

### Prod (placeholder, to be filled)

- VPC: TBD
- Subnets: TBD
- Route53 zone: TBD
- ACM: TBD
- Node group: 2x t3.medium (min 2, max 5)
- LLM: PDI AI Gateway

## File Structure

```
infra/
  main.tf              # Provider, backend, data sources
  eks.tf               # EKS cluster + managed node group
  ecr.tf               # ECR repository
  iam.tf               # IRSA roles for Holmes SA
  secrets.tf           # Secrets Manager for API keys
  alb.tf               # AWS LB Controller Helm + Ingress config
  helm.tf              # Holmes Helm release
  variables.tf         # Input variable definitions
  outputs.tf           # Cluster endpoint, ECR URL, DNS
  envs/
    dev.tfvars         # Dev environment values
    prod.tfvars        # Prod environment values (placeholder)
```

## Deployment Flow

1. `tofu init`
2. `tofu plan -var-file=envs/dev.tfvars`
3. `tofu apply -var-file=envs/dev.tfvars`
4. Build and push Docker image to ECR
5. Holmes Helm chart deployed automatically via OpenTofu Helm provider

## Key Decisions

- **OpenTofu** over Terraform (open-source, compatible)
- **Managed Node Group** over Fargate (simpler, cheaper for always-on workload)
- **IRSA** for pod-level IAM (no node-level credentials)
- **Secrets Manager** over SSM Parameter Store (rotation support, IRSA integration)
- **Existing VPC/subnets/ACM/Route53** (no new networking resources)
- **AWS LB Controller** for ALB ingress (native EKS integration)
