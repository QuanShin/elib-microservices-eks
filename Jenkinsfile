pipeline {
  agent any

  environment {
    AWS_REGION   = 'us-east-1'
    AWS_ACCOUNT  = '884537046542'
    ECR_REGISTRY = "${AWS_ACCOUNT}.dkr.ecr.${AWS_REGION}.amazonaws.com"
    KUBECONFIG   = '/var/lib/jenkins/.kube/config'
    BUILD_TAG_ID = "${env.BUILD_NUMBER}"
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Verify Tools') {
      steps {
        sh '''
          set -e
          aws --version
          docker --version
          kubectl version --client
          helm version
        '''
      }
    }

    stage('ECR Login') {
      steps {
        sh '''
          set -e
          aws ecr get-login-password --region $AWS_REGION \
          | docker login --username AWS --password-stdin $ECR_REGISTRY
        '''
      }
    }

    stage('Build Auth Image') {
      steps {
        sh '''
          set -e
          docker build -t $ECR_REGISTRY/elib-auth:$BUILD_TAG_ID -f ./AuthService/Dockerfile .
          docker tag $ECR_REGISTRY/elib-auth:$BUILD_TAG_ID $ECR_REGISTRY/elib-auth:latest
        '''
      }
    }

    stage('Build Catalog Image') {
      steps {
        sh '''
          set -e
          docker build -t $ECR_REGISTRY/elib-catalog:$BUILD_TAG_ID -f ./CatalogService/Dockerfile .
          docker tag $ECR_REGISTRY/elib-catalog:$BUILD_TAG_ID $ECR_REGISTRY/elib-catalog:latest
        '''
      }
    }

    stage('Build Borrow Image') {
      steps {
        sh '''
          set -e
          docker build -t $ECR_REGISTRY/elib-borrow:$BUILD_TAG_ID -f ./BorrowService/Dockerfile .
          docker tag $ECR_REGISTRY/elib-borrow:$BUILD_TAG_ID $ECR_REGISTRY/elib-borrow:latest
        '''
      }
    }

    stage('Build Web Image') {
      steps {
        sh '''
          set -e
          docker build -t $ECR_REGISTRY/elib-web:$BUILD_TAG_ID -f ./elib-web/Dockerfile ./elib-web
          docker tag $ECR_REGISTRY/elib-web:$BUILD_TAG_ID $ECR_REGISTRY/elib-web:latest
        '''
      }
    }

    stage('Push Images') {
      steps {
        sh '''
          set -e
          docker push $ECR_REGISTRY/elib-auth:$BUILD_TAG_ID
          docker push $ECR_REGISTRY/elib-auth:latest

          docker push $ECR_REGISTRY/elib-catalog:$BUILD_TAG_ID
          docker push $ECR_REGISTRY/elib-catalog:latest

          docker push $ECR_REGISTRY/elib-borrow:$BUILD_TAG_ID
          docker push $ECR_REGISTRY/elib-borrow:latest

          docker push $ECR_REGISTRY/elib-web:$BUILD_TAG_ID
          docker push $ECR_REGISTRY/elib-web:latest
        '''
      }
    }

    stage('Deploy to EKS') {
      steps {
        sh '''
          set -e
          helm upgrade --install elib ./elib-chart \
            -n elib \
            -f ./elib-chart/values.yaml \
            -f ./elib-chart/values-secret.yaml
        '''
      }
    }

    stage('Verify Deployment') {
      steps {
        sh '''
          set -e
          kubectl get pods -n elib
          kubectl get svc -n elib
          kubectl get ingress -n elib
        '''
      }
    }
  }

  post {
    success {
      echo 'Build and deployment completed successfully.'
    }
    failure {
      echo 'Build or deployment failed.'
    }
  }
}