.PHONY: dev dev-api dev-web stop test lint

dev:
	@echo "Starting API on :8000 and Web on :3000..."
	@cd api && uv run uvicorn reprompt.main:app --reload --port 8000 & echo $$! > ../.pid-api
	@cd web && npx next dev --turbopack --port 3000 & echo $$! > ../.pid-web
	@echo "API PID: $$(cat .pid-api)  Web PID: $$(cat .pid-web)"
	@echo "Run 'make stop' to shut down both servers."
	@wait

stop:
	@if [ -f .pid-api ]; then kill $$(cat .pid-api) 2>/dev/null; rm -f .pid-api; echo "API stopped"; fi
	@if [ -f .pid-web ]; then kill $$(cat .pid-web) 2>/dev/null; rm -f .pid-web; echo "Web stopped"; fi
	@pkill -f "uvicorn reprompt.main:app" 2>/dev/null || true
	@pkill -f "next dev" 2>/dev/null || true
	@echo "All servers stopped."

dev-api:
	cd api && uv run uvicorn reprompt.main:app --reload --port 8000

dev-web:
	cd web && npx next dev --turbopack --port 3000

test:
	cd api && uv run pytest -v

lint:
	cd web && npm run lint
