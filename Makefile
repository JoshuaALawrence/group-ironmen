.PHONY: help dev stop lint test test-coverage build clean docker-publish update-cache update-cache-push update-equipment

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── Development ──────────────────────────────────────────────

dev: ## Start local development stack
	docker compose up -d group-ironmen-tracker-db
	cd site && npm run start:local-api &
	cd server && cargo run

stop: ## Stop all containers
	docker compose down

# ── Quality ──────────────────────────────────────────────────

lint: ## Run all linters
	cd site && npm run format:check && npm run lint
	cd server && cargo fmt --check && cargo clippy -- -D warnings

test: ## Run all tests
	cd site && npm test
	cd server && cargo test

test-coverage: ## Run tests with coverage
	cd site && npm run test:coverage

# ── Build ────────────────────────────────────────────────────

build: ## Build Docker images locally
	docker compose build

build-frontend: ## Build just the frontend image
	docker build -t group-ironmen-frontend ./site

build-backend: ## Build just the backend image
	docker build -t group-ironmen-backend ./server

docker-publish: ## Build frontend/backend images for your registry. Example: make docker-publish IMAGE_PREFIX=myuser TAG=latest PUSH=1
	@test -n "$(IMAGE_PREFIX)" || (echo "IMAGE_PREFIX is required. Example: make docker-publish IMAGE_PREFIX=myuser TAG=latest PUSH=1" && exit 1)
	pwsh -File ./scripts/publish-docker.ps1 -ImagePrefix $(IMAGE_PREFIX) -Tag $(if $(TAG),$(TAG),latest) $(if $(PLATFORM),-Platform $(PLATFORM),) $(if $(PUSH),-Push,) $(if $(NO_CACHE),-NoCache,)

# ── Production ───────────────────────────────────────────────

up: ## Start production stack
	docker compose up -d

down: ## Stop production stack
	docker compose down

logs: ## Tail production logs
	docker compose logs -f --tail=100

# ── Cleanup ──────────────────────────────────────────────────

clean: ## Remove build artifacts
	cd site && npm run clean
	cd server && cargo clean
	docker compose down -v --remove-orphans 2>/dev/null || true

# ── Cache Update ─────────────────────────────────────────────

update-cache: ## Full OSRS cache update: download, dump, sync site, update equipment, build
	pwsh -File ./scripts/update-cache.ps1

update-cache-push: ## Full cache update then git commit + push
	pwsh -File ./scripts/update-cache.ps1 -Push

update-equipment: ## Re-import equipment.json from latest cache dump (no re-download)
	pwsh -File ./scripts/update-cache.ps1 -SkipCacheDump -SkipBuild
