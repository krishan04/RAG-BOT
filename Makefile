.PHONY: setup setup-backend setup-frontend db makemigrations migrate superuser backend frontend dev stop

VENV          := venv
PYTHON        := $(VENV)/bin/python
PIP           := $(VENV)/bin/pip
UVICORN       := $(VENV)/bin/uvicorn
DJANGO_ADMIN  := $(VENV)/bin/django-admin
BACKEND_DIR   := backend
FRONTEND_DIR  := frontend

help:
	@echo "make setup       create venv + install backend & frontend dependencies"
	@echo "make db          apply migrations"
	@echo "make superuser   create a Django admin user"
	@echo "make backend     run the FastAPI+Django backend on http://127.0.0.1:8000"
	@echo "make frontend    run the React dev server on http://localhost:5173"
	@echo "make dev         run backend + frontend concurrently (scripts/dev.sh)"
	@echo "make stop        stop any dev servers on ports 8000/5173"

setup: setup-backend setup-frontend
	@echo "Setup complete."

setup-backend:
	@test -d $(VENV) || python3 -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -r $(BACKEND_DIR)/requirements.txt
	@echo "Backend dependencies installed."

setup-frontend:
	@test -d $(FRONTEND_DIR)/node_modules || npm --prefix $(FRONTEND_DIR) install
	@echo "Frontend dependencies installed."

makemigrations:
	cd $(BACKEND_DIR) && ../$(PYTHON) manage.py makemigrations

migrate:
	cd $(BACKEND_DIR) && ../$(PYTHON) manage.py migrate

db: migrate
	@echo "Database migrated. Create a superuser with 'make superuser'."

superuser:
	cd $(BACKEND_DIR) && ../$(PYTHON) manage.py createsuperuser

backend:
	cd $(BACKEND_DIR) && ../$(UVICORN) config.asgi:application --reload

frontend:
	npm --prefix $(FRONTEND_DIR) run dev

dev:
	./scripts/dev.sh

stop:
	-lsof -ti tcp:8000 | xargs kill 2>/dev/null || true
	-lsof -ti tcp:5173 | xargs kill 2>/dev/null || true
	@echo "Dev servers stopped."