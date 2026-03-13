resource "aws_dynamodb_table" "holmes_config" {
  name         = "${local.cluster_name}-config"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  tags = merge(var.tags, { Name = "${local.cluster_name}-config" })
}
