.PHONY: dev prod stop logs migrate seed clean generate-secrets

# ─── Development ──────────────────────────────────────────────────────────────
dev:
	docker compose up --build

dev-bg:
	docker compose up --build -d

stop:
	docker compose down

logs:
	docker compose logs -f

# ─── Production ───────────────────────────────────────────────────────────────
prod:
	docker compose -f docker-compose.prod.yml up --build -d

prod-stop:
	docker compose -f docker-compose.prod.yml down

prod-logs:
	docker compose -f docker-compose.prod.yml logs -f

# ─── Database ─────────────────────────────────────────────────────────────────
migrate:
	docker compose exec backend npx prisma migrate deploy

migrate-dev:
	docker compose exec backend npx prisma migrate dev

seed:
	docker compose exec backend node prisma/seed.js

studio:
	docker compose exec backend npx prisma studio

# ─── Utilities ────────────────────────────────────────────────────────────────
generate-secrets:
	@echo "JWT_SECRET=$(shell openssl rand -hex 64)"
	@echo "JWT_REFRESH_SECRET=$(shell openssl rand -hex 64)"
	@echo "INVITE_SECRET=$(shell openssl rand -hex 32)"
	@echo "NEXTAUTH_SECRET=$(shell openssl rand -hex 32)"
	@echo "POSTGRES_PASSWORD=$(shell openssl rand -base64 24)"
	@echo "REDIS_PASSWORD=$(shell openssl rand -base64 24)"

clean:
	docker compose down -v --remove-orphans
	docker system prune -f

backup-db:
	docker compose exec postgres pg_dump -U $$POSTGRES_USER $$POSTGRES_DB > backup_$(shell date +%Y%m%d_%H%M%S).sql

restore-db:
	@echo "Usage: make restore-db FILE=backup_20240101_120000.sql"
	docker compose exec -T postgres psql -U $$POSTGRES_USER $$POSTGRES_DB < $(FILE)
