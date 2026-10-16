# API v1

[简体中文](../zh-CN/API.md)

The frontend is the first client. The same-origin API is under `/api/v1`. Sessions use an HttpOnly, SameSite=Strict cookie. Mutation calls require the session's `X-CSRF-Token`; business writes also require an `Idempotency-Key` unique to the logical operation. Retrying the same payload with the same key returns the original result.

Task actions carry the viewed `version`. Result review also carries `submissionId`, and checklist toggles carry `expectedDone`. Lists use bounded cursor pagination; task and event lists return `{items,nextCursor}`. Errors use `{error:{code,requestId,details}}` with 401/403/404/409/422/429/500 statuses. The frontend translates stable error codes. The OpenAPI description is available at `/api/v1/openapi.json` after login. Deployments with `OPEN_TASK_HIDE_API_DOCS=1` do not expose this description; authenticated requests return 404.

PostgreSQL transactions provide read-after-write consistency. Business mutations share a short advisory lock so relation edits cannot race result acceptance. No external calls run inside business transactions. Schema evolution is additive within v1.

| Method / path under /api/v1     | Request / response                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| POST /sessions                  | `{username,password}` → `{user,csrf}` and session cookie                                  |
| DELETE /sessions                | Revokes the current session                                                               |
| GET /me                         | `{user,csrf}`                                                                             |
| GET /users                      | Public team identity fields; password hashes excluded                                     |
| POST /users                     | Admin: `{username,name,password,roles}`                                                   |
| PATCH /users/:id                | Admin: `{active}`; outstanding responsibilities block disabling                           |
| GET /projects                   | `{id,name,managerId,memberIds}[]`                                                         |
| POST /projects                  | Leader: `{name,managerId,memberIds}`                                                      |
| PATCH /projects/:id             | Manager: `{memberIds}`; leader may transfer `managerId` after responsibilities are moved  |
| GET /tasks                      | `cursor`, `limit` ≤ 200, `search`, `projectId` → `{items,nextCursor}`                     |
| POST /tasks                     | `title` required; optional agreement fields from [shared/model.ts](../../shared/model.ts) |
| GET /tasks/:id                  | `{task,relations}` filtered by draft visibility                                           |
| DELETE /tasks/:id               | Only the creator's unsubmitted draft                                                      |
| POST /tasks/:id/actions/:action | `{version,...actionFields}` → updated task                                                |
| POST /tasks/:id/relations       | `{version,targetId,kind,reason,remove?}`                                                  |
| GET /relations                  | UUID `cursor`, `limit` ≤ 1000 → `{items,nextCursor}`                                      |
| GET /events                     | Cursor, limit ≤ 200, taskId/projectId/actorId/search filters                              |
| GET /followups                  | Pending actions visible to the current handler or team leader                                |

Action fields are validated on the server. `edit` and `adjust` use `fields` containing all agreement fields; adjust additionally requires reason and confirmBy. `progress` requires text, next and feedbackBy. `submitResult` requires text, reviewBy and optional links. `pass` and `returnResult` require submissionId; return requires reason and feedbackBy. Checklist requests carry stable item IDs, text, scopeChanged and reason; approval carries requestId and confirmBy for scope changes. Relation kinds are parent (child → parent), dependency (dependent → prerequisite), and related (symmetric).

Permission failures do not mutate state. Invalid input is 422, stale version and graph conflicts are 409, hidden/private resources are 404. The same idempotency key with a different payload is 409. Database failures roll back task, event, followups and queue insertion together.

### Project colors and default people (2026-09-10)

Projects now return `color` as an exact six-digit CSS hex color. `POST /projects` accepts an optional `color` (default `#7292c7`). `PATCH /projects/:id` accepts a color-only patch and preserves omitted member/manager fields; the project manager or leader may change color, and only leader may transfer management. Invalid colors return 422 and unauthorized writes return 403 through the existing error envelope. Session, CSRF and idempotency requirements are unchanged. Updates lock the project row so independent partial changes do not overwrite one another. Migration `002_project_color.sql` is additive and repeatable.

