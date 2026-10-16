import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { buildDocs } from "../scripts/render-docs.js";

// The build writes only to a disposable repository fixture, with no database,
// browser, application service or network access.
async function fixture(t: TestContext) {
  const root = await mkdtemp(resolve(tmpdir(), "opentask-docs-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const files = [
    "README.md",
    "QUICKSTART.md",
    "USER-GUIDE.md",
    "CASE-CSV-EXPORT.md",
    "RELEASE-CHECK.md",
    "RELEASE-CASE-RESULT.md",
    "API.md",
    "THIRD-PARTY-NOTICES.md",
  ];
  await mkdir(resolve(root, "web/public/brand"), { recursive: true });
  await writeFile(
    resolve(root, "web/public/brand/opentask-cat-mark.png"),
    "brand fixture",
  );
  await writeFile(
    resolve(root, "web/public/LICENSE.txt"),
    "Original license text\n",
  );
  for (const locale of ["zh-CN", "en"]) {
    const other = locale === "en" ? "zh-CN" : "en";
    await mkdir(resolve(root, "docs", locale), { recursive: true });
    await mkdir(resolve(root, "docs/assets/diagrams", locale), {
      recursive: true,
    });
    await writeFile(
      resolve(root, "docs/assets/diagrams", locale, "flow.mmd"),
      "flowchart TB\n A-->B\n",
    );
    await writeFile(
      resolve(root, "docs/assets/diagrams", locale, "flow.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 200"><text>Flow</text></svg>',
    );
    for (const file of files) {
      await writeFile(
        resolve(root, "docs", locale, file),
        `# ${locale} ${file}\n\n[Other language](../${other}/${file})\n\n[Guide](USER-GUIDE.md#topic)\n\n![Flow](../assets/diagrams/${locale}/flow.svg)\n\n[License](../../web/public/LICENSE.txt)\n\n## Topic\n\nBody.\n`,
      );
    }
  }
  await writeFile(
    resolve(root, "docs/README.md"),
    "# Documentation\n\n[中文](zh-CN/README.md) · [English](en/README.md)\n",
  );
  return root;
}

async function append(root: string, text: string) {
  const path = resolve(root, "docs/en/QUICKSTART.md");
  await writeFile(path, (await readFile(path, "utf8")) + text);
}

test("docs build produces two offline editions with same-page switches and relative resources", async (t) => {
  const root = await fixture(t);
  const output = resolve(root, "artifacts/docs");
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, "stale.html"), "old layout");
  const result = await buildDocs(root);
  assert.equal(result.pages, 17);
  assert.equal(result.pairs, 8);
  for (const locale of ["zh-CN", "en"]) {
    const other = locale === "en" ? "zh-CN" : "en";
    const html = await readFile(
      resolve(output, locale, "QUICKSTART.html"),
      "utf8",
    );
    assert(html.includes(`<html lang="${locale}">`));
    assert(
      html.includes(
        `href="../${other}/QUICKSTART.html" lang="${other}" hreflang="${other}"`,
      ),
    );
    assert(html.includes('href="USER-GUIDE.html#topic"'));
    assert(html.includes('id="topic"'));
    assert(html.includes('href="../style.css"'));
    assert(html.includes(`src="../assets/diagrams/${locale}/flow.svg"`));
    assert(
      html.includes(`href="../assets/diagrams/${locale}/flow.mmd" download`),
    );
    assert(html.includes('href="../source/web/public/LICENSE.txt"'));
    assert(
      html.includes(
        locale === "en"
          ? 'aria-label="Documentation navigation"'
          : 'aria-label="文档导航"',
      ),
    );
    assert(html.includes('href="QUICKSTART.html" aria-current="page"'));
    assert(!html.includes("<script"));
  }
  assert.equal(
    await readFile(resolve(output, "source/web/public/LICENSE.txt"), "utf8"),
    "Original license text\n",
  );
  await assert.rejects(readFile(resolve(output, "stale.html")), {
    code: "ENOENT",
  });
});

