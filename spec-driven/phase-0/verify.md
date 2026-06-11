# Phase 0 — Manual verification

Automated AC coverage: run `npm run test:phase-0` (see `ac*.test.ts`).

Optional manual curls (requires `wrangler dev`):

```bash
npm install
npm run dev
```

Base URL: `http://127.0.0.1:8787`

## AC-1 — Happy path (200)

```bash
curl -s http://127.0.0.1:8787/incident/INC-4421/naive
# HTTP 200 — body includes metrics, deploys, health, tickets, docs
```

## AC-2 — Tickets 500 (502)

Restart dev with `TICKETS_MODE=500`:

```bash
npx wrangler dev --var TICKETS_MODE:500
curl -s http://127.0.0.1:8787/incident/INC-4421/naive
# HTTP 502 — failedOrigin: tickets-api
```

## AC-3 — Tickets timeout (502)

```bash
npx wrangler dev --var TICKETS_MODE:timeout
curl -s http://127.0.0.1:8787/incident/INC-4421/naive
# HTTP 502 — failedOrigin: tickets-api (after ~5s)
```

## AC-4 — Metrics rate limit (502)

```bash
# With default METRICS_RATE_LIMIT=10, burst mock metrics past limit:
for i in $(seq 1 12); do
  curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8787/mock/metrics-api/INC-4421
done
curl -s http://127.0.0.1:8787/incident/INC-4421/naive
# HTTP 502 — failedOrigin: metrics-api
```

## AC-5 — Mock routes in isolation

```bash
for o in metrics-api deploys-api health-api tickets-api docs-api; do
  curl -s -o /dev/null -w "$o %{http_code}\n" "http://127.0.0.1:8787/mock/$o/INC-4421"
done
```

## AC-6 — Invalid incident id (400)

```bash
curl -s http://127.0.0.1:8787/incident/BAD/naive
# HTTP 400 — invalid_incident_id (requires INC- prefix)
```

## AC-7 — Bare path (404)

```bash
curl -s http://127.0.0.1:8787/incident/INC-4421
# HTTP 404 — not_found
```

## Health

```bash
curl -s http://127.0.0.1:8787/health
# {"ok":true}
```

## Typecheck

```bash
npm run typecheck
```
