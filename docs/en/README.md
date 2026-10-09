# OpenTask documentation

[简体中文](../zh-CN/README.md)

OpenTask organizes a team's task delivery by keeping expected results, owners, feedback deadlines and acceptance decisions in one traceable task record. The current version is a **local, single-team MVP**.

These documents follow one case: adding CSV export to the IssueLite issue tracker. All accounts, projects and results are explicitly marked as synthetic. No departmental September data is used. The case verifies the OpenTask workflow; it does not mean a CSV feature has been developed.

## Where to start

| What you want to do                                       | Read                                          |
| --------------------------------------------------------- | --------------------------------------------- |
| Install and open a workspace                              | [Local setup](QUICKSTART.md)                  |
| Understand roles, task states and daily operations        | [User guide](USER-GUIDE.md)                   |
| Follow a complete delivery in a development scenario      | [CSV export case](CASE-CSV-EXPORT.md)         |
| Decide whether the local MVP is ready for release         | [Release checks](RELEASE-CHECK.md)            |
| Inspect the recorded verification, screenshots and limits | [Verification report](RELEASE-CASE-RESULT.md) |
| Develop an API client                                     | [API v1](API.md)                              |
| Build the app and run development checks                  | [Development](DEVELOPMENT.md)                 |
| Review licenses for distributed dependencies              | [Third-party notices](THIRD-PARTY-NOTICES.md) |

See the [0.1.0-alpha release notes](RELEASE-NOTES.md) and [current candidate readiness](RELEASE-READINESS.md). Start with local setup, then follow the case. An owner commits to execution by accepting the task; a task is complete only after its reviewer accepts the result.

## Markdown and HTML

Markdown is the maintained source. From the repository root, run:

```sh
npm run docs:build
```

The static site is generated in `artifacts/docs/`. Its language entry is `artifacts/docs/index.html`, and the English home is `artifacts/docs/en/index.html`. HTML includes local styles and screenshots without a CDN; open it directly or publish it as static files. The top of each page links to the corresponding page in the other language. Building documentation does not upload or deploy it to any service.

```sh
python3 -m http.server 4320 --bind 127.0.0.1 --directory artifacts/docs
```

Then open <http://127.0.0.1:4320/>. Links to the local application work only while the corresponding service is running.

### Maintaining diagrams

The guide and case use Mermaid diagrams. Chinese sources live in `docs/assets/diagrams/zh-CN/*.mmd`, and English sources in `docs/assets/diagrams/en/*.mmd`. Adjacent SVG files are pre-rendered for display. Markdown and HTML use the SVGs directly, so offline reading needs no Mermaid script. HTML offers original-image and source links below each diagram; on small screens, scroll horizontally to inspect details.

For routine builds, run only `npm run docs:build`. After editing diagrams, use Mermaid CLI 11.12.0:

```sh
bash scripts/render-doc-diagrams.sh
npm run docs:build
```

The script renders all diagrams in both languages. It requires an existing local `mmdc` and its Chromium browser; it does not install dependencies. Set `MERMAID_PUPPETEER_CONFIG` to use a local Puppeteer configuration. On Linux, `FONTCONFIG_FILE` can select a local Fontconfig configuration so the renderer can read Chinese and English fonts. Ordinary documentation builds copy existing SVGs without launching a browser.

See the [documentation language entry](../README.md) for synchronization rules.

## Current boundaries

The project supports creation approval, execution checklists, formal progress, blocker collaboration, version confirmation, result review, parent/child and prerequisite relations, followups and activity, time filters, language switching and themes. It has no external identity login, file upload, email notification or AI Agent integration. Approval overhead in real teams, long-term usability and capacity still require trial use.
