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
