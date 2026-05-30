/**
 * 从站点侧边栏抓取目录（含中文 pathTitles）
 */
import { launchBrowser } from "./browser.mjs";
import { expandSidebar } from "./capture.mjs";
import { absUrl } from "./site-config.mjs";

function skipButtonText(site, t) {
  if (!t || t.length < 2) return true;
  return (site.skipButtonTexts || []).some((s) => t.includes(s));
}

export async function fetchSidebarToc({ site, section, storageState }) {
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
    await page.waitForSelector(`${site.selectors.sidebar} a[href*="${toc.hrefIncludes}"]`, {
      timeout: 25_000,
    });
    await expandSidebar(page, site);

    const items = await page.evaluate(
      ({ baseUrl, selectors, hrefIncludes, skipButtonTexts, scrollRootSel }) => {
        const left = document.querySelector(selectors.sidebar);
        if (!left) return [];

        const skipBtn = (t) =>
          !t || skipButtonTexts.some((s) => t.includes(s)) || t.length < 2;

        const normUrl = (href) => {
          let h = href || "";
          if (h.startsWith("/")) h = baseUrl + h;
          if (!h.endsWith("/")) h += "/";
          return h;
        };

        const seen = new Set();
        const out = [];

        function walk(node, stack) {
          if (!node) return;
          for (const child of node.children) {
            if (child.tagName === "BUTTON") {
              const t = (child.innerText || "").trim().replace(/\s+/g, " ");
              if (skipBtn(t)) continue;
              walk(child.nextElementSibling, [...stack, t]);
            } else if (child.tagName === "A") {
              const href = child.getAttribute("href") || "";
              if (!href.includes(hrefIncludes)) continue;
              const url = normUrl(href);
              if (seen.has(url)) continue;
              seen.add(url);
              const title = (child.innerText || "").trim().replace(/\s+/g, " ");
              if (!title) continue;
              out.push({ title, url, pathTitles: [...stack, title] });
            } else if (child.children?.length) {
              walk(child, stack);
            }
          }
        }

        const root =
          (scrollRootSel && left.querySelector(scrollRootSel)) ||
          left.querySelector(".overflow-y-auto") ||
          left;
        walk(root, []);
        return out;
      },
      {
        baseUrl: site.baseUrl,
        selectors: site.selectors,
        hrefIncludes: toc.hrefIncludes,
        skipButtonTexts: site.skipButtonTexts || [],
        scrollRootSel: site.selectors.sidebarScrollRoot,
      }
    );

    if (!items?.length) throw new Error("侧边栏链接为空");
    if (items.length < (toc.minItems || 1)) {
      throw new Error(`仅 ${items.length} 条，可能未展开完整目录`);
    }
    return items;
  } finally {
    await browser.close().catch(() => {});
  }
}

export async function fetchSitemapToc(prefix) {
  const origin = new URL(prefix).origin;
  const res = await fetch(`${origin}/sitemap.xml`);
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].trim())
    .filter((u) => u.startsWith(prefix))
    .sort()
    .map((url) => {
      const slug = url.replace(prefix, "").replace(/\/$/, "");
      const title = slug.split("/").pop().replace(/-/g, " ") || "未命名";
      return {
        title,
        url: url.endsWith("/") ? url : `${url}/`,
        pathTitles: [title],
      };
    });
}
