variable "name" {
  type        = string
  description = "Name prefix for Jenkins resources"
}

variable "aws_region" {
  type        = string
  description = "AWS region"
}

variable "vpc_id" {
  type        = string
  description = "Existing VPC ID"
}

variable "subnet_id" {
  type        = string
  description = "Public subnet ID for Jenkins EC2"
}

variable "instance_type" {
  type        = string
  description = "EC2 instance type for Jenkins"
  default     = "t3.medium"
}

variable "key_name" {
  type        = string
  description = "Existing EC2 key pair name for SSH"
}

variable "allowed_ssh_cidr" {
  type        = string
  description = "CIDR allowed to SSH to Jenkins"
}

variable "root_volume_size" {
  type        = number
  description = "Root EBS volume size in GB"
  default     = 30
}

variable "tags" {
  type        = map(string)
  description = "Common tags"
  default     = {}
}