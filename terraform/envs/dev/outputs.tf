output "vpc_id" {
  value = data.aws_vpc.existing.id
}

output "vpc_cidr" {
  value = data.aws_vpc.existing.cidr_block
}

output "public_subnets" {
  value = {
    for k, s in data.aws_subnet.public : k => {
      id                = s.id
      cidr_block        = s.cidr_block
      availability_zone = s.availability_zone
    }
  }
}

output "app_private_subnets" {
  value = {
    for k, s in data.aws_subnet.app_private : k => {
      id                = s.id
      cidr_block        = s.cidr_block
      availability_zone = s.availability_zone
    }
  }
}

output "db_private_subnets" {
  value = {
    for k, s in data.aws_subnet.db_private : k => {
      id                = s.id
      cidr_block        = s.cidr_block
      availability_zone = s.availability_zone
    }
  }
}

output "eks_cluster_name" {
  value = data.aws_eks_cluster.existing.name
}

output "eks_cluster_endpoint" {
  value = data.aws_eks_cluster.existing.endpoint
}

output "eks_cluster_version" {
  value = data.aws_eks_cluster.existing.version
}

output "rds_identifier" {
  value = data.aws_db_instance.existing.db_instance_identifier
}

output "rds_endpoint" {
  value = data.aws_db_instance.existing.address
}

output "rds_engine" {
  value = data.aws_db_instance.existing.engine
}

output "jenkins_instance_id" {
  value = module.jenkins.instance_id
}

output "jenkins_public_ip" {
  value = module.jenkins.public_ip
}

output "jenkins_public_dns" {
  value = module.jenkins.public_dns
}

output "jenkins_url" {
  value = "http://${module.jenkins.public_dns}:8080"
}

output "jenkins_security_group_id" {
  value = module.jenkins.security_group_id
}