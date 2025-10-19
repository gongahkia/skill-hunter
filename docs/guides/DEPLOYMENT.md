# Dorso Deployment Guide

Guide for deploying Dorso to production using Docker Compose.

---

## Overview

**Deployment Stack:**
- **Django Backend**: Gunicorn + WhiteNoise for static files
- **PostgreSQL**: Persistent data storage
- **Redis**: Session cache and problem queue
- **Prometheus**: Metrics collection
- **Grafana**: Metrics visualization
- **Docker Compose**: Orchestration

---

## Prerequisites

- **Docker** 20.10+ and **Docker Compose** 2.0+
- **Domain name** (optional, for HTTPS)
- **SSL certificates** (optional, for production)

---

## Quick Start (Docker Compose)

### 1. Clone Repository

```bash
git clone https://github.com/gongahkia/dorso.git
cd dorso
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with production values
nano .env
```

**Required environment variables:**
```bash
# Django
DJANGO_SECRET_KEY=<generate-strong-secret-key>
DEBUG=False
ALLOWED_HOSTS=your-domain.com,localhost

# Database
DB_PASSWORD=<strong-database-password>

# Redis
REDIS_PASSWORD=<strong-redis-password>

# Grafana
GRAFANA_PASSWORD=<admin-password>
```

**Generate secret key:**
```bash
python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### 3. Start Services

```bash
# Build and start all containers
docker-compose up -d --build

# View logs
docker-compose logs -f backend

# Check status
docker-compose ps
```

### 4. Initialize Database

```bash
# Run migrations
docker-compose exec backend python manage.py migrate

# Create superuser
docker-compose exec backend python manage.py createsuperuser

# Collect static files
docker-compose exec backend python manage.py collectstatic --noinput
```

### 5. Verify Deployment

- **Backend API**: `http://localhost:8000/health/`
- **Django Admin**: `http://localhost:8000/admin/`
- **Prometheus**: `http://localhost:9090`
- **Grafana**: `http://localhost:3000` (admin/your-password)

---

## Production Checklist

### Security

- [ ] `DEBUG=False` in production
- [ ] Strong `DJANGO_SECRET_KEY` (never commit to git)
- [ ] Strong database and Redis passwords
- [ ] HTTPS enabled (SSL certificates)
- [ ] `SECURE_SSL_REDIRECT=True`
- [ ] `SESSION_COOKIE_SECURE=True`
- [ ] `CSRF_COOKIE_SECURE=True`
- [ ] Firewall configured (only expose necessary ports)
- [ ] Regular security updates (Docker images)

### Performance

- [ ] PostgreSQL tuning (connection pooling, memory)
- [ ] Redis persistence configured (AOF or RDB)
- [ ] Gunicorn workers configured (2-4 × CPU cores)
- [ ] Static files served via WhiteNoise or CDN
- [ ] Database indexes created (Django migrations)
- [ ] Redis max memory policy set

### Monitoring

- [ ] Prometheus scraping backend metrics
- [ ] Grafana dashboards configured
- [ ] Log aggregation (optional: ELK stack, Datadog)
- [ ] Uptime monitoring (optional: UptimeRobot, Pingdom)
- [ ] Error tracking (optional: Sentry)

### Backups

- [ ] PostgreSQL automated backups
- [ ] Redis AOF/RDB snapshots
- [ ] Backup retention policy
- [ ] Backup restoration tested

---

## Docker Compose Configuration

### Services Overview

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| **backend** | Custom (Django) | 8000 | REST API |
| **db** | postgres:15-alpine | 5432 | Database |
| **redis** | redis:7-alpine | 6379 | Cache |
| **prometheus** | prom/prometheus | 9090 | Metrics |
| **grafana** | grafana/grafana | 3000 | Dashboards |

### Persistent Volumes

```bash
# List volumes
docker volume ls

# Volumes created:
# - postgres_data: Database files
# - redis_data: Redis persistence
# - grafana_data: Grafana dashboards
# - prometheus_data: Metrics history
# - static_volume: Django static files
```

### Networking

All services communicate via `dorso-network` bridge network.

---

## Scaling

### Horizontal Scaling (Multiple Backend Instances)

Edit `docker-compose.yml`:

```yaml
backend:
  deploy:
    replicas: 3  # Run 3 backend containers
```

Add a load balancer (Nginx) in front of backend instances.

### Database Connection Pooling

In `backend/config/settings.py`:

```python
DATABASES = {
    'default': {
        ...
        'CONN_MAX_AGE': 600,  # Connection pooling
        'CONN_HEALTH_CHECKS': True,
    }
}
```

### Redis Max Memory

In `docker-compose.yml`:

```yaml
redis:
  command: >
    redis-server
    --appendonly yes
    --maxmemory 256mb
    --maxmemory-policy allkeys-lru
```

---

## Reverse Proxy (Nginx)

### Add Nginx to Docker Compose

```yaml
nginx:
  image: nginx:alpine
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - ./nginx.conf:/etc/nginx/nginx.conf
    - ./ssl:/etc/nginx/ssl
  depends_on:
    - backend
```

### Sample nginx.conf

```nginx
upstream backend {
    server backend:8000;
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /static/ {
        alias /app/staticfiles/;
    }
}
```

---

