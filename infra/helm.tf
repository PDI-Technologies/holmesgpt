# Locals to decode Secrets Manager values for use in this file
locals {
  mcp_keys  = jsondecode(data.aws_secretsmanager_secret_version.mcp_api_keys.secret_string)
  ui_creds  = jsondecode(data.aws_secretsmanager_secret_version.holmes_ui_credentials.secret_string)
  grafana   = jsondecode(data.aws_secretsmanager_secret_version.grafana.secret_string)
  datadog   = jsondecode(data.aws_secretsmanager_secret_version.datadog.secret_string)
}

# Kubernetes namespace for Holmes
resource "kubernetes_namespace" "holmesgpt" {
  metadata {
    name = "holmesgpt"
  }

  depends_on = [module.eks]
}

# Kubernetes secret with API keys from Secrets Manager
resource "kubernetes_secret" "holmes_api_keys" {
  metadata {
    name      = "holmes-api-keys"
    namespace = kubernetes_namespace.holmesgpt.metadata[0].name
  }

  data = {
    ANTHROPIC_API_KEY      = var.anthropic_api_key
    ANTHROPIC_API_BASE     = var.anthropic_api_base
    HOLMES_UI_USERNAME     = local.ui_creds["HOLMES_UI_USERNAME"]
    HOLMES_UI_PASSWORD     = local.ui_creds["HOLMES_UI_PASSWORD"]
    MCP_ADO_API_KEY        = local.mcp_keys["MCP_ADO_API_KEY"]
    MCP_ATLASSIAN_API_KEY  = local.mcp_keys["MCP_ATLASSIAN_API_KEY"]
    MCP_SALESFORCE_API_KEY = local.mcp_keys["MCP_SALESFORCE_API_KEY"]
    GRAFANA_API_KEY        = local.grafana["GRAFANA_API_KEY"]
    GRAFANA_URL            = local.grafana["GRAFANA_URL"]
    DATADOG_API_KEY        = local.datadog["DATADOG_API_KEY"]
    DATADOG_APP_KEY        = local.datadog["DATADOG_APP_KEY"]
    DATADOG_API_URL        = local.datadog["DATADOG_API_URL"]
  }

  type = "Opaque"
}

