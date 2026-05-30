/**
 * 从列表页抓取文章链接（博客索引等）
 */
import { launchBrowser } from "./browser.mjs";
import { absUrl } from "./site-config.mjs";

export async function fetchListToc({ site, section, storageState }) {
  const { toc } = section;
  const startUrl = absUrl(site, toc.startPath);
  const viewport = site.layout?.viewport || { width: 1920, height: 1080 };

  const browser = await launchBrowser({ headless: true });
  const context = await browser.newContext({
    viewport,
    locale: site.locale || "zh-CN",
    ...(storageState ? { storageState } : {}),
  });
  const page = await context.newPage();
  page.setDefaultTimeout(25_000);

  try {
    await page.goto(startUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(toc.linkSelector, { timeout: 25_000 });

    const items = await page.evaluate(
      ({ baseUrl, linkSelector, hrefPattern, prefixTitles }) => {
        const re = new RegExp(hrefPattern);
        const normUrl = (href) => {
          let h = href || "";
          if (h.startsWith("/")) h = baseUrl + h;
          return h.replace(/\/$/, "") + "/";
        };

        const seen = new Set();
        const out = [];
        const stack = prefixTitles?.filter(Boolean) || [];

        for (const a of document.querySelectorAll(linkSelector)) {
          const href = a.getAttribute("href") || "";
          if (!re.test(href)) continue;
          const url = normUrl(href);
          if (seen.has(url)) continue;
          seen.add(url);

          let title = (a.innerText || "").trim().replace(/\s+/g, " ");
          title = title.replace(/^📌\s*/, "").trim();
          if (!title) continue;

          out.push({
            title,
            url,
            pathTitles: [...stack, title],
          });
        }
        return out;
      },
      {
        baseUrl: site.baseUrl,
        linkSelector: toc.linkSelector,
        hrefPattern: toc.hrefPattern,
        prefixTitles: toc.pathTitlesPrefix || [],
      }
    );

    if (!items?.length) throw new Error("列表页未找到文章链接");
    if (items.length < (toc.minItems || 1)) {
      throw new Error(`仅 ${items.length} 条，可能选择器不匹配`);
    }
    return items;
  } finally {
    await browser.close().catch(() => {});
  }
}
