locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

data "aws_vpc" "existing" {
  id = var.vpc_id
}

data "aws_subnet" "public" {
  for_each = toset(var.public_subnet_ids)
  id       = each.value
}

data "aws_subnet" "app_private" {
  for_each = toset(var.app_private_subnet_ids)
  id       = each.value
}

data "aws_subnet" "db_private" {
  for_each = toset(var.db_private_subnet_ids)
  id       = each.value
}

data "aws_eks_cluster" "existing" {
  name = var.eks_cluster_name
}

data "aws_eks_cluster_auth" "existing" {
  name = var.eks_cluster_name
}

data "aws_db_instance" "existing" {
  db_instance_identifier = var.rds_identifier
}

module "jenkins" {
  source = "../../modules/jenkins"

  name             = "${var.project_name}-${var.environment}-jenkins"
  aws_region       = var.aws_region
  vpc_id           = var.vpc_id
  subnet_id        = var.public_subnet_ids[0]
  instance_type    = var.jenkins_instance_type
  key_name         = var.jenkins_key_name
  allowed_ssh_cidr = var.jenkins_allowed_ssh_cidr

  tags = local.common_tags
}

resource "aws_eks_access_entry" "jenkins" {
  cluster_name  = var.eks_cluster_name
  principal_arn = "arn:aws:iam::884537046542:role/elib-dev-jenkins-role"
  type          = "STANDARD"
}

resource "aws_eks_access_policy_association" "jenkins_cluster_admin" {
  cluster_name  = var.eks_cluster_name
  principal_arn = aws_eks_access_entry.jenkins.principal_arn
  policy_arn    = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"

  access_scope {
    type = "cluster"
  }
}