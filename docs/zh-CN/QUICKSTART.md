# 本地启动

[English](../en/QUICKSTART.md)

## 环境

需要 Node.js 24 LTS、npm、Docker Engine 和 Docker Compose。正常应用使用端口 `4310`，PostgreSQL 使用 `55432`；均仅监听本机。

在代码仓库根目录执行下列命令。已有工作区先按[发布检查](RELEASE-CHECK.md)备份；初始化不清空现有任务，重复播种也不会重置已有密码。

```sh
npm ci
docker compose up -d --wait db
npm run db:migrate
SEED_PASSWORD='OpenTask-Test-2026!' npm run db:seed
npm run build
npm start
```

另开一个终端，同一目录运行：

```sh
npm run worker
```

打开 <http://127.0.0.1:4310/>。API 与 worker 是两个进程，均需运行；`/health` 只检查 API 与数据库，不代表 worker 正常。

## 演示账号

以上播种命令在新数据库里创建以下测试账号，初始密码统一为 `OpenTask-Test-2026!`。

| 用户名  | 显示名称             | 在案例中的职责                           |
| ------- | -------------------- | ---------------------------------------- |
| leader  | Test Leader          | 建项目、最终创建审批、批准清单与调整约定 |
| manager | Test Project Manager | 项目负责人、需求负责人、实现任务验收人   |
| member  | Test Member          | 实现任务负责人                           |
| other   | Test Other Member    | 测试交付任务负责人、额外权限检查账号     |
| admin   | Test Administrator   | 管理账号；不会自动获得业务审批权限       |

项目负责人由项目指定，并不是独立的全局账号角色。初始界面为英文；顶部 Language 可切换为简体中文，刷新后仍保留选择。任务正文不会自动翻译。

## 使用独立案例环境

不想把示例放进正常工作区时，先运行：

```sh
npm run case:check
```

该命令使用固定的 `open_task_release_case` 数据库，自动迁移、播种、构建并运行 API 案例；在 `4318` 临时启动 API 和 worker，结束后关闭这些进程。已有 `4310` 工作区不受影响。运行前 PostgreSQL 必须已启动，`4318` 必须空闲；失败时看终端或 `artifacts/release-case/<run>/failure.json`。

每次运行新增一个带随机编号的模拟项目，不删除前次数据。API 成功输出 `Release case passed: 13 checks`，随后验证案例数据库的备份与独立恢复；最终命令退出 0 才表示整套检查通过。原始 API 报告位于 `artifacts/release-case/<run>/result.json`；最近一次 API 成功报告位于 `artifacts/release-case/latest.json`。该文件不代表随后的恢复步骤已通过，以终端恢复输出为准。界面需另按[案例教程](CASE-CSV-EXPORT.md)跟做。

查看保存的案例，在两个终端分别运行：

```sh
DATABASE_URL='postgres://open_task:open-task-local-only@127.0.0.1:55432/open_task_release_case' PORT=4319 npm start
```

```sh
DATABASE_URL='postgres://open_task:open-task-local-only@127.0.0.1:55432/open_task_release_case' npm run worker
```

打开 <http://127.0.0.1:4319/>，用同样的测试账号登录。报告中 `4318` 的任务链接可将端口改为 `4319`；正常数据库的任务编号和案例数据库相互独立。

## 停止与重新启动

API 和 worker 的终端按 Ctrl+C；需要停止数据库时运行 `docker compose stop db`。数据库卷为 `open-task-mvp_database`，停止服务不会删除数据。重新运行数据库启动、API、worker 命令即可。`docker compose down -v` 会删除数据库卷，不用于普通停止或案例重跑。

## 常见启动问题

| 现象                                 | 检查                                                                |
| ------------------------------------ | ------------------------------------------------------------------- |
| 登录失败                             | 是否使用正确的数据库与密码；播种不会重置已有账号密码                |
| 页面可打开，但逾期提醒没有更新       | 是否启动同一数据库上的 worker                                       |
| 新版本访问数据库报错                 | 先执行 `npm run db:migrate` 再启动                                  |
| 地址已被占用                         | 不替换已有服务；案例运行器会直接失败，查看占用进程后再运行          |
| 独立 Chrome 返回 `ERR_ACCESS_DENIED` | 用普通可访问本机的浏览器或 Codex 内置浏览器跟做，并单独记录 UI 结果 |

下一步：[CSV 导出案例](CASE-CSV-EXPORT.md)。