test("navigation places first-task guidance before advanced material and groups maintenance separately", async (t) => {
  const root = await fixture(t);
  for (const locale of ["zh-CN", "en"]) {
    const other = locale === "en" ? "zh-CN" : "en";
    for (const file of ["FIRST-TASK.md", "MAINTAINING.md"]) {
      await writeFile(
        resolve(root, "docs", locale, file),
        `# ${file}\n\n[Other language](../${other}/${file})\n`,
      );
    }
  }
  const result = await buildDocs(root);
  assert.equal(result.pairs, 10);
  for (const locale of ["zh-CN", "en"]) {
    const html = await readFile(
      resolve(root, "artifacts/docs", locale, "FIRST-TASK.html"),
      "utf8",
    );
    const navigation = html.match(
      /<nav class="desktop-docs-nav"[^>]*>([\s\S]*?)<\/nav>/,
    )![1];
    assert(navigation.includes('href="FIRST-TASK.html" aria-current="page"'));
    assert(
      navigation.indexOf('href="FIRST-TASK.html"') <
        navigation.indexOf('href="CASE-CSV-EXPORT.html"'),
    );
    const labels =
      locale === "zh-CN"
        ? ["安装与使用", "开发与维护", "版本与检查记录"]
        : [
            "Install and use",
            "Develop and maintain",
            "Versions and check records",
          ];
    for (const label of labels)
      assert(navigation.includes(`role="group" aria-label="${label}"`));
    const maintenanceGroup = navigation.match(
      new RegExp(
        `aria-label="${labels[1]}"[\\s\\S]*?<div class="docs-nav-links">([\\s\\S]*?)</div>`,
      ),
    )![1];
    assert(maintenanceGroup.includes('href="MAINTAINING.html"'));
    assert(!maintenanceGroup.includes('href="FIRST-TASK.html"'));
  }
});

test("Unicode heading links point to generated HTML rather than Markdown sources", async (t) => {
  const root = await fixture(t);
  for (const locale of ["zh-CN", "en"]) {
    const guide = resolve(root, "docs", locale, "USER-GUIDE.md");
    await writeFile(
      guide,
      (await readFile(guide, "utf8")) + "\n## 中文指南\n\nBody.\n",
    );
    const quickstart = resolve(root, "docs", locale, "QUICKSTART.md");
    await writeFile(
      quickstart,
      (await readFile(quickstart, "utf8")) +
        "\n[中文章节](USER-GUIDE.md#中文指南)\n",
    );
  }
  await buildDocs(root);
  for (const locale of ["zh-CN", "en"]) {
    const html = await readFile(
      resolve(root, "artifacts/docs", locale, "QUICKSTART.html"),
      "utf8",
    );
    assert(html.includes('href="USER-GUIDE.html#中文指南"'));
    assert(!html.includes('href="USER-GUIDE.md#'));
  }
});

test("docs build rejects missing translated pages before replacing previous output", async (t) => {
  const root = await fixture(t);
  await buildDocs(root);
  await rm(resolve(root, "docs/en/API.md"));
  await assert.rejects(buildDocs(root), /Missing translated page: en\/API.md/);
  assert(
    (
      await readFile(resolve(root, "artifacts/docs/en/API.html"), "utf8")
    ).includes("en API.md"),
  );
});

test("docs build rejects an extra unpaired page and mismatched translated sections", async (t) => {
  const root = await fixture(t);
  const extra = resolve(root, "docs/en/EXTRA.md");
  await writeFile(extra, "# Extra\n");
  await assert.rejects(buildDocs(root), /Page pairs differ/);
  await rm(extra);
  await append(root, "\n## Untranslated section\n");
  await assert.rejects(
    buildDocs(root),
    /Translated section structure differs: QUICKSTART.md/,
  );
});

test("docs build rejects broken local links including reference-style links and heading anchors", async (t) => {
  const root = await fixture(t);
  const path = resolve(root, "docs/en/QUICKSTART.md");
  const original = await readFile(path, "utf8");
  await append(root, "\n[Missing][missing]\n\n[missing]: missing.md\n");
  await assert.rejects(buildDocs(root), { code: "ENOENT" });
  await writeFile(path, original);
  await append(root, "\n[Missing heading](USER-GUIDE.md#missing)\n");
  await assert.rejects(buildDocs(root), /Missing heading anchor/);
});

test("docs build requires Markdown language switches", async (t) => {
  const root = await fixture(t);
  const path = resolve(root, "docs/en/QUICKSTART.md");
  await writeFile(
    path,
    (await readFile(path, "utf8")).replace(
      "[Other language](../zh-CN/QUICKSTART.md)",
      "",
    ),
  );
  await assert.rejects(
    buildDocs(root),
    /Missing Markdown language switch: en\/QUICKSTART.md/,
  );
});

