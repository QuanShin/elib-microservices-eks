pipeline {
  agent any

  environment {
    AWS_REGION = 'us-east-1'
    AWS_ACCOUNT_ID = '884537046542'
    ECR_REGISTRY = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

    AUTH_REPO = "${ECR_REGISTRY}/elib-auth"
    CATALOG_REPO = "${ECR_REGISTRY}/elib-catalog"
    BORROW_REPO = "${ECR_REGISTRY}/elib-borrow"
    WEB_REPO = "${ECR_REGISTRY}/elib-web"

    IMAGE_TAG = "${env.BUILD_NUMBER}"

    KUBECONFIG = '/var/lib/jenkins/.kube/config'
  }

  options {
    disableConcurrentBuilds()
    timestamps()
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        sh 'git rev-parse --short HEAD'
      }
    }

    stage('Verify tools') {
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

          docker build -t $AUTH_REPO:$IMAGE_TAG -f ./AuthService/Dockerfile .
          docker build -t $CATALOG_REPO:$IMAGE_TAG -f ./CatalogService/Dockerfile .
          docker build -t $BORROW_REPO:$IMAGE_TAG -f ./BorrowService/Dockerfile .
          docker build -t $WEB_REPO:$IMAGE_TAG -f ./elib-web/Dockerfile ./elib-web
        '''
      }
    }

    stage('Push Images') {
      steps {
        sh '''
          set -e

          docker push $AUTH_REPO:$IMAGE_TAG
          docker push $CATALOG_REPO:$IMAGE_TAG
          docker push $BORROW_REPO:$IMAGE_TAG
          docker push $WEB_REPO:$IMAGE_TAG
        '''
      }
    }

    stage('Verify ECR Tags') {
      steps {
        sh '''
          set -e

          aws ecr describe-images --region $AWS_REGION --repository-name elib-auth --image-ids imageTag=$IMAGE_TAG >/dev/null
          aws ecr describe-images --region $AWS_REGION --repository-name elib-catalog --image-ids imageTag=$IMAGE_TAG >/dev/null
          aws ecr describe-images --region $AWS_REGION --repository-name elib-borrow --image-ids imageTag=$IMAGE_TAG >/dev/null
          aws ecr describe-images --region $AWS_REGION --repository-name elib-web --image-ids imageTag=$IMAGE_TAG >/dev/null

          echo "All images with tag $IMAGE_TAG exist in ECR."
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
              --set imageTags.auth=$IMAGE_TAG \
              --set imageTags.catalog=$IMAGE_TAG \
              --set imageTags.borrow=$IMAGE_TAG \
              --set imageTags.web=$IMAGE_TAG \
              --set auth.image.tag=$IMAGE_TAG \
              --set catalog.image.tag=$IMAGE_TAG \
              --set borrow.image.tag=$IMAGE_TAG \
              --set web.image.tag=$IMAGE_TAG \
              --wait \
              --timeout 10m \
              --atomic
          else
            helm install elib ./elib-chart \
              -n elib \
              -f ./elib-chart/values.yaml \
              -f .tmp/values-secret.yaml \
              --set imageTags.auth=$IMAGE_TAG \
              --set imageTags.catalog=$IMAGE_TAG \
              --set imageTags.borrow=$IMAGE_TAG \
              --set imageTags.web=$IMAGE_TAG \
              --set auth.image.tag=$IMAGE_TAG \
              --set catalog.image.tag=$IMAGE_TAG \
              --set borrow.image.tag=$IMAGE_TAG \
              --set web.image.tag=$IMAGE_TAG \
              --wait \
              --timeout 10m \
              --atomic
          fi

          rm -f .tmp/values-secret.yaml
        '''
      }
    }

    stage('Verify Deployment') {
      steps {
        sh '''
          set -e

          kubectl get deployment elib-chart-auth -n elib -o=jsonpath="{.spec.template.spec.containers[0].image}"; echo
          kubectl get deployment elib-chart-catalog -n elib -o=jsonpath="{.spec.template.spec.containers[0].image}"; echo
          kubectl get deployment elib-chart-borrow -n elib -o=jsonpath="{.spec.template.spec.containers[0].image}"; echo
          kubectl get deployment elib-chart-web -n elib -o=jsonpath="{.spec.template.spec.containers[0].image}"; echo

          kubectl rollout status deployment elib-chart-auth -n elib --timeout=300s
          kubectl rollout status deployment elib-chart-catalog -n elib --timeout=300s
          kubectl rollout status deployment elib-chart-borrow -n elib --timeout=300s
          kubectl rollout status deployment elib-chart-web -n elib --timeout=300s
        '''
      }
    }
  }

  post {
    success {
      echo "Build ${IMAGE_TAG} deployed successfully."
    }
    failure {
      echo "Build failed. Check console output."
    }
    always {
      sh 'docker image prune -f || true'
    }
  }
}