resource "aws_secretsmanager_secret" "anthropic_api_key" {
  name                    = "${local.cluster_name}/anthropic-api-key"
  description             = "Anthropic API key for HolmesGPT"
  recovery_window_in_days = var.environment == "dev" ? 0 : 30
}

resource "aws_secretsmanager_secret_version" "anthropic_api_key" {
  secret_id = aws_secretsmanager_secret.anthropic_api_key.id
  secret_string = jsonencode({
    ANTHROPIC_API_KEY  = var.anthropic_api_key
    ANTHROPIC_API_BASE = var.anthropic_api_base
  })
}

# MCP API Keys secret — groups all three MCP keys in one secret
resource "aws_secretsmanager_secret" "mcp_api_keys" {
  name                    = "${local.cluster_name}/mcp-api-keys"
  description             = "API keys for MCP integrations (ADO, Atlassian, Salesforce)"
  recovery_window_in_days = var.environment == "dev" ? 0 : 30
}

resource "aws_secretsmanager_secret_version" "mcp_api_keys" {
  secret_id = aws_secretsmanager_secret.mcp_api_keys.id
  secret_string = jsonencode({
    MCP_ADO_API_KEY        = var.mcp_ado_api_key
    MCP_ATLASSIAN_API_KEY  = var.mcp_atlassian_api_key
    MCP_SALESFORCE_API_KEY = var.mcp_salesforce_api_key
  })
}

# Grafana token secret
resource "aws_secretsmanager_secret" "grafana" {
  name                    = "${local.cluster_name}/grafana"
  description             = "Grafana service account token for HolmesGPT"
  recovery_window_in_days = var.environment == "dev" ? 0 : 30
}

resource "aws_secretsmanager_secret_version" "grafana" {
  secret_id = aws_secretsmanager_secret.grafana.id
  secret_string = jsonencode({
    GRAFANA_API_KEY = var.grafana_api_key
    GRAFANA_URL     = var.grafana_url
  })
}

data "aws_secretsmanager_secret_version" "grafana" {
  secret_id  = aws_secretsmanager_secret.grafana.id
  depends_on = [aws_secretsmanager_secret_version.grafana]
}

# Holmes UI credentials secret
resource "aws_secretsmanager_secret" "holmes_ui_credentials" {
  name                    = "${local.cluster_name}/holmes-ui-credentials"
  description             = "Holmes UI login credentials"
  recovery_window_in_days = var.environment == "dev" ? 0 : 30
}

resource "aws_secretsmanager_secret_version" "holmes_ui_credentials" {
  secret_id = aws_secretsmanager_secret.holmes_ui_credentials.id
  secret_string = jsonencode({
    HOLMES_UI_USERNAME = var.holmes_ui_username
    HOLMES_UI_PASSWORD = var.holmes_ui_password
  })
}

# Data sources to read back secret values at plan/apply time
data "aws_secretsmanager_secret_version" "mcp_api_keys" {
  secret_id  = aws_secretsmanager_secret.mcp_api_keys.id
  depends_on = [aws_secretsmanager_secret_version.mcp_api_keys]
}

data "aws_secretsmanager_secret_version" "holmes_ui_credentials" {
  secret_id  = aws_secretsmanager_secret.holmes_ui_credentials.id
  depends_on = [aws_secretsmanager_secret_version.holmes_ui_credentials]
}

# Datadog secret — created manually in Secrets Manager (holmesgpt-dev/datadog)
data "aws_secretsmanager_secret" "datadog" {
  name = "${local.cluster_name}/datadog"
}

data "aws_secretsmanager_secret_version" "datadog" {
  secret_id = data.aws_secretsmanager_secret.datadog.id
}
