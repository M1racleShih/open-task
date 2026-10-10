# OpenTask 文档 / Documentation

选择阅读语言。两套文档覆盖相同的本地启动、使用指南、开发案例、开发检查、发布检查、验收记录、API 与许可说明；每页可切换到另一语言的对应页面。

Choose a reading language. Both editions cover the same local setup, user guide, development case, development checks, release checks, verification record, API and license notices. Each page links to its counterpart in the other language.

| 语言 / Language | 入口 / Start here                      |
| --------------- | -------------------------------------- |
| 简体中文        | [OpenTask 使用文档](zh-CN/README.md)   |
| English         | [OpenTask documentation](en/README.md) |

## 构建 / Build

Markdown 是维护源文件。在代码仓库根目录运行下列命令，生成可离线阅读的 HTML；入口为 `artifacts/docs/index.html`，两种语言分别位于 `zh-CN/` 与 `en/`。构建检查页面配对、本地链接和流程图源码，不会上传或部署网站。

Markdown is the maintained source. Run the following command from the repository root to generate offline HTML at `artifacts/docs/index.html`, with editions in `zh-CN/` and `en/`. The build checks page pairs, local links and diagram sources. It does not upload or deploy the site.

```sh
npm run docs:build
```

可直接打开生成的 HTML，或通过本机静态服务阅读。Open the generated HTML directly, or serve it locally:

```sh
python3 -m http.server 4320 --bind 127.0.0.1 --directory artifacts/docs
```

打开 / Open <http://127.0.0.1:4320/>。

## 维护规则 / Maintenance

以下每条规则先中文、后英文。Each rule below is given in Chinese first, then in English.

- 两种语言使用相同的文件名、章节顺序与内容范围。修改行为说明时，在同一次变更中更新对应译文；新增或删除页面时同步处理两套目录。
- Both editions use matching filenames, section order and scope. Update the counterpart in the same change when behavior descriptions change; add or remove pages in both directories together.
- 命令、API 字段、账号、任务编号与证据数据保持原样。验收报告保留原验证日期和范围，翻译不代表重新执行业务验收。
- Preserve commands, API identifiers, accounts, task numbers and evidence data. Reports retain their original verification date and scope; translation does not constitute a new application acceptance run.
- 原始验收截图与证据保存在 `docs/assets/release-case/`，保留原文件。内嵌截图的界面语言应与页面一致；只有另一语言的原始截图时，提供标明语言的证据链接。任务正文保留原输入，不随界面语言翻译。
- Original verification screenshots and evidence live in `docs/assets/release-case/`; preserve the original files. Embed screenshots whose interface language matches the page. When only an original screenshot in another language is available, provide a labeled evidence link. Task text stays as entered rather than changing with the interface language.
- 流程图按语言保存在 `docs/assets/diagrams/zh-CN/` 和 `docs/assets/diagrams/en/`，同时更新 Mermaid 源码与生成的 SVG；图表标签和替代文字均须对应语言。
- Diagrams live in `docs/assets/diagrams/zh-CN/` and `docs/assets/diagrams/en/`; update Mermaid sources and generated SVGs together, including translated labels and alternative text.
- 第三方许可保留原始法律文本，中文文档只翻译说明。提交文档变更前运行 `npm run docs:build`，并检查两种语言的对应页面和移动端显示。
- Keep original legal license texts; translate explanatory notices only. Before submitting documentation changes, run `npm run docs:build` and inspect corresponding pages in both languages and the mobile layout.