# Holmes Helm release
resource "helm_release" "holmes" {
  name       = "holmes"
  chart      = "${path.module}/../helm/holmes"
  namespace  = kubernetes_namespace.holmesgpt.metadata[0].name

  values = [
    yamlencode({
      image    = "holmesgpt:${var.holmes_image_tag}"
      registry = split("/", aws_ecr_repository.holmesgpt.repository_url)[0]
      command  = ["python3", "-u", "server_with_frontend.py"]
      imagePullPolicy = "Always"

      replicas = var.holmes_replicas

      createServiceAccount = true
      serviceAccount = {
        annotations = {
          "eks.amazonaws.com/role-arn" = module.holmes_irsa.iam_role_arn
        }
      }

      additionalEnvVars = [
        {
          name = "ANTHROPIC_API_KEY"
          valueFrom = {
            secretKeyRef = {
              name = kubernetes_secret.holmes_api_keys.metadata[0].name
              key  = "ANTHROPIC_API_KEY"
            }
          }
        },
        {
          name = "ANTHROPIC_API_BASE"
          valueFrom = {
            secretKeyRef = {
              name = kubernetes_secret.holmes_api_keys.metadata[0].name
              key  = "ANTHROPIC_API_BASE"
            }
          }
        },
        {
          name  = "MODEL"
          value = var.holmes_model
        },
        {
          name = "HOLMES_UI_USERNAME"
          valueFrom = {
            secretKeyRef = {
              name = kubernetes_secret.holmes_api_keys.metadata[0].name
              key  = "HOLMES_UI_USERNAME"
            }
          }
        },
        {
          name = "HOLMES_UI_PASSWORD"
          valueFrom = {
            secretKeyRef = {
              name = kubernetes_secret.holmes_api_keys.metadata[0].name
              key  = "HOLMES_UI_PASSWORD"
            }
          }
        },
        {
          name = "MCP_ADO_API_KEY"
          valueFrom = {
            secretKeyRef = {
              name = kubernetes_secret.holmes_api_keys.metadata[0].name
              key  = "MCP_ADO_API_KEY"
            }
          }
        },
        {
          name = "MCP_ATLASSIAN_API_KEY"
          valueFrom = {
            secretKeyRef = {
              name = kubernetes_secret.holmes_api_keys.metadata[0].name
              key  = "MCP_ATLASSIAN_API_KEY"
            }
          }
        },
        {
          name = "MCP_SALESFORCE_API_KEY"
          valueFrom = {
            secretKeyRef = {
              name = kubernetes_secret.holmes_api_keys.metadata[0].name
              key  = "MCP_SALESFORCE_API_KEY"
            }
          }
        },
        {
          name = "GRAFANA_API_KEY"
          valueFrom = {
            secretKeyRef = {
              name = kubernetes_secret.holmes_api_keys.metadata[0].name
              key  = "GRAFANA_API_KEY"
            }
          }
        },
        {
          name = "GRAFANA_URL"
          valueFrom = {
            secretKeyRef = {
              name = kubernetes_secret.holmes_api_keys.metadata[0].name
              key  = "GRAFANA_URL"
            }
          }
        },
        {
          name = "DATADOG_API_KEY"
          valueFrom = {
            secretKeyRef = {
              name = kubernetes_secret.holmes_api_keys.metadata[0].name
              key  = "DATADOG_API_KEY"
            }
          }
        },
        {
          name = "DATADOG_APP_KEY"
          valueFrom = {
            secretKeyRef = {
              name = kubernetes_secret.holmes_api_keys.metadata[0].name
              key  = "DATADOG_APP_KEY"
            }
          }
        },
        {
          name = "DATADOG_API_URL"
          valueFrom = {
            secretKeyRef = {
              name = kubernetes_secret.holmes_api_keys.metadata[0].name
              key  = "DATADOG_API_URL"
            }
          }
        },
        {
          name  = "AWS_MCP_ACCOUNTS"
          value = jsonencode([
            for name, cfg in var.logistics_accounts : {
              name       = name
              account_id = cfg.account_id
              region     = cfg.region
              role_arn   = cfg.role_arn
            }
          ])
        },
        {
          name  = "AWS_MCP_IRSA_ROLE"
          value = var.aws_mcp_enabled ? module.aws_mcp_irsa[0].iam_role_arn : ""
        },
        {
          name  = "HOLMES_DYNAMODB_TABLE"
          value = aws_dynamodb_table.holmes_config.name
        }
      ]

      resources = {
        requests = {
          cpu    = "100m"
          memory = "2048Mi"
        }
        limits = {
          memory = "2048Mi"
        }
      }

      toolsets = {
        "kubernetes/core" = { enabled = true }
        "kubernetes/logs" = { enabled = true }
        "prometheus/metrics" = { enabled = true }
        "grafana/dashboards" = {
          enabled = true
          config  = {
            api_url = "{{ env.GRAFANA_URL }}"
            api_key = "{{ env.GRAFANA_API_KEY }}"
          }
        }
        "datadog/metrics" = {
          enabled = true
          config  = {
            api_url = "{{ env.DATADOG_API_URL }}"
            api_key = "{{ env.DATADOG_API_KEY }}"
            app_key = "{{ env.DATADOG_APP_KEY }}"
          }
        }
        "datadog/logs" = {
          enabled = true
          config  = {
            api_url = "{{ env.DATADOG_API_URL }}"
            api_key = "{{ env.DATADOG_API_KEY }}"
            app_key = "{{ env.DATADOG_APP_KEY }}"
          }
        }
        "datadog/monitors" = {
          enabled = true
          config  = {
            api_url = "{{ env.DATADOG_API_URL }}"
            api_key = "{{ env.DATADOG_API_KEY }}"
            app_key = "{{ env.DATADOG_APP_KEY }}"
          }
        }
        "datadog/events" = {
          enabled = true
          config  = {
            api_url = "{{ env.DATADOG_API_URL }}"
            api_key = "{{ env.DATADOG_API_KEY }}"
            app_key = "{{ env.DATADOG_APP_KEY }}"
          }
        }
        "datadog/general" = {
          enabled = true
          config  = {
            api_url = "{{ env.DATADOG_API_URL }}"
            api_key = "{{ env.DATADOG_API_KEY }}"
            app_key = "{{ env.DATADOG_APP_KEY }}"
          }
        }
        "datadog/traces" = {
          enabled = true
          config  = {
            api_url = "{{ env.DATADOG_API_URL }}"
            api_key = "{{ env.DATADOG_API_KEY }}"
            app_key = "{{ env.DATADOG_APP_KEY }}"
          }
        }
        "bash" = {
          enabled = true
          config  = { builtin_allowlist = "extended" }
        }
        "runbook"            = { enabled = true }
        "connectivity_check" = { enabled = true }
        "internet"           = { enabled = true }
      }

      mcp_servers = local.mcp_keys["MCP_ADO_API_KEY"] != "" || local.mcp_keys["MCP_ATLASSIAN_API_KEY"] != "" || local.mcp_keys["MCP_SALESFORCE_API_KEY"] != "" ? merge(
        local.mcp_keys["MCP_ADO_API_KEY"] != "" ? {
          ado = {
            description = "Azure DevOps - work items, repositories, pipelines, and boards"
            config = {
              url  = "https://mcp-api.platform.pditechnologies.com/v1/ado-sse/mcp"
              mode = "streamable-http"
              headers = {
                "x-api-key" = "{{ env.MCP_ADO_API_KEY }}"
              }
              icon_url = "https://cdn.simpleicons.org/azuredevops/0078D7"
            }
            llm_instructions = "Use this toolset to query Azure DevOps work items, pull requests, repositories, pipelines, and boards. Prefer WIQL queries for work item searches."
          }
        } : {},
        local.mcp_keys["MCP_ATLASSIAN_API_KEY"] != "" ? {
          atlassian = {
            description = "Atlassian - Jira issues, Confluence pages, and project boards"
            config = {
              url  = "https://mcp-api.platform.pditechnologies.com/v1/atlassian-sse/mcp"
              mode = "streamable-http"
              headers = {
                "x-api-key" = "{{ env.MCP_ATLASSIAN_API_KEY }}"
              }
              icon_url = "https://cdn.simpleicons.org/atlassian/0052CC"
            }
            llm_instructions = "Use this toolset to search and retrieve Jira issues, Confluence pages, and Atlassian project information. Prefer JQL for Jira queries."
          }
        } : {},
        local.mcp_keys["MCP_SALESFORCE_API_KEY"] != "" ? {
          salesforce = {
            description = "Salesforce - accounts, contacts, opportunities, cases, and CRM data"
            config = {
              url  = "https://mcp-api.platform.pditechnologies.com/v1/salesforce-sse/mcp"
              mode = "streamable-http"
              headers = {
                "x-api-key" = "{{ env.MCP_SALESFORCE_API_KEY }}"
              }
              icon_url = "https://cdn.simpleicons.org/salesforce/00A1E0"
            }
            llm_instructions = "Use this toolset to query Salesforce CRM data including accounts, contacts, opportunities, cases, and custom objects. Prefer SOQL queries for data retrieval."
          }
        } : {}
      ) : {}

      mcpAddons = {
        aws = {
          enabled = var.aws_mcp_enabled
          serviceAccount = {
            create = true
            name   = "aws-api-mcp-sa"
            annotations = {
              "eks.amazonaws.com/role-arn" = var.aws_mcp_enabled ? module.aws_mcp_irsa[0].iam_role_arn : ""
            }
          }
          config = {
            region       = var.aws_region
            readOnlyMode = true
          }
          multiAccount = {
            enabled  = length(var.logistics_accounts) > 0
            profiles = {
              for name, cfg in var.logistics_accounts : name => {
                account_id = cfg.account_id
                role_arn   = cfg.role_arn
                region     = cfg.region
              }
            }
            llm_account_descriptions = join("\n", concat(
              [
                "ALWAYS use --profile <account-name> in every AWS CLI command to target the correct account.",
                "NEVER run AWS commands without --profile — the default profile is the platform account, not a logistics account.",
                "When the user mentions a specific account, use --profile <that-account-name>.",
                "When the user says 'all accounts', run the command once per account with the appropriate --profile.",
                "Example: aws ec2 describe-instances --region us-east-1 --profile logistics-prod",
                "",
                "IMPORTANT: Each account has a primary region listed below. If a query returns empty results in that region,",
                "scan other regions (us-east-1, us-east-2, eu-west-1, eu-central-1, ap-southeast-1, etc.) before concluding",
                "there are no resources. Workloads may be deployed in regions other than the primary.",
                "",
                "Available accounts (use exact profile name):",
              ],
              [
                for name, cfg in var.logistics_accounts :
                "  --profile ${name}  →  account ${cfg.account_id} (primary region: ${cfg.region})"
              ]
            ))
          }
        }
      }
    })
  ]

  depends_on = [
    helm_release.alb_controller,
    kubernetes_secret.holmes_api_keys,
  ]
}