Task creation and draft editing now validate any populated owner/reviewer fields immediately. Missing draft assignments remain permitted. If an owner is selected and reviewer omitted, the existing role/project default resolves on the server. Both identifiers must be active team accounts, and only a leader may self-review. The product permits explicit valid reviewers and does not restrict owners to project members; project manager is not a universal task owner. Submission/issue/adjustment retain the complete assignment validation. The form recomputes the default reviewer when project/owner changes, including the global creation path.

## Task plans and time filtering (2026-10-08)

### Planned start

`plannedStart` is an optional agreement timestamp (missing or empty means unspecified). `deadline` remains the only plan end and is required on issue/submission. A populated start cannot exceed deadline; equality is allowed. Create/edit/adjust validate these dates. Start participates in versions, confirmed terms, audit differences and leader adjustment/owner confirmation. Legacy task and version JSON is read without rewriting historic records; a missing start displays as empty. An older client omitting start during edits preserves the current start.

### Task list filters

`GET /tasks` accepts `time=all|week|month|custom` (default all), `start` and `end` as inclusive `YYYY-MM-DD` Shanghai dates for custom, `includeUnscheduled=true|false`, `includeEarlier=true|false`, and an optional `stage`. Weeks run Monday through Sunday. Relative ranges are resolved on each request. Intervals match when latest planned start/deadline overlap; deadline-only tasks match that instant. Unscheduled drafts and unfinished deadlines before the range are controlled by the two flags; all-time includes everything. Search, project and visibility apply before cursor pagination.

### Task list response fields

The response adds `total` (all matches), `counts` (per-project total/done/reviewing/blocked), and `context` (readable ancestors of the displayed page). `items` remains the matching page; `nextCursor` remains a task number. Earlier unfinished items carry `viewSource: "earlier"`; context carries `viewSource: "context"`. These fields are computed in the response only and are never written to task records. Context neither consumes the cursor nor increases match counts, never includes unreadable private drafts, and does not expand descendants.

### Event list filters

`GET /events` accepts the same time/status filters. `taskSearch` restricts events to the same matching task search as the tree/graph; the existing `search` still searches event notes/titles for API compatibility. A selected `taskId` returns complete readable history independently of viewing filters. Followups remain unfiltered and include `taskTitle`/`taskNumber` so out-of-range notices keep understandable labels.

### Related-to-me filter

`GET /tasks` and `GET /events` accept optional `related`, a comma-separated selection of `owned` (ownerId), `created` (creatorId or issuerId), and `reviewing` (reviewerId or any approvalIds entry). Optional `relatedUserId` selects one member by UUID and defaults to the authenticated user for existing callers. It only applies when `related` is present; unknown UUIDs match no task relationships. Visibility always comes from the authenticated viewer, so selecting a member cannot reveal that member's private drafts or private ancestors. Invalid UUIDs return 422. Selected scopes combine with OR and results are deduplicated. Responsibilities apply at every stage, including future approval turns and completed tasks. Omit the parameter for all visible tasks; `related=` matches none. Invalid scopes return 422. Maximum length is 40 characters and at most three entries are accepted.

Relationship filtering composes with search, project, stage and time before pagination and counting. Visible ancestors remain separate context, without consuming match counts or cursors. Aggregate events use the same relationship selection; an explicit `taskId` returns complete visible history regardless of relationship filters. Existing private-draft visibility still applies.

### Time preference endpoint

`GET /time-preferences` returns `{global: TimeFilter, projects: Record<projectId, TimeFilter>}` for the session user. `PUT /time-preferences` accepts `{scope: "global" | projectId, filter: TimeFilter | null}`, with the usual CSRF and idempotency headers. A null project filter removes its override; global cannot be null. There is no actor selector. `TimeFilter` contains `mode`, `start`, `end`, `includeUnscheduled`, `includeEarlier`. Project overrides replace the entire global filter without intersection. Migration `003_time_preferences.sql` is additive and repeatable.
