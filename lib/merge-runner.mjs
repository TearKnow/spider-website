import fs from "fs/promises";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { setOutline } from "./pdf-outline.mjs";
import { parseFileSlug, buildOutlineFromLevels, enrichTocItem } from "./naming.mjs";
import { resolvePaths } from "./site-config.mjs";

function displayTitle(title, url) {
  if (title && !title.startsWith("http")) return title;
  try {
    const slug = new URL(url).pathname.replace(/\/$/, "");
    return slug.split("/").pop().replace(/-/g, " ") || "未命名";
  } catch {
    return title || "未命名";
  }
}

async function listMergeJobs(opts, toc) {
  if (opts.test) {
    const files = (await fs.readdir(opts.pagesDir))
      .filter((f) => f.endsWith(".pdf"))
      .sort();
    return files.map((f) => {
      const fileSlug = f.replace(/\.pdf$/, "");
      const { order, levels } = parseFileSlug(f);
      const hit =
        toc.find((t, idx) => enrichTocItem(t, idx + 1).fileSlug === fileSlug) ||
        toc.find((t) => enrichTocItem(t, order).fileSlug === fileSlug);
      return {
        fileSlug,
        levels,
        order,
        url: hit?.url || "",
        title: hit?.title || fileSlug,
        pdfPath: path.join(opts.pagesDir, f),
      };
    });
  }

  const slice = toc.slice(opts.from, opts.to);
  return slice.map((raw, i) => {
    const order = opts.from + i + 1;
    const item = enrichTocItem(raw, order);
    const { levels } = parseFileSlug(`${item.fileSlug}.pdf`);
    return {
      ...item,
      levels,
      pdfPath: path.join(opts.pagesDir, `${item.fileSlug}.pdf`),
    };
  });
}

export async function runMerge(opts) {
  const paths = resolvePaths(opts.site, opts.section);
  const tocFile = opts.tocFile || paths.tocFile;
  const pagesDir = opts.pagesDir || paths.pagesDir;
  const outFile = opts.out || paths.bookFile;

  const toc = JSON.parse(await fs.readFile(tocFile, "utf8"));
  const jobs = await listMergeJobs(
    { ...opts, pagesDir, tocFile },
    toc
  );

  const merged = await PDFDocument.create();
  const bookmarkEntries = [];
  let pageCursor = 0;
  let added = 0;

  for (const job of jobs) {
    const { url, title, fileSlug, levels, pdfPath } = job;
    try {
      const bytes = await fs.readFile(pdfPath);
      const doc = await PDFDocument.load(bytes);
      const pageCount = doc.getPageCount();
      const pages = await merged.copyPages(doc, doc.getPageIndices());
      pages.forEach((p) => merged.addPage(p));

      bookmarkEntries.push({
        title: displayTitle(title, url),
        url,
        fileSlug,
        levels,
        pageIndex: pageCursor,
        pageCount,
      });
      pageCursor += pageCount;
      added++;
      console.log(
        `+ [${bookmarkEntries.length}] p.${bookmarkEntries.at(-1).pageIndex + 1}  ${fileSlug}`
      );
    } catch {
      console.warn(`跳过（文件不存在）: ${pdfPath}`);
    }
  }

  if (added === 0) {
    console.error("没有可合并的 PDF，请先运行 scrape");
    process.exit(1);
  }

  const outline = buildOutlineFromLevels(bookmarkEntries);
  await setOutline(merged, outline);

  const outBytes = await merged.save();
  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, outBytes);

  console.log(`\n成书完成: ${outFile}`);
  console.log(`  合并 ${added} 篇，共 ${pageCursor} 页`);
  console.log(`  书签按文件名 L1/L2/... 嵌套，共 ${bookmarkEntries.length} 篇`);
}
