/**
 * 抓取指定 URL（支持 algo / ai-coding 等），侧栏中文命名，可选合并 PDF
 *
 * 用法:
 *   node scrape-url.mjs --url https://labuladong.online/zh/ai-coding/ai-guide/
 *   node scrape-url.mjs --url ... --out-dir output/ai-coding --merge-out output/ai-coding-book.pdf
 */

import fs from "fs/promises";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { launchBrowser } from "./lib/browser.mjs";
import {
  prepareAndCapture,
  checkSessionValid,
  getSidebarItemMeta,
  getViewPortForSite,
  waitForArticleReady,
  expandSidebarToCurrent,
} from "./lib/capture.mjs";
import { getSite } from "./lib/site-config.mjs";
import { enrichTocItem, parseFileSlug, buildOutlineFromLevels } from "./lib/naming.mjs";
import { setOutline } from "./lib/pdf-outline.mjs";

const AUTH_FILE = path.resolve("auth.json");
const SITE = getSite("labuladong");

function parseArgs(argv) {
  const opts = {
    urls: [],
    outDir: path.resolve("output/extra"),
    mergeOut: null,
    tocFile: null,
    orderStart: 1,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--url" && argv[i + 1]) opts.urls.push(argv[++i]);
    else if (a === "--out-dir" && argv[i + 1]) opts.outDir = path.resolve(argv[++i]);
    else if (a === "--merge-out" && argv[i + 1]) opts.mergeOut = path.resolve(argv[++i]);
    else if (a === "--toc" && argv[i + 1]) opts.tocFile = path.resolve(argv[++i]);
    else if (a === "--from" && argv[i + 1]) opts.orderStart = Number(argv[++i]);
  }
  if (!opts.urls.length) {
    console.error("请指定 --url");
    process.exit(1);
  }
  if (!opts.tocFile) opts.tocFile = path.join(opts.outDir, "toc.json");
  return opts;
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function pngToPdf(pngPath, pdfPath) {
  const bytes = await fs.readFile(pngPath);
  const pdf = await PDFDocument.create();
  const img = await pdf.embedPng(bytes);
  const page = pdf.addPage([img.width, img.height]);
  page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  await fs.writeFile(pdfPath, await pdf.save());
}

async function mergePdfs(pagesDir, tocItems, outPath) {
  const merged = await PDFDocument.create();
  const bookmarkEntries = [];
  let pageCursor = 0;

  for (let i = 0; i < tocItems.length; i++) {
    const item = enrichTocItem(tocItems[i], i + 1);
    const { levels } = parseFileSlug(`${item.fileSlug}.pdf`);
    const pdfPath = path.join(pagesDir, `${item.fileSlug}.pdf`);
    const bytes = await fs.readFile(pdfPath);
    const doc = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
    bookmarkEntries.push({
      title: item.title,
      fileSlug: item.fileSlug,
      levels,
      pageIndex: pageCursor,
    });
    pageCursor += doc.getPageCount();
  }

  await setOutline(merged, buildOutlineFromLevels(bookmarkEntries));
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, await merged.save());
  return { pages: pageCursor, articles: tocItems.length };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const pagesDir = path.join(opts.outDir, "pages");
  const shotsDir = path.join(opts.outDir, "screenshots");
  await fs.mkdir(pagesDir, { recursive: true });
  await fs.mkdir(shotsDir, { recursive: true });

  const storageState = (await fileExists(AUTH_FILE)) ? AUTH_FILE : process.env.STORAGE_STATE;
  if (!storageState) {
    console.error("请先 node login.mjs");
    process.exit(1);
  }

  const browser = await launchBrowser({ headless: true });
  const context = await browser.newContext({
    viewport: getViewPortForSite(SITE),
    storageState,
    locale: SITE.locale || "zh-CN",
  });
  const page = await context.newPage();

  const ok = await checkSessionValid(page, context, SITE);
  if (!ok) {
    console.error("auth.json 无效，请重新 login.mjs");
    await browser.close();
    process.exit(1);
  }

  const tocItems = [];
  const usedSlugs = new Set();
  let order = opts.orderStart;

  for (const url of opts.urls) {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await waitForArticleReady(page, SITE);
    await expandSidebarToCurrent(page, url, SITE);

    let meta = await getSidebarItemMeta(page, url, SITE);
    if (!meta?.title) {
      meta = {
        title: new URL(url).pathname.split("/").filter(Boolean).pop() || url,
        pathTitles: [meta?.title || url],
      };
    }

    const item = enrichTocItem({ title: meta.title, url, pathTitles: meta.pathTitles }, order, usedSlugs);
    const pngPath = path.join(shotsDir, `${item.fileSlug}.png`);
    const pdfPath = path.join(pagesDir, `${item.fileSlug}.pdf`);

    console.log(`[${order}] ${item.title}`);
    console.log(`  文件: ${item.fileSlug}`);

    const cap = await prepareAndCapture(page, url, pngPath, { site: SITE });
    await pngToPdf(pngPath, pdfPath);
    console.log(`  → PNG ${cap.width}x${cap.height}px`);

    tocItems.push({ title: item.title, url, pathTitles: item.pathTitles });
    order++;
  }

  await browser.close();

  await fs.writeFile(opts.tocFile, JSON.stringify(tocItems, null, 2), "utf8");
  console.log(`\n已写入 ${opts.tocFile}`);

  if (opts.mergeOut) {
    const r = await mergePdfs(pagesDir, tocItems, opts.mergeOut);
    console.log(`\nPDF: ${opts.mergeOut}`);
    console.log(`  ${r.articles} 篇，${r.pages} 页，书签按 L1/L2/... 嵌套`);
  } else {
    console.log(`\n合并: node merge-book.mjs --pages-dir ${pagesDir} --toc ${opts.tocFile} --out <输出.pdf>`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
