# API v1

[English](../en/API.md)

前端是第一个客户端，同源 API 位于 `/api/v1`。会话使用带 HttpOnly 和 SameSite=Strict 属性的 cookie。写入请求需要当前会话的 `X-CSRF-Token`；业务写入还需要 `Idempotency-Key`，每次独立业务操作使用一个唯一键。同一键配同一载荷重试时，返回原操作结果。

任务操作携带用户当前查看的 `version`。成果验收还需 `submissionId`，清单勾选还需 `expectedDone`。列表采用有数量上限的游标分页；任务与事件列表返回 `{items,nextCursor}`。错误结构为 `{error:{code,requestId,details}}`，状态码包括 401/403/404/409/422/429/500。前端将稳定错误码转为界面语言。登录后可通过 `/api/v1/openapi.json` 获取 OpenAPI 描述。

PostgreSQL 事务保证写入完成后能读到相应结果。业务写入共用一个短时 advisory lock（咨询锁），避免关系编辑与成果验收同时发生而破坏约束。业务事务内不进行外部调用；v1 内的数据结构按增量方式演进。

| /api/v1 下的方法与路径          | 请求 / 响应                                                           |
| ------------------------------- | --------------------------------------------------------------------- |
| POST /sessions                  | `{username,password}` → `{user,csrf}` 与会话 cookie                   |
| DELETE /sessions                | 撤销当前会话                                                          |
| GET /me                         | `{user,csrf}`                                                         |
| GET /users                      | 团队公开身份字段；不包含密码哈希                                      |
| POST /users                     | 管理员：`{username,name,password,roles}`                              |
| PATCH /users/:id                | 管理员：`{active}`；未完成职责会阻止停用                              |
| GET /projects                   | `{id,name,managerId,memberIds}[]`                                     |
| POST /projects                  | 团队负责人：`{name,managerId,memberIds}`                              |
| PATCH /projects/:id             | 项目负责人：`{memberIds}`；团队负责人可在职责转移后变更 `managerId`   |
| GET /tasks                      | `cursor`、`limit` ≤ 200、`search`、`projectId` → `{items,nextCursor}` |
| POST /tasks                     | `title` 必填；可选约定字段见 [shared/model.ts](../../shared/model.ts) |
| GET /tasks/:id                  | `{task,relations}`，按草稿可见权限过滤                                |
| DELETE /tasks/:id               | 仅限创建者尚未提交的草稿                                              |
| POST /tasks/:id/actions/:action | `{version,...actionFields}` → 更新后的任务                            |
| POST /tasks/:id/relations       | `{version,targetId,kind,reason,remove?}`                              |
| GET /relations                  | UUID `cursor`、`limit` ≤ 1000 → `{items,nextCursor}`                  |
| GET /events                     | 游标、limit ≤ 200，以及 taskId/projectId/actorId/search 筛选          |
| GET /followups                  | 当前处理人或团队负责人可见的活跃事实                                  |

操作字段由服务端校验。`edit` 和 `adjust` 的 `fields` 包含全部约定字段；adjust 还需要 reason 和 confirmBy。`progress` 需要 text、next 和 feedbackBy。`submitResult` 需要 text、reviewBy，以及可选 links。`pass` 和 `returnResult` 需要 submissionId；退回还需要 reason 和 feedbackBy。清单申请包含稳定条目 ID、text、scopeChanged 和 reason；批准包含 requestId，涉及范围变更时还需 confirmBy。关系类型为 parent（子 → 父）、dependency（后置 → 前置）和 related（对称）。

权限失败不改变状态。无效输入为 422，版本过期和图关系冲突为 409，隐藏或私有资源为 404。同一幂等键配不同载荷返回 409。数据库失败时，任务、事件、待办与队列插入一并回滚。

### 界面完善新增项（2026-09-10）

项目现在返回精确六位 CSS 十六进制颜色 `color`。`POST /projects` 接受可选 `color`（默认 `#7292c7`）。`PATCH /projects/:id` 接受仅颜色补丁，并保留省略的成员和负责人字段；项目负责人或团队负责人可改色，只有团队负责人能转移项目管理职责。无效颜色返回 422，越权写入通过既有错误结构返回 403。会话、CSRF 与幂等要求不变。更新锁定项目行，防止独立局部变更互相覆盖。迁移 `002_project_color.sql` 为增量且可重复执行。

任务创建和草稿编辑会立即校验已填写的负责人、验收人字段。草稿仍允许不分配人员。选择负责人但省略验收人时，服务端按既有角色和项目规则确定默认值。两个标识都必须指向活跃团队账号，只有团队负责人能自验收。产品允许显式指定有效验收人，不把负责人限定为项目成员；项目负责人并非所有任务的固定负责人。提交审核、下发和调整仍执行完整分配校验。项目或负责人变化时，表单重新计算默认验收人，包括全局新建入口。

## 任务计划与时间筛选（2026-10-08）

`plannedStart` 是可选约定时间戳（缺失或为空表示未设置）。`deadline` 仍是唯一计划结束时间，下发或提交审核时必填。已填开始时间不能晚于 deadline，可以相等。创建、编辑、调整均校验日期。开始时间参与版本、已确认约定、审计差异，以及团队负责人调整与负责人确认。旧任务与版本 JSON 可直接读取，不改写历史记录；缺失开始时间显示为空。旧客户端编辑时省略开始时间会保留当前值。

`GET /tasks` 接受 `time=all|week|month|custom`（默认 all）；自定义范围的 `start` 和 `end` 为含首尾的上海自然日 `YYYY-MM-DD`；还接受 `includeUnscheduled=true|false`、`includeEarlier=true|false` 和可选 `stage`。一周为周一至周日。相对范围每次请求重新计算。最新计划开始与交付期限区间重叠即匹配；仅有 deadline 的任务按该时间点匹配。无日期草稿与范围之前未完成的任务受两个开关控制；全部时间包含所有任务。搜索、项目和可见权限在游标分页前应用。

响应新增 `total`（全部匹配数）、`counts`（各项目 total/done/reviewing/blocked 数）与 `context`（当前页可读祖先）。`items` 仍为匹配页；`nextCursor` 仍为任务编号。此前未完成任务附带 `viewSource: "earlier"`，上下文附带 `viewSource: "context"`。这些仅为读取投影，不保存为任务字段。上下文不消耗游标、不增加匹配数，不包含不可读私有草稿，也不扩展后代。

`GET /events` 接受相同时间与状态筛选。`taskSearch` 将事件限制到与任务树和图谱相同的任务搜索范围；既有 `search` 仍搜索事件说明或标题，保持 API 兼容性。指定 `taskId` 时返回完整可读历史，不受视图筛选影响。待办不受筛选影响，并包含 `taskTitle`/`taskNumber`，让范围外提醒仍有可理解的标签。

`GET /time-preferences` 返回当前会话用户的 `{global: TimeFilter, projects: Record<projectId, TimeFilter>}`。`PUT /time-preferences` 接受 `{scope: "global" | projectId, filter: TimeFilter | null}`，使用常规 CSRF 与幂等请求头。项目 filter 为 null 时删除覆盖；global 不能为 null。没有操作人选择参数。`TimeFilter` 包含 `mode`、`start`、`end`、`includeUnscheduled`、`includeEarlier`。项目覆盖完整替代全局筛选，不求交集。迁移 `003_time_preferences.sql` 为增量且可重复执行。
