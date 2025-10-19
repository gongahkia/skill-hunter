# Dorso Development Guide

Complete guide for setting up a local development environment and contributing to Dorso.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Running Locally](#running-locally)
4. [Development Workflow](#development-workflow)
5. [Testing](#testing)
6. [Code Quality](#code-quality)
7. [Project Structure](#project-structure)
8. [Common Tasks](#common-tasks)

---

## Prerequisites

### Required Tools

- **Python** 3.11+
- **Node.js** 18+ and npm
- **Redis** 7+ (or Docker)
- **PostgreSQL** 15+ (optional, SQLite works for dev)
- **Git**

### Optional but Recommended

- **Docker** & **Docker Compose** (for containerized development)
- **Pre-commit** (for code quality hooks)
- **Postman** or **curl** (for API testing)

---

## Initial Setup

### 1. Clone the Repository

```bash
git clone https://github.com/gongahkia/dorso.git
cd dorso
```

### 2. Set Up Python Backend

```bash
# Create virtual environment
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env

# Edit .env and configure:
# - DJANGO_SECRET_KEY (generate with: python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())")
# - DEBUG=True
# - REDIS_URL=redis://127.0.0.1:6379/0

# Run migrations
python manage.py migrate

# Create superuser (for Django admin)
python manage.py createsuperuser

# Start development server
python manage.py runserver
```

Backend should now be running at `http://localhost:8000`

### 3. Start Redis

**Option A: Using Docker**
```bash
docker run -d -p 6379:6379 redis:7-alpine
```

**Option B: Local Redis**
```bash
redis-server
```

### 4. Set Up Shared JavaScript Module

```bash
cd src/shared
npm install

# Run tests
npm test

# Run linter
npm run lint
```

### 5. Load Extension in Browser

**For Chrome:**
1. Navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `dorso/src/chrome/` directory

**For Firefox:**
1. Navigate to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `dorso/src/firefox/manifest.json`

---

## Running Locally

### Option 1: Manual (Backend + Redis)

```bash
# Terminal 1: Start Redis
redis-server

# Terminal 2: Start Django backend
cd backend
source venv/bin/activate
python manage.py runserver

# Terminal 3: (Optional) Watch test suite
cd backend
pytest --cov=dorso_api --cov-report=term-missing -v --looponfail
```

### Option 2: Docker Compose (Full Stack)

```bash
# Create .env file at project root
cp .env.example .env

# Start all services
docker-compose up --build

# Services will be available at:
# - Backend API: http://localhost:8000
# - PostgreSQL: localhost:5432
# - Redis: localhost:6379
# - Prometheus: http://localhost:9090
# - Grafana: http://localhost:3000 (admin/admin)
```

---

## Development Workflow

### Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Backend code: `backend/dorso_api/`
   - Shared JS: `src/shared/`
   - Extension: `src/chrome/` or `src/firefox/`

3. **Write tests**
   - Python tests: `backend/tests/`
   - JS tests: `src/shared/__tests__/`

4. **Run tests and linters**
   ```bash
   # Python
   cd backend
   pytest
   black .
   flake8

   # JavaScript
   cd src/shared
   npm test
   npm run lint
   ```

5. **Commit with pre-commit hooks**
   ```bash
   # Install pre-commit (first time only)
   pip install pre-commit
   pre-commit install

   # Hooks will run automatically on commit
   git add .
   git commit -m "feat: add new feature"
   ```

6. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   # Open PR on GitHub
   ```

---

## Testing

### Backend Testing (pytest)

```bash
cd backend

# Run all tests
pytest

# Run with coverage
pytest --cov=dorso_api --cov-report=html

# Run specific test file
pytest tests/unit/test_models.py

# Run specific test
pytest tests/unit/test_models.py::TestExtensionUserModel::test_record_solve_increments_stats

# Run in watch mode
pytest --looponfail
```

**Coverage reports** are generated in `backend/htmlcov/index.html`

### JavaScript Testing (Jest)

```bash
cd src/shared

# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch

# Run specific test file
npm test -- __tests__/session-manager.test.js
```

### E2E Testing (Playwright)

```bash
cd tests/e2e

# Install dependencies
npm install

# Install browsers
npx playwright install

# Run tests
npm test

# Run with UI
npm run test:ui

# Run in debug mode
npm run test:debug
```

---

## Code Quality

### Pre-commit Hooks

Automatically run on `git commit`:
- Trailing whitespace removal
- File endings normalization
- YAML/JSON validation
- Python: Black, isort, Flake8, Bandit
- JavaScript: Prettier, ESLint

### Manual Linting

**Python:**
```bash
cd backend

# Format code
black .

# Sort imports
isort .

# Lint
flake8

# Type checking
mypy dorso_api

# Security audit
bandit -r dorso_api
```

**JavaScript:**
```bash
cd src/shared

# Format code
npm run format

# Lint
npm run lint

# Auto-fix
npx eslint . --fix
```

---

## Project Structure

```
dorso/
├── backend/                    # Django REST API
│   ├── config/                # Django settings
│   ├── dorso_api/
│   │   ├── apps/
│   │   │   ├── tracking/      # User & session models
│   │   │   └── problems/      # Problem management
│   │   └── ...
│   ├── tests/                 # pytest tests
│   ├── requirements.txt
│   └── manage.py
├── src/
│   ├── shared/                # Shared JS modules
│   │   ├── core/
│   │   ├── utils/
│   │   ├── api/
│   │   ├── adapters/
│   │   └── __tests__/
│   ├── chrome/                # Chrome extension
│   │   ├── background.js
│   │   ├── popup.html/js
│   │   ├── leetcode-content.js
│   │   └── manifest.json
│   └── firefox/               # Firefox extension
│       └── (same structure)
├── tests/
│   └── e2e/                   # Playwright E2E tests
├── docs/                      # Documentation
│   ├── architecture/
│   ├── api/
│   └── guides/
├── monitoring/                # Prometheus & Grafana config
├── docker-compose.yml
└── README.md
```

---

## Common Tasks

### Add a New Django Model

1. Create model in `backend/dorso_api/apps/<app>/models.py`
2. Create migration:
   ```bash
   python manage.py makemigrations
   ```
3. Apply migration:
   ```bash
   python manage.py migrate
   ```
4. Register in admin (optional):
   ```python
   # admin.py
   @admin.register(YourModel)
   class YourModelAdmin(admin.ModelAdmin):
       list_display = ['field1', 'field2']
   ```

### Add a New API Endpoint

1. Create serializer in `serializers.py`
2. Create view in `views.py`
3. Add URL in `urls.py`
4. Write tests in `tests/integration/test_api.py`

### Update Extension Manifest

**Chrome:** `src/chrome/manifest.json`
**Firefox:** `src/firefox/manifest.json`

After changes, reload extension:
- Chrome: Go to `chrome://extensions/` → Click reload icon
- Firefox: Go to `about:debugging` → Click reload

### Update Shared Module

1. Make changes in `src/shared/`
2. Write tests in `src/shared/__tests__/`
3. Run `npm test`
4. Extension will automatically use updated shared code

### View Django Admin

1. Start Django: `python manage.py runserver`
2. Navigate to: `http://localhost:8000/admin/`
3. Login with superuser credentials
4. View/edit users, attempts, sessions

### View Prometheus Metrics

1. Start backend
2. Navigate to: `http://localhost:8000/metrics`
3. See Prometheus text format metrics

### Access Grafana Dashboard

1. Start docker-compose: `docker-compose up`
2. Navigate to: `http://localhost:3000`
3. Login: admin/admin (change on first login)
4. Dashboards → Dorso Analytics

### Clear Redis Cache

```bash
# Using redis-cli
redis-cli FLUSHDB

# Or in Python shell
python manage.py shell
>>> from django.core.cache import cache
>>> cache.clear()
```

### Run Django Shell

```bash
python manage.py shell

# Interactive Python shell with Django environment
>>> from dorso_api.apps.tracking.models import ExtensionUser
>>> users = ExtensionUser.objects.all()
>>> user = users.first()
>>> user.total_solves
```

---

## Debugging

### Backend Debugging

**Django Debug Toolbar** (optional):
```bash
pip install django-debug-toolbar
# Add to INSTALLED_APPS in settings.py
```

**Print debugging:**
```python
import structlog
logger = structlog.get_logger(__name__)

logger.debug("Debug info", variable=value)
logger.error("Error occurred", error=str(e))
```

### Extension Debugging

**Chrome:**
1. Right-click extension icon → "Inspect popup"
2. View console for logs
3. Check background service worker: `chrome://extensions/` → "Inspect views: Service Worker"

**Firefox:**
1. `about:debugging` → "This Firefox" → Inspect
2. View console for logs

---

## Environment Variables

### Backend (.env)

```bash
# Django
DJANGO_SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database (optional, defaults to SQLite)
DATABASE_URL=postgresql://dorso:password@localhost:5432/dorso

# Redis
REDIS_URL=redis://127.0.0.1:6379/0

# CORS
CORS_ALLOWED_ORIGINS=chrome-extension://,moz-extension://

# Logging
LOG_LEVEL=INFO
```

### Docker Compose (.env at root)

```bash
DJANGO_SECRET_KEY=your-secret-key
DEBUG=False
DB_PASSWORD=secure-password
REDIS_PASSWORD=secure-password
GRAFANA_PASSWORD=admin-password
```

---

## Next Steps

- **Run tests**: `cd backend && pytest`
- **Read API docs**: [API_REFERENCE.md](../api/API_REFERENCE.md)
- **View architecture**: [C4_DIAGRAMS.md](../architecture/C4_DIAGRAMS.md)
- **Deploy**: [DEPLOYMENT.md](DEPLOYMENT.md)

For questions, open an issue on GitHub!
