/** sitemap 备用目录（当 fetch-toc 失败时）— 按 URL 路径分组排序 */
import fs from "fs/promises";

const SITEMAP = "https://labuladong.online/sitemap.xml";
const PREFIX = "https://labuladong.online/zh/algo/";
const OUT = "toc.json";

const res = await fetch(SITEMAP);
const xml = await res.text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((m) => m[1].trim())
  .filter((u) => u.startsWith(PREFIX))
  .sort();

const items = urls.map((url) => ({
  title: url.replace(PREFIX, "").replace(/\/$/, ""),
  url: url.endsWith("/") ? url : url + "/",
}));

await fs.writeFile(OUT, JSON.stringify(items, null, 2), "utf8");
console.log(`已写入 ${OUT}，共 ${items.length} 条（sitemap 顺序，建议优先用 fetch-toc）`);
