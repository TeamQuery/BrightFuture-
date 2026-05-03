# BrightFuture Backend

Production-oriented Node.js/Express API for BrightFuture with PostgreSQL, Redis, JWT authentication, RBAC, structured logging, RFC 7807 errors, health checks, Docker support, and a controlled PostgreSQL function bridge for the wider school ERP database contract.

## Current Scope

This backend currently has two layers:

1. A native hardened API layer implemented directly in Node/Express.
2. A guarded database-function bridge for selected PostgreSQL stored functions.

The native API layer is the stable core and currently owns:

- Auth: registration, login, refresh, logout, current user
- Admin user management: list users, soft delete users, list audit logs
- Health endpoints

The function bridge exists so the backend can call approved PostgreSQL functions from schemas such as `security`, `staff`, `students`, `finance`, `system`, `library`, `inventory`, `messaging`, `uploads`, and `audits` without remounting the older insecure raw-query route layer.

Important: the local migration in this repo does **not** create the full school ERP schema. It currently creates only:

- `users`
- `audit_logs`
- `user_role` enum
- `set_row_updated_at()` trigger function

If you want to use the school modules through `/api/functions/...`, the target PostgreSQL instance must already contain the referenced schemas, tables, and stored functions.

## Stack

- Node.js 20+
- Express 4
- PostgreSQL via `pg` pool
- Redis via `redis`
- JWT via `jsonwebtoken`
- Password hashing via `bcryptjs`
- Validation via `zod`
- Logging via `pino` and `pino-http`
- Docker + Docker Compose

## Security Features

- Short-lived JWT access tokens
- Long-lived refresh tokens stored in an `HttpOnly` cookie
- Refresh rotation with reuse detection
- RBAC enforced in middleware
- Redis-backed session state for revocation and horizontal scaling
- Redis-backed rate limiting
- Helmet headers
- CORS allowlist
- Zod request and environment validation
- Structured audit logging
- Soft delete for users
- RFC 7807 `application/problem+json` error responses
- Sensitive field redaction in logs

## Rate Limits

Configured in [src/middleware/rate-limit.js](</C:/wamp64/www/BrightFuture-/backend/src/middleware/rate-limit.js:1>):

- `1000/IP/min` globally
- `100/user/min` for authenticated routes
- `10 credential attempts/min` per `IP + email` on login/register

Rate-limit headers returned:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

## Auth Model

Auth routes live in [src/routes/auth.js](</C:/wamp64/www/BrightFuture-/backend/src/routes/auth.js:1>).

Flow:

1. `POST /api/v1/auth/register` creates a user with the safe default role `parent`.
2. `POST /api/v1/auth/login` returns an access token and sets the refresh cookie.
3. `POST /api/v1/auth/refresh` rotates the refresh token and issues a new access token.
4. `POST /api/v1/auth/logout` revokes the current session and clears the cookie.
5. `GET /api/v1/auth/me` returns the authenticated user.

Token/session behavior:

- Access token is sent as `Authorization: Bearer <token>`
- Refresh token is stored as `HttpOnly`, `SameSite=Strict`, `path=/api`
- Session state is stored in Redis
- If refresh-token reuse is detected, all sessions for that user are revoked
- Soft-deleted or inactive users immediately lose access

## API Surface

Mounted in [src/app.js](</C:/wamp64/www/BrightFuture-/backend/src/app.js:1>).

### Native Express routes