## Monitoring & Logging

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100 backend
```

### Structured Logs

Django logs are written to:
- **Console**: JSON format (when `DEBUG=False`)
- **File**: `backend/logs/dorso.log` (mounted volume)

### Prometheus Queries

Access Prometheus at `http://localhost:9090/graph`

**Example queries:**
```promql
# Solve rate (last hour)
rate(dorso_problems_solved_total[1h])

# API request latency (p95)
histogram_quantile(0.95, dorso_api_request_duration_seconds)

# Active sessions
dorso_session_checks_total{has_active_session="true"}
```

### Grafana Dashboards

1. Access Grafana: `http://localhost:3000`
2. Login: admin / your-password
3. Pre-configured dashboards in `monitoring/grafana/dashboards/`

---

## Maintenance

### Update Application

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose up -d --build

# Run migrations
docker-compose exec backend python manage.py migrate

# Collect static files
docker-compose exec backend python manage.py collectstatic --noinput
```

### Database Backup

```bash
# Manual backup
docker-compose exec db pg_dump -U dorso dorso > backup_$(date +%Y%m%d).sql

# Restore
docker-compose exec -T db psql -U dorso dorso < backup_20250115.sql
```

### Redis Backup

```bash
# Trigger save
docker-compose exec redis redis-cli SAVE

# Copy RDB file
docker cp dorso-redis:/data/dump.rdb ./redis_backup.rdb
```

### Clear Cache

```bash
# Clear all Redis data
docker-compose exec redis redis-cli FLUSHALL

# Clear Django cache only
docker-compose exec backend python manage.py shell
>>> from django.core.cache import cache
>>> cache.clear()
```

---

## Troubleshooting

### Backend Won't Start

**Check logs:**
```bash
docker-compose logs backend
```

**Common issues:**
- Missing migrations: `docker-compose exec backend python manage.py migrate`
- DB not ready: Wait for `db` health check to pass
- Port conflict: Change port in `docker-compose.yml`

### Database Connection Errors

**Verify database is healthy:**
```bash
docker-compose ps db
# Should show "healthy"

docker-compose exec db pg_isready -U dorso
```

### Redis Connection Errors

**Check Redis:**
```bash
docker-compose exec redis redis-cli ping
# Should return "PONG"
```

### Extension Can't Reach Backend

**Check CORS settings:**

In `backend/config/settings.py`:
```python
CORS_ALLOWED_ORIGINS = [
    'chrome-extension://*',
    'moz-extension://*',
]
```

**Verify backend is accessible:**
```bash
curl http://localhost:8000/health/
```

---

## Performance Tuning

### Gunicorn Workers

In `backend/Dockerfile`, adjust:

```dockerfile
CMD [..., "--workers", "4", "--threads", "2", ...]
```

**Recommendation:** `workers = 2-4 × CPU_cores`

### PostgreSQL Tuning

Create `docker-compose.override.yml`:

```yaml
version: '3.8'
services:
  db:
    environment:
      - POSTGRES_SHARED_BUFFERS=256MB
      - POSTGRES_EFFECTIVE_CACHE_SIZE=1GB
      - POSTGRES_MAINTENANCE_WORK_MEM=64MB
      - POSTGRES_CHECKPOINT_COMPLETION_TARGET=0.9
```

### Redis Memory

In `docker-compose.yml`:

```yaml
redis:
  command: >
    redis-server
    --maxmemory 512mb
    --maxmemory-policy allkeys-lru
```

---

## Security Hardening

### Firewall Rules (UFW)

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS (if using Nginx)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Deny direct access to services
sudo ufw deny 8000/tcp  # Django (use Nginx instead)
sudo ufw deny 5432/tcp  # PostgreSQL
sudo ufw deny 6379/tcp  # Redis

sudo ufw enable
```

### Docker Security

**Run as non-root user:**

In `Dockerfile`:
```dockerfile
RUN useradd -m -u 1000 dorso
USER dorso
```

**Read-only filesystem:**
```yaml
backend:
  read_only: true
  tmpfs:
    - /tmp
```

### Secrets Management

**Use Docker secrets** (Docker Swarm) or **environment variables** from vault (HashiCorp Vault, AWS Secrets Manager).

**Never commit secrets to git!**

---

## CI/CD (Optional)

### GitHub Actions Example

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /opt/dorso
            git pull origin main
            docker-compose up -d --build
            docker-compose exec -T backend python manage.py migrate
```

---

## Cost Estimation

**For personal use (minimal traffic):**

| Resource | Option | Cost |
|----------|--------|------|
| **Server** | DigitalOcean Droplet (1GB RAM) | $6/month |
| **Database** | Included (SQLite/PostgreSQL in Docker) | $0 |
| **Redis** | Included (Docker) | $0 |
| **Domain** | Namecheap | $10/year |
| **SSL** | Let's Encrypt (free) | $0 |

**Total:** ~$7/month

**For production (1000+ users):**
- Server: $20-50/month (4GB+ RAM)
- Managed PostgreSQL: $15-30/month
- Managed Redis: $10-20/month
- CDN (Cloudflare): $0-20/month
- **Total:** ~$50-120/month

---

## Next Steps

- [ ] Set up automated backups
- [ ] Configure SSL certificates (Let's Encrypt)
- [ ] Set up log aggregation (ELK, Datadog)
- [ ] Configure alerting (PagerDuty, Slack webhooks)
- [ ] Load testing (Locust, Apache JMeter)

For development setup, see [DEVELOPMENT.md](DEVELOPMENT.md).
