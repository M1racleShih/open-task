# 文档维护

[English](../en/MAINTAINING.md)

本页供文档维护者使用。使用者从[文档首页](README.md)开始；开发与发布检查分别见[开发指南](DEVELOPMENT.md)和[发布检查](RELEASE-CHECK.md)。

## 构建与预览

Markdown 是源文件。在仓库根目录运行以下命令，生成可离线阅读的 HTML，入口为 `artifacts/docs/index.html`：

```sh
npm run docs:build
python3 -m http.server 4320 --bind 127.0.0.1 --directory artifacts/docs
```

打开 <http://127.0.0.1:4320/>，或直接打开生成的 HTML。输出包含两种语言、页内目录和本地图片，无须 CDN 或运行时脚本。构建不会上传或部署。

构建检查语言配对、章节结构、本地链接、锚点、流程图源码和英文截图登记。修改后还需运行：

```sh
npx tsx --test tests/docs.test.ts
```

在浏览器查看中英文对应页，检查原图入口、桌面与手机排版。构建检查不能代替阅读和页面检查。

要随应用提供在线文档，将生成内容放入新构建的网页目录：

```sh
npm run build
npm run docs:build
mkdir -p dist/docs
cp -R artifacts/docs/. dist/docs/
```

现有静态服务随后会在同源的 `/docs/` 下提供文档。每次网页构建都会重建 `dist`，需在构建后重新复制文档；文档构建应使用部署所需的 API 展示设置。

## 在团队部署中隐藏 API 文档

默认开发构建包含完整 API 文档。团队部署可在应用根目录的 `.env` 中设置 `OPEN_TASK_HIDE_API_DOCS=1`，然后运行 `npm run docs:build` 并重启 API 服务。文档构建命令会读取 `.env`；进程环境中的同名设置优先。API 服务也必须加载该设置（TeamServer 的 systemd 服务通过 EnvironmentFile 加载）。

启用后，生成的文档导航不显示 API 入口，正文中的 API 文档链接变为普通文字，直接打开 API 文档页只显示隐藏提示。已登录用户请求 `/api/v1/openapi.json` 返回既有错误结构的 404，包括管理员和团队负责人。正常网页使用的业务 API 保持原有权限。

这项配置减少接口说明的展示，不会禁止自动化调用，也不会删除仓库里的 API 源文档。要恢复完整文档，将配置改为 `0`，重新构建文档并重启 API 服务。发布前应先备份现有配置和生成文档。

## 同步中英文内容

两种语言使用相同文件名、章节顺序和内容范围。行为变化、新增或删除页面时，同次更新对应译文；命令、账号、API 字段和证据数据保持一致。

说明操作时，写清谁操作、从哪里进入、执行什么动作，以及应看到的结果。中文说明在首次出现英文按钮名时解释其含义，便于读者对应英文截图。标题说明本节内容，正文用具体动作解释规则。

## 维护版本更新记录

将使用者能感受到的变化写进[版本更新记录](RELEASE-NOTES.md)，新版本在前。已合并的应用变化先放在**未发布**，写清带来的改善，并链接到使用指南中的对应操作。本地仍在开发的内容要单独说明。打标签时，再按实际版本号和发布日期归档，保留旧版本；不能仅凭包版本或截图推断已经发布。

README 保留一张当前英文工作区截图和简短更新摘要；使用指南说明新控件怎么用，版本记录说明每次改了什么。同步维护中英文，历史验收报告保留原有范围。

版本展示图可将未修改的英文 JPEG 与截图清单放在按日期命名的目录，如 `docs/assets/updates/2026-10-16/`。记录准确源码提交、是否有本地应用修改、数据库、浏览器、尺寸、模拟数据和实际检查的操作，并在 `docs/assets/screenshot-locales.json` 登记。截图包含最新标签之后的变化时，需明确说明。逐步教程截图继续采用下方流程。

## 更新教程截图

两种语言可以共用英文界面截图；英文文档不得嵌入中文界面截图。新教程截图的控件和模拟任务正文均使用英文。保留 `docs/assets/release-case/` 和 `release-alpha/` 中的历史证据，不覆盖已有记录，也不将旧图标为新检查结果。

1. 在独立本地数据库运行实际应用与 worker，通过浏览器执行要说明的步骤。不得修改 DOM、伪造响应或重绘界面来制造状态。
2. 将未修改的 JPEG 保存到 `docs/assets/walkthrough/en/`，记录日期、环境和实际操作范围。截图不得包含真实业务数据、密码或会话。
3. 在 `docs/assets/walkthrough/manifest.json` 登记英文语言、裁切和编号位置。图下说明与编号对应。
4. 在 `docs/assets/screenshot-locales.json` 登记每张原图和展示图的界面语言。英文页嵌入未登记或非英文截图会导致构建失败。登记需要人工检查，不能代替语言识别。
5. 运行标注脚本，保留原图。SVG 嵌入原图像素并添加编号边框，不修改业务内容。

```sh
npx tsx scripts/annotate-doc-screenshots.ts
npm run docs:build
npx tsx --test tests/docs.test.ts
```

已有截图的来源和检查范围见[截图与检查记录](SCREENSHOTS.md)。标注脚本只重建展示文件，不会重放应用流程；重新生成图片不代表重新验收。

## 更新流程图

分别维护 `docs/assets/diagrams/zh-CN/` 和 `docs/assets/diagrams/en/` 下的 Mermaid 源码与 SVG，同时更新正文、图注、标签和替代文字。文字变化必须保留关系、分支、状态与限制。

使用已安装的 Mermaid CLI 11.12.0 和 Chromium 重新生成：

```sh
bash scripts/render-doc-diagrams.sh
npm run docs:build
```

脚本不安装依赖。`MERMAID_PUPPETEER_CONFIG` 指定 Puppeteer 配置，`FONTCONFIG_FILE` 可选择支持中英文的字体配置。日常构建复制已有 SVG，离线阅读无需加载 Mermaid 脚本。

## 保留历史记录和许可

历史报告保留原日期、候选范围、命令、结果和限制。改写文档、翻译或重新生成标注不算新的验证。用户指南说明操作，检查记录说明当次实际执行过什么，二者应分别维护。

第三方许可保留原法律文本，仅翻译解释性说明。许可文件和分发要求见[第三方声明](THIRD-PARTY-NOTICES.md)。
