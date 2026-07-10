# API

Every read/write the wall UI and companion PWA do goes through a documented, versioned
REST API — nothing is a private, undocumented implementation detail.

- **Interactive docs (Swagger UI):** `http://localhost:8080/api/docs`
- **Raw OpenAPI 3.1 spec:** `http://localhost:8080/api/openapi.yaml` (also
  [`openapi.yaml`](https://github.com/alitarraf/openfamhub/blob/main/openapi.yaml) in the
  repo — load it into Postman, Insomnia, or any OpenAPI-aware client/codegen)

## Design notes

- **Read endpoints degrade to `503`, not an error page.** An unconfigured or unreachable
  source returns `503` with `{ "error": "..." }`; the frontend interprets that as "fall
  back to demo data," not "something is broken."
- **Data-source routes are provider-backed, not vendor-locked.** Tasks, calendar, meals,
  budget, weather, and photos each go through a small registry
  (`server/providers/registry.js`) that selects one implementation per domain. Swapping
  Todoist for a different task backend, for example, is a new file that implements the
  same exported functions plus a one-line registry entry — not a rewrite of
  `server/index.js`.
- **Credentials never reach the browser.** Every third-party token/credential lives in
  `.env`, read server-side only.
- **`GET /api/members`** is the single source of truth for the family roster (id, name,
  color — no secrets) — useful if you want to build your own client or dashboard against
  this backend.

## A minimal example

```bash
# Family roster
curl http://localhost:8080/api/members

# Today's weather
curl http://localhost:8080/api/weather

# Complete a Routine·Chore task (awards a point)
curl -X POST http://localhost:8080/api/board/routine/<task-id>/close \
  -H 'Content-Type: application/json' \
  -d '{"memberId":"kid1"}'
```

See the full [OpenAPI spec](http://localhost:8080/api/openapi.yaml) for every route,
request/response shape, and status code.
