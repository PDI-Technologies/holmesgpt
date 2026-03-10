output "cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "EKS cluster API endpoint"
  value       = module.eks.cluster_endpoint
}

output "ecr_repository_url" {
  description = "ECR repository URL for Holmes image"
  value       = aws_ecr_repository.holmesgpt.repository_url
}

output "holmes_url" {
  description = "Holmes application URL"
  value       = "https://${var.hostname}"
}

output "kubeconfig_command" {
  description = "Command to update kubeconfig"
  value       = "aws eks update-kubeconfig --name ${module.eks.cluster_name} --region ${var.aws_region} --profile ${var.aws_profile}"
}

output "ecr_login_command" {
  description = "Command to login to ECR"
  value       = "aws ecr get-login-password --region ${var.aws_region} --profile ${var.aws_profile} | docker login --username AWS --password-stdin ${aws_ecr_repository.holmesgpt.repository_url}"
}

output "docker_push_command" {
  description = "Command to build and push Holmes image"
  value       = "docker build -t ${aws_ecr_repository.holmesgpt.repository_url}:${var.holmes_image_tag} . && docker push ${aws_ecr_repository.holmesgpt.repository_url}:${var.holmes_image_tag}"
}
