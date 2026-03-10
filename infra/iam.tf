# IRSA role for Holmes pods - allows reading secrets from Secrets Manager
module "holmes_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name = "${local.cluster_name}-holmes"

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["holmesgpt:holmesgpt"]
    }
  }

  role_policy_arns = {
    secrets = aws_iam_policy.holmes_secrets.arn
  }
}

resource "aws_iam_policy" "holmes_secrets" {
  name        = "${local.cluster_name}-holmes-secrets"
  description = "Allow Holmes to read API keys from Secrets Manager"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          aws_secretsmanager_secret.anthropic_api_key.arn
        ]
      }
    ]
  })
}

# IRSA role for AWS Load Balancer Controller
module "alb_controller_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name = "${local.cluster_name}-alb-controller"

  attach_load_balancer_controller_policy = true

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:aws-load-balancer-controller"]
    }
  }
}
