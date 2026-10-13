# Production Deployment Guide

## Important: Do Not Use .env in Production

The .env file is for local development only. In production, environment variables must be set directly on the host or passed via a secure method. Never commit .env to version control and never copy it to a production server.

---

## Local Development Setup

### Starting the project

```bash
docker compose up --build
```

### After changing .env

Docker caches build layers and does not automatically pick up environment variable changes. Every time you update .env you need to do a full restart:

```bash
docker compose down
docker compose up --build
```

Skipping the down step can leave containers running with stale configuration, which causes confusing bugs that are hard to trace.

---

## Production Deployment

### 1. Set up environment variables

On the production server, create a secure env file outside the project directory. This file should never be inside the repository folder.

```bash
mkdir -p /etc/xis-portal
cat > /etc/xis-portal/prod.env << 'EOF'
SECRET_KEY=<generate - see key generation section below>
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
FERNET_KEY=<generate - see key generation section below>
JWT_SIGNING_KEY=<generate - see key generation section below>
POSTGRES_DB=xis_db_prod
POSTGRES_USER=xis_prod_user
POSTGRES_PASSWORD=<strong random password>
DATABASE_URL=postgresql://xis_prod_user:<password>@<RDS_ENDPOINT>:5432/xis_db_prod
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
REDIS_URL=redis://<elasticache-endpoint>:6379/0
NEXT_PUBLIC_API_URL=https://yourdomain.com
EOF

chmod 600 /etc/xis-portal/prod.env
```

Note: On AWS, DATABASE_URL points to your RDS endpoint, not 'db'. REDIS_URL points to your ElastiCache endpoint, not a container name.

### 2. Deploy

Use the --env-file flag to pass the env file to Docker Compose. This is safer than using xargs which can break on special characters in key values.

```bash
docker compose -f docker-compose.prod.yml --env-file /etc/xis-portal/prod.env up -d --build
```

### 3. Updating environment variables

When you need to change a value in the env file:

```bash
nano /etc/xis-portal/prod.env

docker compose -f docker-compose.prod.yml --env-file /etc/xis-portal/prod.env down
docker compose -f docker-compose.prod.yml --env-file /etc/xis-portal/prod.env up -d --build
```

---

## Application Server (Gunicorn)

The container serves the backend with **Gunicorn**, a production WSGI server — not
Django's `runserver`, which is single-threaded and explicitly not meant for
production. The container entrypoint runs database migrations and then launches:

```bash
gunicorn config.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers $(( 2 * $(nproc) + 1 )) \
  --max-requests 1000 \
  --max-requests-jitter 100 \
  --timeout 60 \
  --access-logfile - \
  --error-logfile -
```

### Startup command settings

- **`--workers`** — number of worker processes. Defaults to `(2 x CPU cores) + 1`,
  computed at runtime from `nproc`. This is Gunicorn's recommended starting point;
  tune it against real traffic and the connection math below.
- **`--max-requests 1000` / `--max-requests-jitter 100`** — each worker is recycled
  after ~1000 (±100 random) requests. This bounds memory growth from slow leaks by
  periodically replacing workers, and the jitter staggers restarts so they don't all
  recycle at the same instant.
- **`--timeout 60`** — a worker whose request runs longer than 60s is killed and
  replaced. Raise this only if you have legitimately long-running endpoints.
- **`--access-logfile - --error-logfile -`** — logs go to stdout/stderr so Docker /
  your log driver captures them.

### Overriding the defaults

All knobs are environment variables, so you can tune them without rebuilding the
image (set them in the same env file used for deployment):

| Variable | Default | Purpose |
| --- | --- | --- |
| `GUNICORN_WORKERS` | `(2 x CPU cores) + 1` | Worker process count |
| `GUNICORN_MAX_REQUESTS` | `1000` | Requests before a worker is recycled |
| `GUNICORN_MAX_REQUESTS_JITTER` | `100` | Random jitter on the recycle point |
| `GUNICORN_TIMEOUT` | `60` | Worker request timeout (seconds) |

### Database connections vs. Postgres `max_connections`

