pipeline {
  agent any

  environment {
    AWS_REGION   = 'us-east-1'
    AWS_ACCOUNT  = '884537046542'
    ECR_REGISTRY = "${AWS_ACCOUNT}.dkr.ecr.${AWS_REGION}.amazonaws.com"
    KUBECONFIG   = '/var/lib/jenkins/.kube/config'
    IMAGE_TAG    = "${env.BUILD_NUMBER}"
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

    stage('Build Images') {
      steps {
        sh '''
          set -e

          docker build -t $ECR_REGISTRY/elib-auth:$IMAGE_TAG -f ./AuthService/Dockerfile .
          docker build -t $ECR_REGISTRY/elib-catalog:$IMAGE_TAG -f ./CatalogService/Dockerfile .
          docker build -t $ECR_REGISTRY/elib-borrow:$IMAGE_TAG -f ./BorrowService/Dockerfile .
          docker build -t $ECR_REGISTRY/elib-web:$IMAGE_TAG -f ./elib-web/Dockerfile ./elib-web
        '''
      }
    }

    stage('Push Images') {
      steps {
        sh '''
          set -e

          docker push $ECR_REGISTRY/elib-auth:$IMAGE_TAG
          docker push $ECR_REGISTRY/elib-catalog:$IMAGE_TAG
          docker push $ECR_REGISTRY/elib-borrow:$IMAGE_TAG
          docker push $ECR_REGISTRY/elib-web:$IMAGE_TAG
        '''
      }
    }

    stage('Deploy to EKS') {
      steps {
        sh '''
          set -e
          mkdir -p .tmp

          aws secretsmanager get-secret-value \
            --region $AWS_REGION \
            --secret-id elib/dev/helm-values-secret \
            --query SecretString \
            --output text > .tmp/values-secret.yaml

          if helm status elib -n elib >/dev/null 2>&1; then
            helm upgrade elib ./elib-chart \
              -n elib \
              -f ./elib-chart/values.yaml \
              -f .tmp/values-secret.yaml \
              --set auth.image.tag=$IMAGE_TAG \
              --set catalog.image.tag=$IMAGE_TAG \
              --set borrow.image.tag=$IMAGE_TAG \
              --set web.image.tag=$IMAGE_TAG
          else
            helm install elib ./elib-chart \
              -n elib \
              -f ./elib-chart/values.yaml \
              -f .tmp/values-secret.yaml \
              --set auth.image.tag=$IMAGE_TAG \
              --set catalog.image.tag=$IMAGE_TAG \
              --set borrow.image.tag=$IMAGE_TAG \
              --set web.image.tag=$IMAGE_TAG
          fi

          rm -f .tmp/values-secret.yaml
        '''
      }
    }

    stage('Verify Deployment') {
      steps {
        sh '''
          set -e
          kubectl rollout status deployment/elib-chart-auth -n elib --timeout=5m
          kubectl rollout status deployment/elib-chart-catalog -n elib --timeout=5m
          kubectl rollout status deployment/elib-chart-borrow -n elib --timeout=5m
          kubectl rollout status deployment/elib-chart-web -n elib --timeout=5m

          kubectl get pods -n elib -o wide
          kubectl get svc -n elib
          kubectl get ingress -n elib
        '''
      }
    }

    stage('Cleanup Local Images') {
      steps {
        sh '''
          set +e
          docker rmi $ECR_REGISTRY/elib-auth:$IMAGE_TAG
          docker rmi $ECR_REGISTRY/elib-catalog:$IMAGE_TAG
          docker rmi $ECR_REGISTRY/elib-borrow:$IMAGE_TAG
          docker rmi $ECR_REGISTRY/elib-web:$IMAGE_TAG
          docker image prune -f
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