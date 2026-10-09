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

该数据库应只用于测试，不放入真实工作，也不要让集成测试连接生产数据。测试账号使用 `OpenTask-Test-2026!`，重复初始化不会重置已有密码。

## 发布案例

```sh
npm run case:check
```

运行前 Compose 数据库必须已启动，端口 `4318` 必须空闲。命令使用 `open_task_release_case`，临时启动 API 与 worker，验证 13 组 API 断言后，再检查备份和独立恢复。每次新增明确标记的模拟项目，保留此前案例数据。最终退出码为 0 才表示整条命令通过；界面验收需单独进行。查看保存的案例见[本地启动](QUICKSTART.md)，已有证据见[验收报告](RELEASE-CASE-RESULT.md)。

## 浏览器检查

以下脚本需要 `/usr/bin/google-chrome`，以及使用初始化密码的本地测试账号：

```sh
npx tsx scripts/browser-check.ts
npx tsx scripts/browser-workflow.ts
```

两个脚本都访问 `http://127.0.0.1:4310` 上运行的应用，并在该应用实际连接的数据库中创建带标记的测试记录。它们不会自动选择独立数据库，只应对用于验收检查的工作区运行。截图和运行记录保存在 `artifacts/` 下。

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
```

命令生成 `artifacts/docs/` 中的离线 HTML，并检查页面配对、本地链接和流程图源码。两种语言应一起维护。同步规则见[文档入口](../README.md)，预览和流程图生成命令见[中文文档首页](README.md)。

## 备份与仓库分工

备份、独立恢复和升级步骤见[发布检查](RELEASE-CHECK.md)。认证、写入请求头和请求字段见 [API v1](API.md)。

本仓库维护应用代码、运行说明、脚本、产物和备份。产品规格和历史评审位于同一父目录下的 `open-task-specs` 仓库，构建和运行应用不需要该仓库。应用仓库根目录的 README 提供该仓库的链接。

Compose 项目名为 `open-task-mvp`；端口 `4173` 和 `4174` 属于独立的界面演示。默认 npm 缓存只读时，`.npmrc` 会选用 `/tmp/open-task-npm`。
