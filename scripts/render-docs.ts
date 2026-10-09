import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Root, Nodes } from "mdast";
import {
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { resolve, dirname, basename, relative } from "node:path";
import { fileURLToPath } from "node:url";

const editions = {
  "zh-CN": {
    name: "简体中文",
    description: "OpenTask 本地 MVP 使用文档与开发案例",
    subtitle: "本地 MVP · 使用文档",
    navigation: "文档导航",
    languages: "阅读语言",
    entry: "语言入口",
    skip: "跳到正文",
    footer: "Markdown 为维护源文件 · 静态 HTML 可离线阅读",
    diagram: "流程图",
    scroll: "小屏幕可横向滚动",
    original: "查看 SVG 原图",
    download: "下载 Mermaid 源码",
  },
  en: {
    name: "English",
    description: "OpenTask local MVP documentation and development case",
    subtitle: "Local MVP · Documentation",
    navigation: "Documentation navigation",
    languages: "Reading language",
    entry: "Language entry",
    skip: "Skip to content",
    footer: "Markdown is the maintained source · Static HTML works offline",
    diagram: "Diagram",
    scroll: "Scroll horizontally on small screens",
    original: "View original SVG",
    download: "Download Mermaid source",
  },
} as const;
type Locale = keyof typeof editions;
const locales = Object.keys(editions) as Locale[];
const order = [
  "README.md",
  "QUICKSTART.md",
  "USER-GUIDE.md",
  "CASE-CSV-EXPORT.md",
  "RELEASE-CHECK.md",
  "RELEASE-CASE-RESULT.md",
  "API.md",
  "THIRD-PARTY-NOTICES.md",
];
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
const pageTarget = (file: string) =>
  file.endsWith("README.md")
    ? file.replace(/README\.md$/, "index.html")
    : file.replace(/\.md$/, ".html");
const linkFrom = (from: string, to: string) => relative(dirname(from), to);
const walk = (node: Nodes, visit: (node: Nodes) => void) => {
  visit(node);
  if ("children" in node) for (const child of node.children) walk(child, visit);
};
const nodeText = (node: Nodes): string => {
  if ("value" in node) return node.value;
  if ("children" in node) return node.children.map(nodeText).join("");
  return "";
};
// Assign heading IDs through the Markdown tree so inline markup and duplicate
// headings are handled identically during validation and rendering.
const headingIds = () => (tree: Root) => {
  const used = new Set<string>();
  walk(tree, (node) => {
    if (node.type !== "heading") return;
    const base = nodeText(node)
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\p{M}_\s-]/gu, "")
      .replace(/\s/g, "-");
    let id = base;
    let suffix = 0;
    while (used.has(id)) id = `${base}-${++suffix}`;
    used.add(id);
    node.data = { ...node.data, hProperties: { id } };
  });
};

