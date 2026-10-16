# Documentation maintenance

[简体中文](../zh-CN/MAINTAINING.md)

This page is for documentation maintainers. Users start at [documentation home](README.md); code and release checks are covered in [development](DEVELOPMENT.md) and [release checks](RELEASE-CHECK.md).

## Build and preview

Markdown is the source. From the repository root, generate offline HTML with the following commands. The entry is `artifacts/docs/index.html`:

```sh
npm run docs:build
python3 -m http.server 4320 --bind 127.0.0.1 --directory artifacts/docs
```

Open <http://127.0.0.1:4320/> or open the generated HTML directly. Output includes both languages, page contents and local images, without a CDN or runtime scripts. Building does not upload or deploy anything.

The build checks page pairs, section structure, local links, anchors, diagram sources and English screenshot registration. After edits, also run:

```sh
npx tsx --test tests/docs.test.ts
```

Inspect corresponding Chinese and English pages in a browser, including original-image links and desktop/phone layouts. Build checks do not replace reading or visual inspection.

To serve the generated documentation alongside the app, package it into the fresh web build:

```sh
npm run build
npm run docs:build
mkdir -p dist/docs
cp -R artifacts/docs/. dist/docs/
```

The existing static server then serves `/docs/` from the same origin. Each web build replaces `dist`, so repeat the documentation copy after building. Use the deployment’s API-visibility setting for the documentation build.

## Hide API documentation on a team deployment

Developer builds include full API documentation by default. For a team deployment, set `OPEN_TASK_HIDE_API_DOCS=1` in the application root's `.env`, run `npm run docs:build`, and restart the API service. The documentation command reads `.env`; an existing process environment value takes precedence. The API service must load the same setting (TeamServer systemd uses EnvironmentFile).

When enabled, generated navigation omits the API entry, API documentation links in page text become plain text, and direct API-page visits show only a hidden notice. Authenticated requests to `/api/v1/openapi.json` return the existing 404 error envelope, including for administrators and leaders. Business APIs used by the web interface retain their permissions.

This setting reduces exposure of interface descriptions; it does not prohibit automation or delete the API source documentation in the repository. Set it to `0`, rebuild documentation and restart the API service to restore full documentation. Back up configuration and generated documents before deployment.

## Keep Chinese and English aligned

Use matching filenames, section order and content scope. Update both editions together for behavior changes or added/removed pages. Keep commands, accounts, API fields and evidence data consistent.

Explain who acts, where they enter, what they do and what result they should see. Chinese instructions explain English control names on first use to help readers follow the screenshots. Headings describe their section; concrete actions explain rules.

## Maintain release notes

Keep user-visible changes in [release notes](RELEASE-NOTES.md), newest first. Add merged application changes under **Unreleased**, describing the benefit and linking to the corresponding operation in the user guide. Keep local work in progress clearly identified. When tagging a release, move its entries under the actual version and release date; retain earlier versions. Do not infer a release from the package version or a screenshot.

The README carries one current English workspace image and a short update summary. User guides explain how to use the changed controls; release notes explain what changed by version. Keep both languages aligned, and preserve historical verification reports with their original scope.

For release showcase images, save unchanged English JPEGs and a capture manifest under a dated directory such as `docs/assets/updates/2026-10-16/`. Record the exact source commit, any local application changes, database, browser, dimensions, synthetic data and actions actually checked. Register each image in `docs/assets/screenshot-locales.json`. State when a screenshot includes changes after the latest tag. Use the tutorial workflow below for step-by-step walkthrough captures.

## Update tutorial screenshots

Both editions may share English interface captures. English documents must not embed Chinese interface screenshots. New tutorial captures use English controls and English synthetic task content. Preserve historical evidence in `docs/assets/release-case/` and `release-alpha/`; do not overwrite records or relabel old images as new check results.

1. Run the actual app and worker in an isolated local database and perform the relevant steps through a browser. Do not edit the DOM, fake responses or redraw the interface to manufacture states.
2. Save the unchanged JPEG to `docs/assets/walkthrough/en/`. Record date, environment and actual scope. Captures must exclude real business data, passwords and sessions.
3. Register English language, crops and callout positions in `docs/assets/walkthrough/manifest.json`. Captions must match the numbers.
4. Register each original and presentation image's interface language in `docs/assets/screenshot-locales.json`. Unregistered or non-English screenshots in English pages fail the build. Registration requires human review and is not language detection.
5. Run the annotation script while preserving originals. SVGs embed original pixels and add numbered borders without changing business content.

```sh
npx tsx scripts/annotate-doc-screenshots.ts
npm run docs:build
npx tsx --test tests/docs.test.ts
```

See [screenshots and check records](SCREENSHOTS.md) for existing provenance and scope. Annotation only rebuilds presentation files; it does not replay app operations or constitute a new verification run.

## Update diagrams

Maintain Mermaid sources and SVGs in both `docs/assets/diagrams/zh-CN/` and `docs/assets/diagrams/en/`. Update prose, captions, labels and alternative text together, preserving relationships, branches, states and restrictions.

Regenerate using the installed Mermaid CLI 11.12.0 and Chromium:

```sh
bash scripts/render-doc-diagrams.sh
npm run docs:build
```

The script installs no dependencies. `MERMAID_PUPPETEER_CONFIG` selects Puppeteer configuration; `FONTCONFIG_FILE` can select fonts supporting both languages. Routine builds copy existing SVGs, so offline reading needs no Mermaid runtime.

## Preserve historical records and licenses

Historical reports retain their original dates, candidate scope, commands, results and limits. Rewriting, translating or regenerating annotations is not new verification. User guides explain operations; check records explain what a particular run actually exercised. Maintain them separately.

Preserve original third-party legal texts and translate explanatory notices only. See [third-party notices](THIRD-PARTY-NOTICES.md) for license files and distribution requirements.
