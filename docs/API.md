# API v1

The frontend is the first client. Cookie sessions, CSRF headers and idempotency keys are required as described in README. Read-after-write consistency is provided by PostgreSQL transactions; business mutations share a short advisory lock so relation edits cannot race result acceptance. No external calls run inside business transactions. Schema evolution is additive within v1.

| Method / path under /api/v1 | Request / response |
| --- | --- |
| POST /sessions | `{username,password}` → `{user,csrf}` and session cookie |
| DELETE /sessions | Revokes the current session |
| GET /me | `{user,csrf}` |
| GET /users | Public team identity fields; password hashes excluded |
| POST /users | Admin: `{username,name,password,roles}` |
| PATCH /users/:id | Admin: `{active}`; outstanding responsibilities block disabling |
| GET /projects | `{id,name,managerId,memberIds}[]` |
| POST /projects | Leader: `{name,managerId,memberIds}` |
| PATCH /projects/:id | Manager: `{memberIds}`; leader may transfer `managerId` after responsibilities are moved |
| GET /tasks | `cursor`, `limit` ≤ 200, `search`, `projectId` → `{items,nextCursor}` |
| POST /tasks | `title` required; optional agreement fields from shared/model.ts |
| GET /tasks/:id | `{task,relations}` filtered by draft visibility |
| DELETE /tasks/:id | Only the creator's unsubmitted draft |
| POST /tasks/:id/actions/:action | `{version,...actionFields}` → updated task |
| POST /tasks/:id/relations | `{version,targetId,kind,reason,remove?}` |
| GET /relations | UUID `cursor`, `limit` ≤ 1000 → `{items,nextCursor}` |
| GET /events | Cursor, limit ≤ 200, taskId/projectId/actorId/search filters |
| GET /followups | Active facts visible to the current handler or team leader |

Action fields are validated on the server. `edit` and `adjust` use `fields` containing all agreement fields; adjust additionally requires reason and confirmBy. `progress` requires text, next and feedbackBy. `submitResult` requires text, reviewBy and optional links. `pass` and `returnResult` require submissionId; return requires reason and feedbackBy. Checklist requests carry stable item IDs, text, scopeChanged and reason; approval carries requestId and confirmBy for scope changes. Relation kinds are parent (child → parent), dependency (dependent → prerequisite), and related (symmetric).

Permission failures do not mutate state. Invalid input is 422, stale version and graph conflicts are 409, hidden/private resources are 404. The same idempotency key with a different payload is 409. Database failures roll back task, event, followups and queue insertion together.

### UI polish additions (2026-09-10)

Projects now return `color` as an exact six-digit CSS hex color. `POST /projects` accepts an optional `color` (default `#7292c7`). `PATCH /projects/:id` accepts a color-only patch and preserves omitted member/manager fields; the project manager or leader may change color, and only leader may transfer management. Invalid colors return 422 and unauthorized writes return 403 through the existing error envelope. Session, CSRF and idempotency requirements are unchanged. Updates lock the project row so independent partial changes do not overwrite one another. Migration `002_project_color.sql` is additive and repeatable.

Task creation and draft editing now validate any populated owner/reviewer fields immediately. Missing draft assignments remain permitted. If an owner is selected and reviewer omitted, the existing role/project default resolves on the server. Both identifiers must be active team accounts, and only a leader may self-review. The product permits explicit valid reviewers and does not restrict owners to project members; project manager is not a universal task owner. Submission/issue/adjustment retain the complete assignment validation. The form recomputes the default reviewer when project/owner changes, including the global creation path.
