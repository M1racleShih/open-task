# 开发与检查

[English](../en/DEVELOPMENT.md)

先按[本地启动](QUICKSTART.md)准备环境。应用使用 React 和 Vite、Fastify API、PostgreSQL，以及独立的 pg-boss worker。`ui-previews/` 是早期用于确认需求的界面演示。

## 构建与数据库检查

Compose 数据库运行时，在仓库根目录执行：

```sh
npm run typecheck
npm run build
bash scripts/test-db.sh
```

`test-db.sh` 会在需要时创建 `open_task_test`，执行迁移、初始化测试账号，再运行测试套件。它使用模拟数据，包含一次故意触发数据库错误的检查，用于验证事务回滚。

该数据库应只用于测试，不放入真实工作，也不要让集成测试连接生产数据。测试账号使用 `OpenTask-Test-2026!`；重复运行初始化不会重置已有密码。

## 为教程操作准备独立数据库

Compose 数据库运行时，**首次** 创建以下数据库。若提示已存在，保留它，继续迁移即可；这些命令不会清空正常工作区。

```sh
docker compose exec -T db createdb -U open_task open_task_walkthrough
export DATABASE_URL='postgres://open_task:open-task-local-only@127.0.0.1:55432/open_task_walkthrough'
npm run db:migrate
SEED_PASSWORD='OpenTask-Test-2026!' npm run db:seed
npm run build
PORT=4322 npm start
```

第二个终端运行：

```sh
DATABASE_URL='postgres://open_task:open-task-local-only@127.0.0.1:55432/open_task_walkthrough' npm run worker
```

打开 <http://127.0.0.1:4322/> 开始案例，两个进程必须连接同一数据库。任务编号由各数据库独立分配，跟做时按标题和 URL 定位，不必与截图编号一致。再次演练可换新项目名，也可继续已有示例。将截图日期换成实际未来日期；4322 被占用时，选其他空闲端口并打开对应 URL。

## 运行自动案例检查与查看结果

不想把示例放进正常工作区时，先确认 PostgreSQL 已启动、`4318` 端口空闲，再运行：

```sh
npm run case:check
```

该命令使用固定的 `open_task_release_case` 数据库，自动完成数据库迁移、初始化数据和生产构建，并运行 API 案例。它在 `4318` 临时启动 API 和 worker，结束后关闭这些进程，所以已有的 `4310` 工作区不受影响。失败时查看终端输出，或查看 `artifacts/release-case/<run>/failure.json`。

每次运行会新增一个带随机编号的模拟项目，不删除前次数据。API 部分成功后输出 `Release case passed: 13 checks`，之后还会验证案例数据库的备份与独立恢复。只有整条命令最终退出 0，才表示整套检查通过。原始 API 报告位于 `artifacts/release-case/<run>/result.json`；最近一次 API 成功报告位于 `artifacts/release-case/latest.json`。`latest.json` 只说明 API 案例通过，不代表随后的恢复步骤也通过；恢复结果以终端输出为准。界面流程需另按[案例教程](CASE-CSV-EXPORT.md)跟做。

查看保存的案例，在两个终端分别运行：

```sh
DATABASE_URL='postgres://open_task:open-task-local-only@127.0.0.1:55432/open_task_release_case' PORT=4319 npm start
```

```sh
DATABASE_URL='postgres://open_task:open-task-local-only@127.0.0.1:55432/open_task_release_case' npm run worker
```

打开 <http://127.0.0.1:4319/>，用同样的测试账号登录。报告中 `4318` 的任务链接可将端口改为 `4319`；正常数据库的任务编号和案例数据库相互独立。

## 浏览器检查

以下脚本需要 `/usr/bin/google-chrome`，以及使用初始化密码的本地测试账号：

```sh
npx tsx scripts/browser-check.ts
npx tsx scripts/browser-workflow.ts
```

两个脚本都访问 `http://127.0.0.1:4310` 上运行的应用，并在该应用实际连接的数据库中创建带标记的测试记录。它们不会自动选择独立数据库，只应对用于验收检查的工作区运行。截图和运行记录保存在 `artifacts/` 下。

