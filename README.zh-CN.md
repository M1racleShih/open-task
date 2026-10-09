<p align="center">
  <img src="web/public/brand/opentask-cat-logo.png" width="180" alt="OpenTask 猫咪标志">
</p>

# OpenTask

[English](README.md) · 简体中文

OpenTask 帮助团队说清楚要交付什么、确认由谁执行，再对交付结果进行验收。每个任务把约定、进展、变更和验收记录放在一起，让团队能够了解当时约定了什么，以及后来发生了什么。

当前发布候选为 **0.1.0-alpha**，本机运行、单团队的首版（MVP），界面支持英文和简体中文。见[版本说明](docs/zh-CN/RELEASE-NOTES.md)。

## 可以做什么

| 能力         | 如何帮助团队                                                                     |
| ------------ | -------------------------------------------------------------------------------- |
| 约定工作     | 写清预期结果、验收标准、负责人、验收人和期限，由相应人员审批任务创建。           |
| 跟进执行     | 使用经批准的执行清单，记录正式进展，提出阻塞协助请求；待办显示下一步需要谁处理。 |
| 验收交付     | 提交成果及证据链接，通过或退回成果，并保留历次提交与验收理由。                   |
| 理解任务关系 | 用项目任务树和图谱查看父子、前置和关联任务，按项目、状态、关键词与时间筛选。     |

语言和浅色／深色主题选择保存在浏览器中。任务正文不会自动翻译。日期均按 **Asia/Shanghai**（上海时间）输入和显示。

## 设计理念如何体现在使用中

以下规则说明 OpenTask 如何处理任务中的责任、变更和交付：

- **负责人亲自接受任务。** 把 CSV 导出任务分配给某个人后，任务仍在等待接受。负责人读过预期结果和期限后再接受；创建审批和执行承诺是两个决定。
- **由验收人确认完成。** 勾完执行清单有助于了解做了哪些工作。任务要完成，还需要负责人提交成果，由验收人按约定标准通过。
- **负责人确认变更。** 团队负责人调整范围或期限后，执行负责人确认新版本。更换执行负责人时，新负责人需要重新接受任务。
- **返工保留在原任务中。** 验收人退回成果后，负责人在同一任务中改进并重新提交。双方仍可查看之前的成果和退回理由。
- **父子关系组织工作，前置关系约束验收。** 父任务用来组织拆分出的任务。前置关系表示：另一个任务的成果必须先通过验收，本任务的成果才能通过；它不阻止提前开始工作。子任务完成也不会自动让父任务完成。
- **后续工作另建任务。** 已完成和已取消任务不能重新打开。后续修复另建任务并关联原任务，保留之前的交付结论。

审批路线、角色与完整流程见[使用指南](docs/zh-CN/USER-GUIDE.md)。

## 快速启动

需要 **Node.js 24 LTS**、npm、Docker Engine 和 Docker Compose。端口 `4310`（应用）和 `55432`（PostgreSQL）必须空闲，两项服务均仅监听本机。已有工作区应在[更新前备份](docs/zh-CN/RELEASE-CHECK.md)。

在仓库根目录运行：

```sh
npm ci
docker compose up -d --wait db
npm run db:migrate
SEED_PASSWORD='OpenTask-Test-2026!' npm run db:seed
npm run build
npm start
```

另开一个终端，在同一目录运行：

```sh
npm run worker
```

打开 <http://127.0.0.1:4310/>。**API 与 worker 都需要保持运行。** worker 处理后台任务，包括逾期提醒。

上述初始化命令在新数据库中创建以下本地测试账号，初始密码统一为 **`OpenTask-Test-2026!`**：

| 用户名    | 职责                                     |
| --------- | ---------------------------------------- |
| `leader`  | 团队负责人；创建项目并进行最终创建审批。 |
| `manager` | 成员；可被指定为某个项目的负责人。       |
| `member`  | 成员；可负责并执行任务。                 |
| `other`   | 用于协作和权限检查的额外成员。           |
| `admin`   | 账号管理员；该角色不授予业务审批权限。   |

迁移和账号初始化可重复执行，重复初始化不会重置已有密码。界面默认英文，可通过顶部 **Language** 切换到简体中文。

API 和 worker 的终端按 Ctrl+C，再运行 `docker compose stop db` 停止 PostgreSQL。数据保存在 `open-task-mvp_database` 卷中。**`docker compose down -v` 会删除这些数据。** 重启、故障排查及独立案例环境见[本地启动](docs/zh-CN/QUICKSTART.md)。

## 文档

完整文档提供[简体中文](docs/zh-CN/README.md)与 [English](docs/en/README.md)，每页均可切换到另一语言的对应页面。

| 阅读                                                                                    | 内容                                         |
| --------------------------------------------------------------------------------------- | -------------------------------------------- |
| [使用指南](docs/zh-CN/USER-GUIDE.md)                                                    | 角色、审批、执行、变更、验收与任务关系。     |
| [CSV 导出案例](docs/zh-CN/CASE-CSV-EXPORT.md)                                           | 使用模拟账号和任务走完一次交付。             |
| [开发指南](docs/zh-CN/DEVELOPMENT.md)                                                   | 构建命令、数据库测试、浏览器检查和负载测试。 |
| [API v1](docs/zh-CN/API.md)                                                             | 会话、写入要求、接口和时间筛选。             |
| [发布检查](docs/zh-CN/RELEASE-CHECK.md) · [验收报告](docs/zh-CN/RELEASE-CASE-RESULT.md) | 备份恢复、实际检查记录、证据与尚存限制。     |

生成可离线阅读的双语 HTML 文档：

```sh
npm run docs:build
```

输出入口为 `artifacts/docs/index.html`。预览方式和维护规则见[文档入口](docs/README.md)。

## 开发

应用使用 React 和 Vite、Fastify API、PostgreSQL，以及独立的 pg-boss worker。`ui-previews/` 保存早期用于确认需求的界面演示。

```sh
npm run typecheck
npm run build
bash scripts/test-db.sh
```

数据库检查使用 `open_task_test` 中的模拟数据。Compose 数据库运行时，`npm run case:check` 会在 `open_task_release_case` 中检查 API 流程及备份恢复。各项检查的范围与前提见[开发指南](docs/zh-CN/DEVELOPMENT.md)。

## 当前范围与许可

当前版本供一个团队在本机运行。非草稿任务对全团队可见，项目成员设置不会让任务变成私有。尚不包含外部身份或目录登录、文件上传、对外消息发送，以及模型或 Agent 集成。真实团队的审批负担、长期使用体验与容量仍需试用验证。

产品规格和历史评审记录位于独立的 [open-task-specs 仓库](../open-task-specs/README.md)。该链接假定两个仓库在同一父目录下；构建和运行 OpenTask 不需要规格仓库。

OpenTask 采用 [Apache-2.0](LICENSE) 许可。[第三方声明](docs/zh-CN/THIRD-PARTY-NOTICES.md)说明独立的 Lucide ISC 与 Feather MIT 图标许可；应用还在 `/lucide-LICENSE.txt` 分发完整 Lucide 许可文本。