# Ingress for Holmes via ALB
resource "kubernetes_ingress_v1" "holmes" {
  metadata {
    name      = "holmes-ingress"
    namespace = kubernetes_namespace.holmesgpt.metadata[0].name
    annotations = {
      "kubernetes.io/ingress.class"                    = "alb"
      "alb.ingress.kubernetes.io/scheme"               = "internet-facing"
      "alb.ingress.kubernetes.io/target-type"           = "ip"
      "alb.ingress.kubernetes.io/certificate-arn"       = var.acm_certificate_arn
      "alb.ingress.kubernetes.io/listen-ports"          = jsonencode([{ HTTPS = 443 }])
      "alb.ingress.kubernetes.io/ssl-redirect"          = "443"
      "alb.ingress.kubernetes.io/subnets"               = join(",", var.public_subnet_ids)
      "alb.ingress.kubernetes.io/healthcheck-path"      = "/healthz"
      "alb.ingress.kubernetes.io/healthcheck-interval-seconds" = "30"
      "alb.ingress.kubernetes.io/load-balancer-attributes" = "idle_timeout.timeout_seconds=300"
    }
  }

  spec {
    rule {
      host = var.hostname
      http {
        path {
          path      = "/"
          path_type = "Prefix"
          backend {
            service {
              name = "holmes-holmes"
              port {
                number = 80
              }
            }
          }
        }
      }
    }
  }

  depends_on = [helm_release.alb_controller, helm_release.holmes]
}

# Route53 record pointing to ALB
resource "aws_route53_record" "holmes" {
  zone_id = var.route53_zone_id
  name    = var.hostname
  type    = "CNAME"
  ttl     = 300
  records = [kubernetes_ingress_v1.holmes.status[0].load_balancer[0].ingress[0].hostname]

  depends_on = [kubernetes_ingress_v1.holmes]
}
