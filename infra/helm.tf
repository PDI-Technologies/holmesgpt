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
    ANTHROPIC_API_KEY    = var.anthropic_api_key
    ANTHROPIC_API_BASE   = var.anthropic_api_base
    HOLMES_UI_USERNAME   = var.holmes_ui_username
    HOLMES_UI_PASSWORD   = var.holmes_ui_password
    MCP_ADO_API_KEY        = var.mcp_ado_api_key
    MCP_ATLASSIAN_API_KEY  = var.mcp_atlassian_api_key
    MCP_SALESFORCE_API_KEY = var.mcp_salesforce_api_key
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
        "bash" = {
          enabled = true
          config  = { builtin_allowlist = "extended" }
        }
        "runbook"            = { enabled = true }
        "connectivity_check" = { enabled = true }
        "internet"           = { enabled = true }
      }

      mcp_servers = var.mcp_ado_api_key != "" || var.mcp_atlassian_api_key != "" || var.mcp_salesforce_api_key != "" ? merge(
        var.mcp_ado_api_key != "" ? {
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
        var.mcp_atlassian_api_key != "" ? {
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
        var.mcp_salesforce_api_key != "" ? {
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
