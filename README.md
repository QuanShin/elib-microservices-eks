# E-Library Microservices

GitHub Repository: https://github.com/QuanShin/elib-microservices-eks

## Overview
This project is a microservices-based E-Library system with authentication, catalog management, borrowing features, and a frontend client.

## Services
- AuthService: handles login, JWT issuing, refresh flow, and identity checks
- CatalogService: manages books and catalog data
- BorrowService: handles checkout, return, loan history, and admin borrowing summary
- elib-web: frontend interface for login, browsing books, and loan management

## Current Features
- JWT-based authentication
- Role-based authorization
- Catalog browsing
- Borrow and return functionality
- Admin borrowing summary
- Frontend integration with backend APIs

## Planned Deployment
- Docker containers for each service
- Helm chart for Kubernetes deployment
- Amazon EKS
- AWS Load Balancer Controller with ALB Ingress
- AWS Secrets Manager for JWT and database secrets

## Local Development
Each backend service runs separately with .NET, and the frontend runs with Vite.

## Notes
Personal identifiers have been removed from source code and documentation where required for submission.