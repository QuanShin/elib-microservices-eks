aws_region   = "us-east-1"
project_name = "elib"
environment  = "dev"

vpc_id = "vpc-0deca51e32468582d"

public_subnet_ids = [
  "subnet-00bb33c84650df8c7",
  "subnet-05d0db3d0b72a588a"
]

app_private_subnet_ids = [
  "subnet-036bd2c1974cea3cc",
  "subnet-0ce5d2130ca860460"
]

db_private_subnet_ids = [
  "subnet-077ed47d2a0a06291",
  "subnet-0a92907d75b69dbea"
]

eks_cluster_name         = "elib-eks"
rds_identifier           = "elib-rds"
rds_endpoint             = "elib-rds.ccf0agc26wl5.us-east-1.rds.amazonaws.com"
jenkins_key_name         = "elib-test"
jenkins_allowed_ssh_cidr = "117.5.146.112/32"
jenkins_instance_type    = "t3.medium"