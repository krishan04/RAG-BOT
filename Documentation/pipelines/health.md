# Pipeline: Health — `GET /api/health`

> Minimal liveness probe proving Django + FastAPI are wired in one process.

## Frontend

```text
NavRail.tsx (mounted once)
 └── useEffect → getHealth()
       │  fetch('/api/health') → Vite proxy → :8000
       └── renders backend status pill (ok / error)
```

## Backend handler

```text
backend/fastapi_app/routers/health.py :: health()
 └── returns HealthResponse(
        status="ok",
        api="fastapi",
        django=django.get_version(),   # e.g. "5.2.17"
        version="0.1.0")
```

## Response

```json
{ "status": "ok", "api": "fastapi", "django": "5.2.17", "version": "0.1.0" }
```

## Errors

None. Any 200 means both frameworks imported successfully in one process.

## Key files

| Role | File |
| ---- | ---- |
| UI | `frontend/src/components/layout/NavRail.tsx` |
| API client | `frontend/src/api/client.ts` |
| Router | `backend/fastapi_app/routers/health.py` |
| Schema | `backend/fastapi_app/schemas.py` (`HealthResponse`) |