test("docs build rejects diagrams in the wrong language or without source", async (t) => {
  const root = await fixture(t);
  const path = resolve(root, "docs/en/QUICKSTART.md");
  const original = await readFile(path, "utf8");
  await writeFile(
    path,
    original.replace(
      "../assets/diagrams/en/flow.svg",
      "../assets/diagrams/zh-CN/flow.svg",
    ),
  );
  await assert.rejects(buildDocs(root), /Wrong diagram language/);
  await writeFile(path, original);
  await rm(resolve(root, "docs/assets/diagrams/en/flow.mmd"));
  await assert.rejects(buildDocs(root), /Diagram pairs differ/);
});

test("English pages reject unregistered or Chinese interface screenshots", async (t) => {
  const root = await fixture(t);
  const shot = resolve(root, "docs/assets/interface.jpg");
  await writeFile(shot, "screenshot fixture");
  await append(root, "\n![Interface](../assets/interface.jpg)\n");
  await assert.rejects(
    buildDocs(root),
    /English screenshot needs verified en locale/,
  );
  await writeFile(
    resolve(root, "docs/assets/screenshot-locales.json"),
    JSON.stringify({ "interface.jpg": "zh-CN" }),
  );
  await assert.rejects(
    buildDocs(root),
    /English screenshot needs verified en locale/,
  );
  await writeFile(
    resolve(root, "docs/assets/screenshot-locales.json"),
    JSON.stringify({ "interface.jpg": "en" }),
  );
  await buildDocs(root);
});

test("walkthrough images retain originals and long pages have localized contents links", async (t) => {
  const root = await fixture(t);
  await mkdir(resolve(root, "docs/assets/walkthrough/en"), { recursive: true });
  await writeFile(
    resolve(root, "docs/assets/walkthrough/en/step.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg"/>',
  );
  await writeFile(
    resolve(root, "docs/assets/walkthrough/en/step.jpg"),
    "original fixture",
  );
  await writeFile(
    resolve(root, "docs/assets/screenshot-locales.json"),
    JSON.stringify({ "walkthrough/en/step.svg": "en" }),
  );
  for (const locale of ["en", "zh-CN"]) {
    const path = resolve(root, `docs/${locale}/QUICKSTART.md`);
    await writeFile(
      path,
      (await readFile(path, "utf8")) +
        "\n## Another step\n\n![Step](../assets/walkthrough/en/step.svg)\n\n## Last step\n\nDone.\n",
    );
  }
  await buildDocs(root);
  for (const locale of ["en", "zh-CN"]) {
    const html = await readFile(
      resolve(root, `artifacts/docs/${locale}/QUICKSTART.html`),
      "utf8",
    );
    assert(html.includes('href="#another-step"'));
    assert(html.includes(locale === "en" ? "On this page" : "本页内容"));
    assert(html.includes('href="../assets/walkthrough/en/step.jpg"'));
  }
  await rm(resolve(root, "docs/assets/walkthrough/en/step.jpg"));
  await assert.rejects(buildDocs(root), { code: "ENOENT" });
});

test("hidden API docs omit navigation, neutralize links and replace stale API content", async (t) => {
  const root = await fixture(t);
  for (const locale of ["en", "zh-CN"]) {
    const path = resolve(root, "docs", locale, "README.md");
    await writeFile(
      path,
      (await readFile(path, "utf8")) + "\n[API reference](API.md)\n",
    );
  }
  for (const locale of ["en", "zh-CN"]) {
    const path = resolve(root, "docs", locale, "API.md");
    await writeFile(
      path,
      (await readFile(path, "utf8")) + "\nPRIVATE_API_REFERENCE_SENTINEL\n",
    );
  }
  await buildDocs(root);
  assert(
    (
      await readFile(resolve(root, "artifacts/docs/en/API.html"), "utf8")
    ).includes("PRIVATE_API_REFERENCE_SENTINEL"),
  );
  await buildDocs(root, { hideApiDocs: true });
  for (const locale of ["en", "zh-CN"]) {
    const html = await readFile(
      resolve(root, "artifacts/docs", locale, "index.html"),
      "utf8",
    );
    assert(!html.includes('href="API.html"'));
    assert(html.includes("API reference"));
    const api = await readFile(
      resolve(root, "artifacts/docs", locale, "API.html"),
      "utf8",
    );
    assert(
      api.includes(
        locale === "en"
          ? "API documentation is hidden"
          : "此部署已隐藏 API 文档",
      ),
    );
    assert(!api.includes("PRIVATE_API_REFERENCE_SENTINEL"));
  }
  // The default developer build restores full documentation.
  await buildDocs(root);
  const html = await readFile(
    resolve(root, "artifacts/docs/en/index.html"),
    "utf8",
  );
  assert(html.includes('href="API.html"'));
});