`CONN_MAX_AGE=600` (in `backend/config/settings/base.py`) means each worker keeps its
Postgres connection open (persistent) for up to 10 minutes instead of reconnecting
per request. With the default sync workers (1 connection per worker), peak
connections are approximately:

```
peak_connections ≈ workers x replicas   (+ a few for migrations, admin, ad-hoc psql)
```

**Sanity-check before scaling out.** Make sure Postgres `max_connections`
comfortably covers `workers x replica_count` with headroom. Worked example:

- 4-core host → `(2 x 4) + 1 = 9` workers per replica
- 3 replicas → `~27` persistent connections, plus overhead → budget ~35–40
- Postgres default `max_connections` is `100`, so this fits with headroom.

⚠️ **When to add a pooler (PgBouncer):** managed Postgres often caps
`max_connections` by instance size (e.g. small AWS RDS classes allow only ~80–110).
If `workers x replicas` starts approaching that cap — many replicas, high worker
counts, or `--threads` added — put **PgBouncer in transaction-pooling mode** in
front of Postgres and set `CONN_MAX_AGE=0` so persistent connections don't defeat
the pooler. This is a human decision: confirm the target Postgres instance's
`max_connections` and planned replica count before going live.

---

## Generating Keys

Run these commands on any machine with Python installed. Generate a fresh set of keys for each environment. Never reuse keys across environments.

### SECRET_KEY

```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### FERNET_KEY

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### JWT_SIGNING_KEY

```bash
python -c "import secrets; print(secrets.token_urlsafe(50))"
```

---

## Environment Variable Reference

### Required

The application will refuse to start if any of these are missing:

- SECRET_KEY
- FERNET_KEY
- JWT_SIGNING_KEY
- ALLOWED_HOSTS
- CORS_ALLOWED_ORIGINS
- REDIS_URL
- NEXT_PUBLIC_API_URL
- DATABASE_URL (production) or POSTGRES_DB / POSTGRES_USER / POSTGRES_PASSWORD (local docker)

### Optional

These have defaults and the app will start without them:

- DEBUG (defaults to False)
- BACKEND_PORT (defaults to 8000)
- GUNICORN_WORKERS (defaults to (2 x CPU cores) + 1 — see Application Server section)
- GUNICORN_MAX_REQUESTS (defaults to 1000)
- GUNICORN_MAX_REQUESTS_JITTER (defaults to 100)
- GUNICORN_TIMEOUT (defaults to 60 seconds)

---

## Pre-deploy Checklist

- .env is listed in .gitignore and has never been committed
- DEBUG is set to False
- SECRET_KEY, FERNET_KEY, and JWT_SIGNING_KEY are freshly generated for this environment
- POSTGRES_PASSWORD is a strong random string, not a dictionary word
- ALLOWED_HOSTS contains only your actual domain, not wildcards
- CORS_ALLOWED_ORIGINS contains only your frontend URL
- NEXT_PUBLIC_API_URL uses https, not http
- DATABASE_URL points to your RDS endpoint, not 'db' or localhost
- REDIS_URL points to ElastiCache or another managed Redis, not a container name
- The prod.env file is stored at /etc/xis-portal/ with chmod 600

---

## Troubleshooting

### Error: variable not set

One of the required environment variables is missing from your env file. Check the required list above, add the missing variable, then restart the containers.

### Frontend cannot reach the backend

Check that NEXT_PUBLIC_API_URL matches the domain your frontend is served from. Also check that CORS_ALLOWED_ORIGINS includes that same domain. A mismatch between these two is the most common cause of this issue.

### Rebuild not picking up new environment variables

```bash
docker compose -f docker-compose.prod.yml --env-file /etc/xis-portal/prod.env down
docker compose -f docker-compose.prod.yml --env-file /etc/xis-portal/prod.env up -d --build
```

### Password authentication failed for database user

The DATABASE_URL credentials do not match what the database was initialized with. On AWS RDS, verify the username and password against what was set when the RDS instance was created. If using the local db container, run `docker compose down -v` to wipe the volume and reinitialize with the current credentials.