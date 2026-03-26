.PHONY: install dev build run stop test clean

# One-time setup
install:
	cd backend && pip install -r requirements.txt
	cd frontend && npm install

# Development mode (runs both in parallel)
dev:
	@echo "Starting backend on :8000 and frontend on :3000 ..."
	@cd backend && uvicorn app.main:app --reload --port 8000 &
	@cd frontend && npm run dev &
	@echo "Backend:  http://localhost:8000"
	@echo "Frontend: http://localhost:3000"
	@echo "API Docs: http://localhost:8000/docs"

# Backend only
backend:
	cd backend && uvicorn app.main:app --reload --port 8000

# Frontend only
frontend:
	cd frontend && npm run dev

# Docker build
build:
	docker-compose build

# Docker run
run:
	docker-compose up

# Docker run detached
up:
	docker-compose up -d

# Docker stop
stop:
	docker-compose down

# Run backend tests
test:
	cd backend && python -m pytest tests/ -v --tb=short

# Unit test quick (no ML models needed)
test-unit:
	cd backend && python -m pytest tests/test_ocr.py tests/test_fraud.py tests/test_face.py -v

# Clean temp files and DB
clean:
	rm -f backend/kyc.db
	rm -rf backend/uploads/*
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
