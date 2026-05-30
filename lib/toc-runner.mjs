import fs from "fs/promises";
import { fetchSidebarToc, fetchSitemapToc } from "./fetch-sidebar-toc.mjs";
import { fetchListToc } from "./fetch-list-toc.mjs";
import { resolvePaths } from "./site-config.mjs";

export async function runToc({ siteId, sectionId, storageState }) {
  const paths = resolvePaths(siteId, sectionId);
  const { site, section, tocFile } = paths;
  const mode = section.toc?.mode || "sidebar";
  let items;
  let source = mode;

  try {
    if (mode === "list") {
      items = await fetchListToc({ site, section, storageState });
    } else if (mode === "sidebar") {
      items = await fetchSidebarToc({ site, section, storageState });
    } else {
      throw new Error(`未知 toc.mode: ${mode}`);
    }
  } catch (err) {
    if (!section.sitemapPrefix) throw err;
    console.warn(`${mode}: ${err.message} → 改用 sitemap`);
    items = await fetchSitemapToc(section.sitemapPrefix);
    source = "sitemap";
  }

  await fs.writeFile(tocFile, JSON.stringify(items, null, 2), "utf8");
  console.log(`已写入 ${tocFile}，共 ${items.length} 条（来源: ${source}）`);
  if (items[0]?.pathTitles) {
    console.log(`示例: ${items[0].pathTitles.join(" / ")}`);
  }
}
