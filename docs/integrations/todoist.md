# Todoist

Powers [Tasks & Chores](/guide/tasks) — both boards are **one shared Todoist
project each, split by assignee**. Every family member (including kids) needs their own
Todoist account with collaborator access to both projects.

## Setup

```bash [.env]
TODOIST_TOKEN=            # Todoist → Settings → Integrations → Developer → API token
TODOIST_TODO_PROJECT=     # project name for the To-do board (no points)
TODOIST_ROUTINE_PROJECT=  # project name for the Routine·Chore board (awards points)
```

Then, for each roster entry's `id` (see [First-time setup](/first-time-setup)),
map their Todoist user id:

```bash [.env]
TODOIST_UID_DAD=
TODOIST_UID_KID1=
```

Find each person's id once the token + project names are set:

```bash
curl -s localhost:8080/api/todoist/collaborators
```

A member with no UID mapped just doesn't get a column — everything else keeps
working.

## API note

Uses Todoist's unified `/api/v1` REST endpoints (the older `/rest/v2` surface returns
HTTP 410). The token never reaches the browser — every Todoist call happens
server-side.