export async function buildDocs(root = resolve(import.meta.dirname, "..")) {
  // Keep the existing Markdown stack; static output needs no runtime JS or CDN.
  const source = resolve(root, "docs");
  const output = resolve(root, "artifacts/docs");
  const assetDirectory = resolve(source, "assets");
  const inventories = await Promise.all(
    locales.map(async (locale) => ({
      locale,
      files: (await readdir(resolve(source, locale)))
        .filter((name) => name.endsWith(".md"))
        .sort(),
      diagrams: (await readdir(resolve(assetDirectory, "diagrams", locale)))
        .filter((name) => name.endsWith(".mmd"))
        .sort(),
    })),
  );
  for (const inventory of inventories) {
    for (const file of order)
      if (!inventory.files.includes(file))
        throw new Error(`Missing translated page: ${inventory.locale}/${file}`);
    if (inventory.files.join("\n") !== inventories[0].files.join("\n"))
      throw new Error(`Page pairs differ: ${inventory.locale}`);
    if (inventory.diagrams.join("\n") !== inventories[0].diagrams.join("\n"))
      throw new Error(`Diagram pairs differ: ${inventory.locale}`);
    for (const file of inventory.diagrams)
      await stat(
        resolve(
          assetDirectory,
          "diagrams",
          inventory.locale,
          file.replace(/\.mmd$/, ".svg"),
        ),
      );
  }
  const ranked = [...inventories[0].files].sort((a, b) => {
    const rank = (name: string) =>
      order.includes(name) ? order.indexOf(name) : order.length;
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  const files = [
    "README.md",
    ...locales.flatMap((locale) => ranked.map((file) => `${locale}/${file}`)),
  ];
  const pages = new Map<
    string,
    {
      locale: Locale | null;
      title: string;
      text: string;
      target: string;
      references: Set<string>;
      anchors: Set<string>;
      headings: number[];
      links: Map<string, string>;
      diagramWidths: Map<string, number>;
    }
  >();
  await Promise.all(
    files.map(async (file) => {
      const text = await readFile(resolve(source, file), "utf8");
      let title = basename(file, ".md");
      const references = new Set<string>();
      const anchors = new Set<string>();
      const headings: number[] = [];
      const collect = () => (tree: Root) => {
        walk(tree, (node) => {
          if (
            node.type === "link" ||
            node.type === "image" ||
            node.type === "definition"
          )
            references.add(node.url);
          if (node.type === "heading") {
            if (node.depth === 1) title = nodeText(node);
            headings.push(node.depth);
            anchors.add(String(node.data?.hProperties?.id));
          }
        });
      };
      renderToStaticMarkup(
        createElement(
          ReactMarkdown,
          {
            remarkPlugins: [remarkGfm, headingIds, collect],
          },
          text,
        ),
      );
      pages.set(file, {
        locale: file === "README.md" ? null : (file.split("/")[0] as Locale),
        title,
        text,
        target: pageTarget(file),
        references,
        anchors,
        headings,
        links: new Map(),
        diagramWidths: new Map(),
      });
    }),
  );
  for (const file of ranked) {
    const chinese = pages.get(`zh-CN/${file}`)!;
    const english = pages.get(`en/${file}`)!;
    if (chinese.headings.join(",") !== english.headings.join(","))
      throw new Error(`Translated section structure differs: ${file}`);
    for (const locale of locales) {
      const other = locale === "en" ? "zh-CN" : "en";
      if (
        !pages.get(`${locale}/${file}`)!.references.has(`../${other}/${file}`)
      )
        throw new Error(`Missing Markdown language switch: ${locale}/${file}`);
    }
  }
  let checkedLinks = 0;
  let checkedDiagrams = 0;
  const copies = new Map<string, string>();
  for (const file of files) {
    const page = pages.get(file)!;
    for (const href of page.references) {
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) continue;
      const [path, anchor] = href.split("#");
      const local = path
        ? resolve(dirname(resolve(source, file)), decodeURIComponent(path))
        : resolve(source, file);
      if (!local.startsWith(root + "/"))
        throw new Error(`Reference outside repository: ${file}: ${href}`);
      if (!(await stat(local)).isFile())
        throw new Error(`Expected a local file: ${file}: ${href}`);
      const destinationPage = pages.get(relative(source, local));
      let destination: string;
      if (destinationPage) {
        destination = destinationPage.target;
        if (anchor && !destinationPage.anchors.has(decodeURIComponent(anchor)))
          throw new Error(`Missing heading anchor: ${file}: ${href}`);
      } else if (local.startsWith(assetDirectory + "/")) {
        destination = "assets/" + relative(assetDirectory, local);
        if (
          local.startsWith(resolve(assetDirectory, "diagrams") + "/") &&
          local.endsWith(".svg")
        ) {
          if (
            page.locale &&
            !local.startsWith(
              resolve(assetDirectory, "diagrams", page.locale) + "/",
            )
          )
            throw new Error(`Wrong diagram language: ${file}: ${href}`);
          if (!(await stat(local.replace(/\.svg$/, ".mmd"))).isFile())
            throw new Error(`Missing Mermaid source: ${file}: ${href}`);
          const svg = await readFile(local, "utf8");
          const width = Number(
            svg.match(/\bviewBox="([^"]+)"/)?.[1].split(/\s+/)[2],
          );
          if (!Number.isFinite(width) || width <= 0)
            throw new Error(`Invalid diagram viewBox: ${file}: ${href}`);
          page.diagramWidths.set(linkFrom(page.target, destination), width);
          checkedDiagrams++;
        }
      } else {
        destination = "source/" + relative(root, local);
        copies.set(local, destination);
      }
      page.links.set(
        href,
        linkFrom(page.target, destination) + (anchor ? `#${anchor}` : ""),
      );
      checkedLinks++;
    }
  }
  // Only replace generated output after all source checks succeed. This also
  // removes stale pages and assets from the old single-language layout.
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await cp(assetDirectory, resolve(output, "assets"), { recursive: true });
  await cp(resolve(root, "web/public/brand"), resolve(output, "assets/brand"), {
    recursive: true,
  });
  for (const [local, destination] of copies) {
    await mkdir(dirname(resolve(output, destination)), { recursive: true });
    await cp(local, resolve(output, destination));
  }
  for (const file of files) {
    const page = pages.get(file)!;
    const locale = page.locale ?? "zh-CN";
    const labels = editions[locale];
    const navigation = (
      page.locale
        ? ranked.map((name) => `${page.locale}/${name}`)
        : locales.map((code) => `${code}/README.md`)
    )
      .map((name) => {
        const target = pages.get(name)!;
        return `<a href="${escape(linkFrom(page.target, target.target))}"${name === file ? ' aria-current="page"' : ""}>${escape(target.title)}</a>`;
      })
      .join("\n");
    const languages = locales
      .map((code) => {
        const counterpart = `${code}/${basename(file)}`;
        return `<a href="${escape(linkFrom(page.target, pages.get(counterpart)!.target))}" lang="${code}" hreflang="${code}"${page.locale === code ? ' aria-current="page"' : ""}>${editions[code].name}</a>`;
      })
      .join(" · ");
    const content = renderToStaticMarkup(
      createElement(
        ReactMarkdown,
        {
          remarkPlugins: [remarkGfm, headingIds],
          components: {
            a: ({ href, children }) => {
              const language = href?.match(/^\.\.\/(zh-CN|en)\//)?.[1];
              return createElement(
                "a",
                {
                  href: page.links.get(href ?? "") ?? href,
                  rel: "noreferrer noopener",
                  ...(language ? { lang: language, hrefLang: language } : {}),
                },
                children,
              );
            },
            img: ({ src, alt }) => {
              const target = page.links.get(String(src)) ?? String(src);
              const width = page.diagramWidths.get(target);
              const image = createElement("img", {
                src: target,
                alt,
                loading: "lazy",
                ...(width
                  ? {
                      style: {
                        minWidth: Math.min(640, width),
                        maxWidth: width,
                      },
                    }
                  : {}),
              });
              if (!width) return image;
              return createElement(
                "span",
                { className: "diagram" },
                createElement(
                  "span",
                  {
                    className: "diagram-scroll",
                    role: "region",
                    tabIndex: 0,
                    "aria-label": `${alt ?? labels.diagram} · ${labels.scroll}`,
                  },
                  image,
                ),
                createElement(
                  "span",
                  { className: "diagram-links" },
                  createElement("a", { href: target }, labels.original),
                  " · ",
                  createElement(
                    "a",
                    { href: target.replace(/\.svg$/, ".mmd"), download: true },
                    labels.download,
                  ),
                  ` · ${labels.scroll}`,
                ),
              );
            },
            table: ({ children }) =>
              createElement(
                "div",
                { className: "table-scroll" },
                createElement("table", null, children),
              ),
          },
        },
        page.text,
      ),
    );
    const assets = linkFrom(page.target, "assets");
    const stylesheet = linkFrom(page.target, "style.css");
    const home = linkFrom(
      page.target,
      page.locale ? `${page.locale}/index.html` : "index.html",
    );
    const entry = linkFrom(page.target, "index.html");
    const alternates = page.locale
      ? locales
          .map(
            (code) =>
              `<link rel="alternate" hreflang="${code}" href="${escape(linkFrom(page.target, pages.get(`${code}/${basename(file)}`)!.target))}">`,
          )
          .join("")
      : "";
    const html = `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${escape(labels.description)}"><title>${escape(page.title)} · OpenTask</title>${alternates}<link rel="icon" type="image/png" href="${assets}/brand/opentask-cat-mark.png"><link rel="stylesheet" href="${stylesheet}"></head>
<body><a class="skip" href="#content">${labels.skip}</a><header><a class="docs-brand" href="${home}"><img src="${assets}/brand/opentask-cat-mark.png" alt="" width="44" height="44">OpenTask</a><span>${labels.subtitle}</span><div class="language-switch" role="navigation" aria-label="${labels.languages}">${languages} · <a href="${entry}">${labels.entry}</a></div></header><div class="layout"><nav aria-label="${labels.navigation}">${navigation}</nav><main id="content">${content}</main></div><footer>${labels.footer}</footer></body></html>`;
    await mkdir(dirname(resolve(output, page.target)), { recursive: true });
    await writeFile(resolve(output, page.target), html);
  }
  await writeFile(
    resolve(output, "style.css"),
    `
:root{color-scheme:light;--ink:#17263a;--muted:#52667d;--line:#dce5ed;--accent:#175f9b}*{box-sizing:border-box}body{margin:0;background:#f5f7fa;color:var(--ink);font:16px/1.85 system-ui,-apple-system,"Segoe UI","Noto Sans CJK SC",sans-serif}a{color:var(--accent);text-underline-offset:.2em}a:focus-visible{outline:3px solid #d78b24;outline-offset:4px}header{padding:20px 5vw;border-bottom:1px solid var(--line);display:flex;gap:22px;align-items:center;background:white}header a{font-size:24px;font-weight:750;text-decoration:none}header span{color:var(--muted);font-size:14px}.layout{max-width:1320px;margin:auto;display:grid;grid-template-columns:240px minmax(0,1fr);gap:36px;padding:36px 24px}nav{align-self:start;position:sticky;top:24px;display:grid;gap:4px;font-size:14px}nav a{padding:9px 12px;border-radius:6px;text-decoration:none}nav a:hover{background:#e8eef5}main{min-width:0;padding:32px 44px;background:white;border:1px solid var(--line);border-radius:10px}h1{font-size:32px;line-height:1.3;margin:0 0 24px}h2{font-size:23px;margin:38px 0 14px;padding-top:12px;border-top:1px solid var(--line)}h3{font-size:19px}p,ul,ol{margin:16px 0}strong{font-weight:750}.table-scroll{overflow-x:auto;margin:24px 0}table{border-collapse:collapse;width:100%;font-size:14px;text-align:left}th,td{padding:11px 14px;border:1px solid var(--line);vertical-align:top}th{background:#edf3f8}pre{background:#14263a;color:#edf4fa;padding:20px;border-radius:6px;overflow-x:auto;line-height:1.65;font-size:13px}code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;overflow-wrap:anywhere}p code,li code,td code{font-size:.9em;background:#edf3f8;padding:2px 5px;border-radius:3px}blockquote{margin:24px 0;padding:8px 20px;border-left:4px solid var(--accent);background:#edf3f8}img{max-width:100%;height:auto;display:block;border:1px solid var(--line);border-radius:6px}footer{max-width:1320px;margin:auto;padding:12px 24px 32px;color:var(--muted);font-size:13px}.skip{position:absolute;left:12px;top:-100px;background:white;padding:10px}.skip:focus{top:12px}@media(max-width:800px){header{padding:16px;flex-wrap:wrap;gap:8px}.layout{grid-template-columns:1fr;gap:18px;padding:18px 12px}nav{position:static;grid-template-columns:repeat(2,minmax(0,1fr));font-size:13px}main{padding:24px 18px}h1{font-size:27px}h2{font-size:21px}th,td{padding:8px;min-width:100px}}@media print{header,nav,footer,.skip{display:none}.layout{display:block;padding:0}main{border:0;padding:0}body{background:white}pre{white-space:pre-wrap;background:#f1f3f5;color:#17263a}img{max-height:700px;object-fit:contain}h2,h3{break-after:avoid}tr,img,pre{break-inside:avoid}}
`,
  );
  await writeFile(
    resolve(output, "style.css"),
    `\n.diagram{display:block;margin:24px 0}.diagram-scroll{display:block;overflow-x:auto;border:1px solid var(--line);border-radius:6px;padding:16px;background:#fff}.diagram-scroll:focus-visible{outline:3px solid #d78b24;outline-offset:4px}.diagram-scroll img{width:100%;margin:auto;border:0;border-radius:0}.diagram-links{display:block;margin-top:8px;color:var(--muted);font-size:13px}@media print{.diagram-scroll{overflow:visible;padding:0;border:0}.diagram-scroll img{min-width:0!important;max-width:100%!important}.diagram-links{display:none}}\n`,
    { flag: "a" },
  );
  await writeFile(
    resolve(output, "style.css"),
    "\n.docs-brand{display:inline-flex;align-items:center;gap:10px;flex-shrink:0}.docs-brand img{width:44px;height:44px;max-height:none;object-fit:contain;border:0;border-radius:10px;background:#fff8ed;padding:3px}\n",
    { flag: "a" },
  );
  await writeFile(
    resolve(output, "style.css"),
    "\n.language-switch{margin-left:auto;font-size:14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.language-switch a{font-size:14px;font-weight:500}nav a[aria-current=page]{background:#e8eef5;font-weight:750}.language-switch a[aria-current=page]{font-weight:750;text-decoration:underline}@media(max-width:800px){.language-switch{width:100%;margin-left:0}}\n",
    { flag: "a" },
  );
  console.log(
    `Docs built: ${pages.size} pages, ${ranked.length} translation pairs, ${checkedLinks} local links and ${checkedDiagrams} diagram sources verified; ${output}/index.html`,
  );
  return {
    pages: pages.size,
    pairs: ranked.length,
    checkedLinks,
    checkedDiagrams,
    output,
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await buildDocs();
