# OpenTask 使用文档

[English](../en/README.md)

OpenTask 用于组织一个团队的任务交付：把预期结果、责任人、反馈期限和验收结论放在同一条可追溯的任务记录中。当前版本为 **本机运行、单团队的 MVP**。

这套文档以“为 IssueLite 问题跟踪工具增加 CSV 导出”为贯穿案例。全部账号、项目和成果都是明确标记的模拟数据，不使用部门 9 月份数据。案例验证 OpenTask 的工作流，不代表 CSV 功能已经开发。

## 从哪里开始

| 你要做什么                       | 阅读                                 |
| -------------------------------- | ------------------------------------ |
| 安装并打开工作区                 | [本地启动](QUICKSTART.md)            |
| 理解角色、任务状态和日常操作     | [使用指南](USER-GUIDE.md)            |
| 按真实开发场景跟做一次完整交付   | [CSV 导出案例](CASE-CSV-EXPORT.md)   |
| 判断本地 MVP 是否具备发布条件    | [发布检查](RELEASE-CHECK.md)         |
| 查看本次实际验证结果、截图和限制 | [验收报告](RELEASE-CASE-RESULT.md)   |
| 开发 API 客户端                  | [API v1](API.md)                     |
| 构建应用并运行开发检查           | [开发指南](DEVELOPMENT.md)           |
| 查看分发依赖的许可信息           | [第三方声明](THIRD-PARTY-NOTICES.md) |

建议先完成“本地启动”，再跟做案例。只有负责人接受了任务，才表示形成了执行承诺；只有验收人通过了成果，才表示任务完成。

见 [0.1.0-alpha 版本说明](RELEASE-NOTES.md)与[当前候选就绪报告](RELEASE-READINESS.md)。

## Markdown 与 HTML

Markdown 是维护源文件。在代码仓库根目录运行：

```sh
npm run docs:build
```

生成静态文档到 `artifacts/docs/`，语言入口为 `artifacts/docs/index.html`，中文首页为 `artifacts/docs/zh-CN/index.html`。HTML 包含本地样式和截图，不依赖 CDN；可以直接打开，也可以作为静态文件发布。每页顶部可切换到另一语言的对应页面。生成文档不会将网页上传或部署到任何服务。

```sh
python3 -m http.server 4320 --bind 127.0.0.1 --directory artifacts/docs
```

然后打开 <http://127.0.0.1:4320/>。文档中的本机应用链接只在对应服务运行时可用。

### 流程图如何维护

使用指南与案例中的图使用 Mermaid 编写，中文源文件位于 `docs/assets/diagrams/zh-CN/*.mmd`，英文源文件位于 `docs/assets/diagrams/en/*.mmd`，旁边的 SVG 为预先生成的展示文件。Markdown 与 HTML 都直接使用 SVG，离线阅读无须加载 Mermaid 脚本。HTML 图下提供原图和源码入口，小屏幕可横向滚动查看细节。

日常构建仍只需 `npm run docs:build`。修改图时，使用 Mermaid CLI 11.12.0 运行：

```sh
bash scripts/render-doc-diagrams.sh
npm run docs:build
```

脚本会生成两种语言的全部流程图，需要本机已有 `mmdc` 与它使用的 Chromium，不会自动安装依赖；可用 `MERMAID_PUPPETEER_CONFIG` 指定本机 Puppeteer 配置路径。Linux 下可用 `FONTCONFIG_FILE` 指定本机 Fontconfig 配置，确保渲染器能读取中英文字体。普通文档构建只复制已有 SVG，不启动浏览器。

两种语言的同步规则见[文档语言入口](../README.md)。

## 当前边界

项目支持创建审批、执行清单、正式进展、阻塞协作、版本确认、成果验收、父子与前置关系、待办和动态、时间筛选、中英文与主题切换。没有外部身份登录、文件上传、邮件通知或 AI Agent 集成。真实团队的审批负担、长期使用体验与容量仍需后续试用验证。
