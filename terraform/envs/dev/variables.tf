variable "aws_region" {
  type        = string
  description = "AWS region"
}

variable "project_name" {
  type        = string
  description = "Project name"
}

variable "environment" {
  type        = string
  description = "Environment name"
}

variable "vpc_id" {
  type        = string
  description = "Existing VPC ID"
}

variable "public_subnet_ids" {
  type        = list(string)
  description = "Existing public subnet IDs"
}

variable "app_private_subnet_ids" {
  type        = list(string)
  description = "Existing app private subnet IDs"
}

variable "db_private_subnet_ids" {
  type        = list(string)
  description = "Existing DB private subnet IDs"
}

variable "eks_cluster_name" {
  type        = string
  description = "Existing EKS cluster name"
}

variable "rds_identifier" {
  type        = string
  description = "Existing RDS instance identifier"
}

variable "rds_endpoint" {
  type        = string
  description = "Existing RDS endpoint"
}

variable "jenkins_key_name" {
  type        = string
  description = "Existing EC2 key pair name for Jenkins SSH"
}

variable "jenkins_allowed_ssh_cidr" {
  type        = string
  description = "CIDR allowed to SSH to Jenkins"
}

variable "jenkins_instance_type" {
  type        = string
  description = "Jenkins EC2 instance type"
  default     = "t3.medium"
}