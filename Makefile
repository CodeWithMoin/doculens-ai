SHELL := /bin/bash
.DEFAULT_GOAL := help

.PHONY: help install dev up down showcase-up showcase-down showcase-logs test lint format typecheck check sample

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*## "; printf "DocuLens developer commands\n\n"} /^[a-zA-Z_-]+:.*## / {printf "  %-12s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install backend and frontend development dependencies
	python3 -m pip install -e '.[dev]'
	npm --prefix frontend ci

dev: ## Run API with hot reload
	uvicorn app.main:app --reload --port 8080

up: ## Start the complete Docker development stack
	docker compose --env-file .env -f docker/docker-compose.yml up --build -d

down: ## Stop the Docker development stack
	docker compose --env-file .env -f docker/docker-compose.yml down

showcase-up: ## Build and start the read-only portfolio showcase
	docker compose --env-file .env.showcase -f docker/docker-compose.showcase.yml up --build -d

showcase-down: ## Stop the read-only portfolio showcase
	docker compose --env-file .env.showcase -f docker/docker-compose.showcase.yml down

showcase-logs: ## Follow portfolio showcase logs
	docker compose --env-file .env.showcase -f docker/docker-compose.showcase.yml logs -f --tail=200

test: ## Run backend tests
	pytest

lint: ## Run backend and frontend lint checks
	ruff check .
	npm --prefix frontend run lint

format: ## Format backend code
	ruff format .
	ruff check --fix .

typecheck: ## Type-check backend and build/type-check frontend
	pyright
	npm --prefix frontend run build

check: lint typecheck test ## Run the full local quality gate

sample: ## Submit the sample search event to a running API
	python3 requests/send_event.py requests/events/search_query.json