### 模拟 API 的任务阶段提示检查

```sh
npx tsx --test tests/stageFeedback.test.ts
npx tsx scripts/browser-stage-feedback.ts
```

浏览器脚本在 `127.0.0.1:4351` 启动仅用于模拟数据的 Vite 预览，拦截所有 API 请求，结束时关闭预览，不连接数据库。也可用 `STAGE_TEST_URL` 指向已运行的本机预览。检查覆盖服务端确认回执、读取／操作失败、轮询去重、任务／账号切换、慢响应、有界事件归因、筛选移除、清单草稿、稳定的读屏播报区，以及中英文／明暗主题在 1440、820、390 像素下的布局。需要 `/usr/bin/google-chrome`。合成数据截图与结果保存在 `artifacts/stage-feedback/`。

### 独立数据库中的时间筛选检查

执行 `bash scripts/test-db.sh` 和 `npm run build` 后，启动测试 API：

```sh
DATABASE_URL='postgres://open_task:open-task-local-only@127.0.0.1:55432/open_task_test' PORT=4316 npm start
```

另开终端运行：

```sh
DATABASE_URL='postgres://open_task:open-task-local-only@127.0.0.1:55432/open_task_test' npx tsx scripts/browser-time-filter.ts
```

脚本要求 `DATABASE_URL` 以 `/open_task_test` 结尾。浏览器默认访问 `http://127.0.0.1:4316`；`TIME_TEST_URL` 可指定另一个独立服务。URL 与数据库应指向同一个测试环境。测试记录带有标记，截图和结果保存在 `artifacts/time-filter/`。检查结束后，用 Ctrl+C 停止临时 API。

若独立 Chrome 无法访问本机地址，可使用能够访问独立服务的浏览器，并记录实际检查项。人工浏览器检查不能证明脚本断言已经通过。

## 负载测试

先运行数据库检查，生成集成测试数据，再确保端口 `4312` 空闲：

```sh
DATABASE_URL='postgres://open_task:open-task-local-only@127.0.0.1:55432/open_task_test' npx tsx scripts/performance.ts
```

脚本要求使用 `open_task_test`，在 `4312` 启动独立 API，将此前的性能测试任务替换为 5,000 条带标记的数据，并使用 30 个测试用户。

默认运行五分钟，可用 `PERF_SECONDS` 调整时长。请求覆盖任务列表、详情和评论，结果保存在 `artifacts/performance.json`。结果只说明该机器、数据集和请求组合下的表现。

## 文档检查

```sh
npm run docs:build
npx tsx --test tests/docs.test.ts
```

命令生成 `artifacts/docs/` 中的离线 HTML，并检查页面配对、本地链接和流程图源码。两种语言应一起维护。语言同步、预览和流程图生成方法见[文档维护](MAINTAINING.md)。

## 备份与仓库结构

备份、独立恢复和升级步骤见[发布检查](RELEASE-CHECK.md)。认证、写入请求头和请求字段见 [API v1](API.md)。

应用代码位于 `server/`、`shared/` 和 `web/`；测试和运行脚本位于 `tests/` 和 `scripts/`。`docs/` 包含使用、开发和发布文档，`ui-previews/` 包含早期界面演示。

Compose 项目名为 `open-task-mvp`；端口 `4173` 和 `4174` 属于独立的界面演示。默认 npm 缓存只读时，`.npmrc` 会选用 `/tmp/open-task-npm`。

## 维护图解教程

[截图记录](SCREENSHOTS.md)区分真实浏览器操作、只看表单和依据代码的说明。在 `docs/assets/` 保留原图、裁切/编号坐标和界面语言登记。运行 `npx tsx scripts/annotate-doc-screenshots.ts` 重建标注，再构建并检查两种语言的桌面与手机页面；此命令不会重放应用流程。完整过程见[文档维护](MAINTAINING.md)。
