import fs from "fs/promises";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { launchBrowser } from "./browser.mjs";
import {
  prepareAndCapture,
  checkSessionValid,
  getViewPortForSite,
} from "./capture.mjs";
import { enrichTocItem } from "./naming.mjs";
import { resolvePaths } from "./site-config.mjs";

const DELAY_MS = 1200;

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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function clearTestDir(testDir) {
  const subdirs = ["screenshots", "pages"];
  try {
    await fs.rm(testDir, { recursive: true, force: true });
    console.log(`已清空试跑目录: ${testDir}`);
  } catch (err) {
    if (err.code === "EBUSY" || err.code === "EPERM") {
      console.warn(`无法删除整个 test 目录（文件可能被占用），改为清空子目录…`);
      for (const sub of subdirs) {
        const p = path.join(testDir, sub);
        try {
          await fs.rm(p, { recursive: true, force: true });
        } catch {
          const files = await fs.readdir(p).catch(() => []);
          for (const f of files) await fs.rm(path.join(p, f), { force: true }).catch(() => {});
        }
      }
    } else {
      throw err;
    }
  }
}

function buildTestItems(toc, from, testExtraUrl) {
  const pick = toc.slice(from, from + 3);
  const items = [...pick];
  if (testExtraUrl && !items.some((t) => t.url === testExtraUrl)) {
    const extra = toc.find((t) => t.url === testExtraUrl);
    if (extra) items.push(extra);
  }
  return items;
}

export async function runScrape(opts) {
  const paths = resolvePaths(opts.site, opts.section);
  const { site, pagesDir, shotsDir, tocFile, authFile } = paths;
  const outDir = opts.test ? path.resolve("test") : paths.outDir;
  const pages = opts.test ? path.join(outDir, "pages") : pagesDir;
  const shots = opts.test ? path.join(outDir, "screenshots") : shotsDir;

  if (opts.test) await clearTestDir(outDir);
  await fs.mkdir(pages, { recursive: true });
  await fs.mkdir(shots, { recursive: true });

  let items;
  if (opts.url) {
    items = [{ title: opts.url, url: opts.url }];
  } else {
    const toc = JSON.parse(await fs.readFile(tocFile, "utf8"));
    items = opts.test
      ? buildTestItems(toc, opts.from, paths.section.testExtraUrl)
      : toc.slice(opts.from);
    if (opts.limit > 0 && !opts.test) items = items.slice(0, opts.limit);
  }

  const needsAuth = opts.requireAuth && site.auth?.cookieName;
  const storageState =
    process.env.STORAGE_STATE || ((await fileExists(authFile)) ? authFile : null);

  if (!storageState && needsAuth) {
    console.error(`未找到登录态。请先: node login.mjs --site ${opts.site}`);
    process.exit(1);
  }

  const viewport = getViewPortForSite(site);
  const browser = await launchBrowser({ headless: true });
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    locale: site.locale || "zh-CN",
    ...(storageState ? { storageState } : {}),
  });
  const page = await context.newPage();

  if (needsAuth && storageState) {
    const ok = await checkSessionValid(page, context, site);
    if (!ok) {
      console.error(`登录态无效，请: node login.mjs --site ${opts.site}`);
      await browser.close();
      process.exit(1);
    }
    console.log(`✓ 登录态有效（${site.auth?.cookieName || "cookie"}）`);
  }

  console.log(
    opts.test
      ? `[试跑] 待处理 ${items.length} 篇，站点 ${opts.site}/${opts.section}，输出: ${outDir}`
      : `待处理 ${items.length} 篇，站点 ${opts.site}/${opts.section}，输出: ${outDir}`
  );

  let ok = 0;
  let fail = 0;
  const usedSlugs = new Set();

  for (let i = 0; i < items.length; i++) {
    const raw = items[i];
    const order = opts.from + i + 1;
    const item = enrichTocItem(raw, order, usedSlugs);
    const { url, title, fileSlug } = item;
    const pngPath = path.join(shots, `${fileSlug}.png`);
    const pdfPath = path.join(pages, `${fileSlug}.pdf`);

    if (opts.resume && (await fileExists(pdfPath))) {
      console.log(`[${order}] 跳过 ${title || fileSlug}`);
      ok++;
      continue;
    }

    console.log(`[${order}/${opts.from + items.length}] ${title || url}`);
    console.log(`  文件: ${fileSlug}`);
    try {
      const cap = await prepareAndCapture(page, url, pngPath, {
        site,
        allowPaywall: opts.allowPaywall,
      });
      await pngToPdf(pngPath, pdfPath);
      const stat = await fs.stat(pngPath);
      const kb = Math.round(stat.size / 1024);
      const v = cap.meta.verify?.length ? ` ⚠ ${cap.meta.verify.join(";")}` : "";
      console.log(`  → PNG ${kb} KB, ${cap.width}x${cap.height}px${v}`);
      ok++;
    } catch (err) {
      console.error(`  失败: ${err.message}`);
      fail++;
    }
    await sleep(DELAY_MS);
  }

  await browser.close();
  console.log(`\n完成: 成功 ${ok}, 失败 ${fail}`);
  if (!opts.test) {
    console.log(`合并成书: node book.mjs --site ${opts.site} --section ${opts.section}`);
  } else {
    console.log(`试跑结果: ${outDir}/screenshots/ 与 ${outDir}/pages/`);
  }
}