- `GET /health`
- `GET /health/live`
- `GET /health/ready`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/users`
- `GET /api/users/audit-logs`
- `DELETE /api/users/:id`

Versioned aliases are also mounted under `/api/v1/...`.

### PostgreSQL function bridge

Routes:

- `GET /api/v1/functions`
- `POST /api/v1/functions/:schema/:name`

The bridge:

- requires authentication
- applies user rate limiting
- only exposes allowlisted functions
- currently restricts the exposed school-module functions to `admin`
- maps PostgreSQL/function failures to API-safe RFC 7807 responses

Request body format:

```json
{
  "args": [
    "plain scalar",
    { "type": "jsonb", "value": { "example": true } },
    { "type": "array", "sqlType": "integer[]", "value": [1, 2, 3] }
  ]
}
```

Argument rules:

- scalars are passed through directly
- objects and arrays default to `jsonb`
- use the typed `array` wrapper when the PostgreSQL function expects a native SQL array

The list of exposed functions is defined in [src/routes/function-registry.js](</C:/wamp64/www/BrightFuture-/backend/src/routes/function-registry.js:1>) and discoverable at runtime via `GET /api/v1/functions`.

## Database

Database setup lives in [src/db/migrate.js](</C:/wamp64/www/BrightFuture-/backend/src/db/migrate.js:1>) and [src/db/index.js](</C:/wamp64/www/BrightFuture-/backend/src/db/index.js:1>).

### Pooling

- PostgreSQL uses a pooled `pg.Pool`
- pool sizing and timeouts are controlled via environment variables
- SSL is enabled automatically in production with `rejectUnauthorized: false`

### Current schema

`users`:

- UUID primary key
- unique active email via partial unique index
- bcrypt password hash
- RBAC role enum
- `is_active`
- `last_login_at`
- soft-delete fields: `deleted_at`, `deleted_by`
- timestamps

`audit_logs`:

- request-level audit trail
- actor and target user references
- action, resource type, status
- ip address, user agent
- arbitrary `metadata` JSONB
- timestamp

### Current indexing strategy

- active-email uniqueness: `users_email_unique_active_idx`
- user role lookups: `users_role_active_idx`
- recent login sorting: `users_last_login_idx`
- audit investigation indexes by actor, target, action, and request id

## Redis Usage

Configured in [src/db/redis.js](</C:/wamp64/www/BrightFuture-/backend/src/db/redis.js:1>) and [src/services/auth-service.js](</C:/wamp64/www/BrightFuture-/backend/src/services/auth-service.js:1>).

Redis is used for:

- active session storage
- per-user session lists
- access-token denylist
- IP/user/credential rate limits

The design is stateless at the application layer, which supports horizontal scaling as long as all app instances share the same Redis and PostgreSQL backends.

## Logging

Logging is configured in [src/lib/logger.js](</C:/wamp64/www/BrightFuture-/backend/src/lib/logger.js:1>).

Features:

- structured JSON logs
- request IDs via `X-Request-Id`
- request/response logging through `pino-http`
- redaction for auth headers, cookies, passwords, refresh tokens, and password hashes

## Error Format

Errors are returned as `application/problem+json` from [src/middleware/error-handler.js](</C:/wamp64/www/BrightFuture-/backend/src/middleware/error-handler.js:1>).

Example:

```json
{
  "type": "https://brightfuture.local/problems/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "Request body validation failed.",
  "instance": "/api/v1/auth/register",
  "traceId": "e5b2717d-b8b0-4b87-a75b-1e3f4a188d82",
  "errors": {
    "password": [
      "Password must include at least one special character."
    ]
  }
}
```

## Health Checks

Health routes live in [src/routes/health.js](</C:/wamp64/www/BrightFuture-/backend/src/routes/health.js:1>).

- `GET /health/live`: process liveness
- `GET /health/ready`: PostgreSQL + Redis readiness
- `GET /health`: redirects to readiness

`/health/ready` returns `503` if PostgreSQL or Redis is unavailable.

## Environment Variables

Reference file: [.env.example](</C:/wamp64/www/BrightFuture-/backend/.env.example:1>)

Required in practice:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `CORS_ORIGIN_WHITELIST`

Common settings:

- `PORT`
- `DATABASE_POOL_MAX`
- `DATABASE_POOL_MIN`
- `DATABASE_IDLE_TIMEOUT_MS`
- `DATABASE_CONNECTION_TIMEOUT_MS`
- `REDIS_KEY_PREFIX`
- `JWT_ACCESS_TTL`
- `JWT_REFRESH_TTL`
- `COOKIE_NAME_REFRESH`
- `COOKIE_SECURE`
- `TRUST_PROXY`
- `BCRYPT_COST`
- `LOG_LEVEL`

Optional admin bootstrap for `npm run db:seed`:

- `ADMIN_BOOTSTRAP_NAME`
- `ADMIN_BOOTSTRAP_EMAIL`
- `ADMIN_BOOTSTRAP_PASSWORD`

Production notes:

- use different access and refresh secrets
- set `COOKIE_SECURE=true`
- keep the CORS allowlist explicit
- use long random secrets, minimum 32 characters

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Create env file

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

### 3. Start PostgreSQL and Redis

Use local services or Docker Compose.

### 4. Run migration

```bash
npm run db:migrate
```

### 5. Seed the bootstrap admin

```bash
npm run db:seed
```

### 6. Start the API

```bash
npm run dev
```

The app listens on `http://localhost:5000` by default.

## Docker

Docker files:

- [Dockerfile](</C:/wamp64/www/BrightFuture-/backend/Dockerfile:1>)
- [docker-compose.yml](</C:/wamp64/www/BrightFuture-/backend/docker-compose.yml:1>)

Compose starts:

- API container on `5000`
- PostgreSQL 16 on `5432`
- Redis 7 on `6379`

Run:

```bash
docker compose up -d --build
```

The compose app command runs:

1. `node src/db/migrate.js`
2. `node src/db/seed.js`
3. `node src/index.js`

## Admin Bootstrap

`npm run db:seed` creates or updates the admin bootstrap account if all three values are valid:

- `ADMIN_BOOTSTRAP_NAME`
- `ADMIN_BOOTSTRAP_EMAIL`
- `ADMIN_BOOTSTRAP_PASSWORD`

The seed script:

- enforces the same strong-password policy as registration
- upgrades the bootstrap user to `admin`
- restores the user if it had been soft-deleted
- writes an audit log entry

## Important Caveats

- The older route files under `src/routes/` for students, finance, academics, library, and related modules are not mounted in `app.js`.
- Those older files use a different raw-table schema and are intentionally not part of the active production surface.
- The safe integration path for the broader school system is the function bridge plus the allowlist in `function-registry.js`.
- If you need the backend to own the full school domain natively, the next step is a deliberate schema migration and service-layer rewrite, not simply re-enabling the legacy routes.

## Quick Smoke Test

Register:

```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test Parent\",\"email\":\"parent@example.com\",\"password\":\"StrongPass!234\"}"
```

Login:

```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"parent@example.com\",\"password\":\"StrongPass!234\"}"
```

List exposed PostgreSQL functions as admin:

```bash
curl http://localhost:5000/api/v1/functions \
  -H "Authorization: Bearer <admin-access-token>"
```
