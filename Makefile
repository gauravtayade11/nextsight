.PHONY: help dev build up down logs clean test lint restart

# Colors for terminal output
CYAN := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RESET := \033[0m

help: ## Show this help message
	@echo "$(CYAN)NextSight - DevOps Operations Center$(RESET)"
	@echo ""
	@echo "$(GREEN)Available commands:$(RESET)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-15s$(RESET) %s\n", $$1, $$2}'

# Docker Compose Commands
dev: ## Start development environment
	docker-compose up -d
	@echo "$(GREEN)NextSight is running at http://localhost:3000$(RESET)"

build: ## Build Docker images
	docker-compose build

up: ## Start containers in foreground
	docker-compose up

down: ## Stop and remove containers
	docker-compose down

logs: ## View container logs
	docker-compose logs -f

restart: ## Restart all containers
	docker-compose restart

# Individual Services
backend-logs: ## View backend logs
	docker-compose logs -f backend

frontend-logs: ## View frontend logs
	docker-compose logs -f frontend

backend-shell: ## Shell into backend container
	docker-compose exec backend bash

# Build Commands
build-backend: ## Build backend image only
	docker build -t nexops-backend:latest ./backend

build-frontend: ## Build frontend image only
	docker build -t nexops-frontend:latest ./frontend

# Production Build
build-prod: ## Build production images with version tag
	@VERSION=$$(cat VERSION); \
	docker build -t nexops-backend:$$VERSION ./backend; \
	docker build -t nexops-frontend:$$VERSION ./frontend

# Kubernetes Deployment
k8s-deploy: ## Deploy to Kubernetes
	kubectl apply -f k8s/namespace.yaml
	kubectl apply -f k8s/rbac.yaml
	kubectl apply -f k8s/service.yaml
	kubectl apply -f k8s/deployment.yaml
	@echo "$(GREEN)Deployed to Kubernetes$(RESET)"

k8s-delete: ## Delete from Kubernetes
	kubectl delete -f k8s/ --ignore-not-found
	@echo "$(YELLOW)Removed from Kubernetes$(RESET)"

k8s-status: ## Check Kubernetes deployment status
	kubectl get all -n nexops

# Cleanup
clean: ## Remove all containers and images
	docker-compose down -v --rmi all
	@echo "$(YELLOW)Cleaned up Docker resources$(RESET)"

prune: ## Remove unused Docker resources
	docker system prune -f
	@echo "$(YELLOW)Pruned unused Docker resources$(RESET)"

# Development Helpers
backend-dev: ## Run backend locally (without Docker)
	cd backend && source venv/bin/activate && export DEBUG=true && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend-dev: ## Run frontend locally (without Docker)
	cd frontend && npm run dev

install: ## Install dependencies locally
	cd backend && pip install -r requirements.txt
	cd frontend && npm install
