/**
 * 三栏截图引擎：滚到底加载 → 展开正文 → CDP 裁切，超高则无重叠分块拼接
 * 站点差异通过 sites/*.mjs 配置注入
 */

import fs from "fs/promises";
import path from "path";
import { getSite, getLayoutCss, getViewport, absUrl } from "./site-config.mjs";
import { verifyCaptureFile } from "./verify-capture.mjs";
import { stitchPngVertical } from "./stitch-png.mjs";

export { VIEWPORT } from "./viewport.mjs";

const CDP_CHUNK_H = 3500;
const CDP_SINGLE_MAX_H = 12000;

function resolveSite(siteOrId) {
  if (!siteOrId) return getSite();
  if (typeof siteOrId === "string") return getSite(siteOrId);
  return siteOrId;
}

function skipButton(site, t) {
  if (!t || t.length < 2) return true;
  return (site.skipButtonTexts || []).some((s) => t.includes(s));
}

export function getViewPortForSite(siteOrId) {
  return getViewport(resolveSite(siteOrId));
}

export async function dismissUiOverlays(page, siteOrId) {
  const site = resolveSite(siteOrId);
  const mainSel = site.selectors?.main || "main";
  await page.keyboard.press("Escape").catch(() => {});
  await page.keyboard.press("Escape").catch(() => {});
  await page.locator(mainSel).first().click({ position: { x: 60, y: 80 }, force: true }).catch(() => {});
  await page.evaluate(() => {
    document.querySelectorAll('[data-state="open"]').forEach((el) => {
      el.setAttribute("data-state", "closed");
    });
    document
      .querySelectorAll(
        '[role="menu"], [role="dialog"], [role="tooltip"], [data-radix-popper-content-wrapper]'
      )
      .forEach((el) => el.remove());
  });
}

export async function getSidebarItemMeta(page, url, siteOrId) {
  const site = resolveSite(siteOrId);
  const pathname = new URL(url).pathname.replace(/\/$/, "");
  const { selectors, baseUrl, skipButtonTexts } = site;

  return page.evaluate(
    ({ path, baseUrl, selectors, skipButtonTexts }) => {
      const left = document.querySelector(selectors.sidebar);
      if (!left) return null;

      const norm = (h) => {
        if (!h) return "";
        try {
          const u = h.startsWith("http") ? h : `${baseUrl}${h.startsWith("/") ? "" : "/"}${h}`;
          return new URL(u).pathname.replace(/\/$/, "");
        } catch {
          return h.replace(/\/$/, "");
        }
      };

      const skip = (t) =>
        !t ||
        skipButtonTexts.some((s) => t.includes(s)) ||
        t.length < 2;

      const target = path.replace(/\/$/, "");
      const link = [...left.querySelectorAll("a[href]")].find(
        (a) => norm(a.getAttribute("href")) === target
      );
      if (!link) return null;

      const title = (link.innerText || "").trim().replace(/\s+/g, " ");
      const ancestors = [];
      let el = link.parentElement;
      while (el && left.contains(el)) {
        const parent = el.parentElement;
        if (parent) {
          const btn = [...parent.children].find(
            (c) => c.tagName === "BUTTON" && (c.innerText?.trim() || "").length > 1 && !skip(c.innerText)
          );
          if (btn) ancestors.unshift(btn.innerText.trim().replace(/\s+/g, " "));
        }
        el = parent;
      }
      return { title, pathTitles: [...ancestors, title] };
    },
    { path: pathname, baseUrl, selectors, skipButtonTexts }
  );
}

export async function expandSidebarToCurrent(page, url, siteOrId) {
  const site = resolveSite(siteOrId);
  if (!site.selectors?.sidebar || site.layout?.requireLeftSidebar === false) {
    return;
  }
  const pathname = new URL(url).pathname.replace(/\/$/, "") || new URL(url).pathname;
  const { selectors, baseUrl } = site;

  const labels = await page.evaluate(
    ({ path, baseUrl, selectors }) => {
      const left = document.querySelector(selectors.sidebar);
      if (!left) return [];
      const norm = (h) => {
        if (!h) return "";
        try {
          const u = h.startsWith("http") ? h : `${baseUrl}${h.startsWith("/") ? "" : "/"}${h}`;
          return new URL(u).pathname.replace(/\/$/, "");
        } catch {
          return h.replace(/\/$/, "");
        }
      };
      const target = path.replace(/\/$/, "");
      const link = [...left.querySelectorAll("a[href]")].find(
        (a) => norm(a.getAttribute("href")) === target
      );
      if (!link) return [];

      const buttons = [];
      let el = link.parentElement;
      while (el && left.contains(el)) {
        const parent = el.parentElement;
        if (parent) {
          const btn = [...parent.children].find(
            (c) =>
              c.tagName === "BUTTON" &&
              c.getAttribute("aria-expanded") === "false" &&
              (c.innerText?.trim() || "").length > 1
          );
          if (btn) buttons.unshift(btn.innerText.trim());
        }
        el = parent;
      }
      return [...new Set(buttons)];
    },
    { path: pathname, baseUrl, selectors }
  );

  for (const label of labels) {
    await page.getByRole("button", { name: label, exact: true }).click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(120);
  }
  await dismissUiOverlays(page, site);
}

export async function expandMainCollapsibles(page, siteOrId) {
  const site = resolveSite(siteOrId);
  const mainSel = site.selectors.main;

  for (let round = 0; round < 24; round++) {
    await page.evaluate((sel) => {
      const main = document.querySelector(sel);
      if (!main) return;
      main.querySelectorAll("details").forEach((d) => {
        d.open = true;
      });
    }, mainSel);

    const labels = await page.evaluate((sel) => {
      const main = document.querySelector(sel);
      if (!main) return [];
      return [...main.querySelectorAll("button[aria-expanded='false']")]
        .map((b) => b.innerText?.trim())
        .filter((t) => t && !t.includes("标记阅读") && !t.includes("复制") && t.length > 1);
    }, mainSel);
    const todo = labels.filter((t) => !skipButton(site, t));
    if (!todo.length) break;
    for (const label of todo) {
      await page
        .locator(mainSel)
        .getByRole("button", { name: label, exact: true })
        .click({ timeout: 4000 })
        .catch(() => {});
      await page.waitForTimeout(150);
    }
  }
  await waitForAssets(page);
}

export async function waitForAssets(page) {
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    for (const img of document.querySelectorAll("img")) {
      const ds =
        img.getAttribute("data-src") ||
        img.getAttribute("data-original") ||
        img.getAttribute("data-lazy-src");
      if (ds && (!img.src || !img.complete)) img.src = ds;
      img.loading = "eager";
      img.removeAttribute("loading");
    }

    await Promise.all(
      [...document.images].map(
        (img) =>
          new Promise((res) => {
            if (img.complete && img.naturalWidth > 0) return res();
            img.onload = img.onerror = res;
            setTimeout(res, 25000);
          })
      )
    );
    if (document.fonts?.ready) await document.fonts.ready;
    await sleep(500);
  });

  await page
    .waitForFunction(
      () => {
        const pending = [...document.images].filter(
          (img) => !img.complete || (img.src && !img.src.startsWith("data:") && img.naturalWidth === 0)
        );
        return pending.length === 0;
      },
      { timeout: 120_000 }
    )
    .catch(() => {});
}

export async function scrollWindowToLoad(page) {
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const step = Math.max(400, Math.floor(window.innerHeight * 0.85));
    window.scrollTo(0, 0);
    await sleep(200);
    let y = 0;
    const max = () => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    while (y < max()) {
      y = Math.min(y + step, max());
      window.scrollTo(0, y);
      await sleep(180);
    }
    window.scrollTo(0, max());
    await sleep(600);
    window.scrollTo(0, 0);
    await sleep(300);
  });
  await waitForAssets(page);
}

export async function applyCaptureLayout(page, siteOrId) {
  const site = resolveSite(siteOrId);
  const viewport = getViewport(site);
  const css = getLayoutCss(site.id, viewport);
  const { selectors } = site;

  await page.addStyleTag({ content: css });

  await page.evaluate((selectors) => {
    const main = document.querySelector(selectors.main);
    if (!main) return;

    if (selectors.captureRootSource) {
      const root = document.querySelector(selectors.captureRootSource);
      if (!root) return;
      root.setAttribute("data-capture-root", "1");
      root.style.transform = "none";

      let p = root.parentElement;
      while (p && p !== document.body) {
        p.style.overflow = "visible";
        p.style.overflowY = "visible";
        p.style.height = "auto";
        p.style.maxHeight = "none";
        p.style.minHeight = "0";
        p = p.parentElement;
      }

      for (const el of main.querySelectorAll("*")) {
        const s = getComputedStyle(el);
        if (s.position === "sticky" || s.position === "fixed") {
          el.style.position = "static";
        }
      }

      main.querySelectorAll("details").forEach((d) => {
        d.open = true;
      });

      for (const el of main.querySelectorAll(".overflow-y-auto, .overflow-auto")) {
        if (el.querySelector("iframe")) continue;
        el.style.overflow = "visible";
        el.style.overflowY = "visible";
        el.style.maxHeight = "none";
      }
      return;
    }

    const leftAside = document.querySelector(selectors.sidebar);
    if (!leftAside) return;
    let root = leftAside.parentElement;
    while (root && !root.contains(main)) root = root.parentElement;
    if (!root) return;

    root.setAttribute("data-capture-root", "1");
    root.style.transform = "none";

    let p = root.parentElement;
    while (p && p !== document.body) {
      p.style.overflow = "visible";
      p.style.overflowY = "visible";
      p.style.height = "auto";
      p.style.maxHeight = "none";
      p.style.minHeight = "0";
      p = p.parentElement;
    }

    for (const el of main.querySelectorAll("*")) {
      const s = getComputedStyle(el);
      if (s.position === "sticky" || s.position === "fixed") {
        el.style.position = "static";
      }
    }

    main.querySelectorAll("details").forEach((d) => {
      d.open = true;
    });

    for (const el of main.querySelectorAll(".overflow-y-auto, .overflow-auto")) {
      if (el.querySelector("iframe")) continue;
      el.style.overflow = "visible";
      el.style.overflowY = "visible";
      el.style.maxHeight = "none";
    }
  }, selectors);
}

export async function waitForEmbeds(page, siteOrId) {
  const site = resolveSite(siteOrId);
  const mainSel = site.selectors.main;

  await page.evaluate((sel) => {
    document.querySelectorAll(`${sel} details`).forEach((d) => {
      d.open = true;
    });
  }, mainSel);
  await page.waitForTimeout(500);

  await page
    .waitForFunction(
      (sel) => {
        const iframes = [...document.querySelectorAll(`${sel} iframe`)];
        if (!iframes.length) return true;
        return iframes.every((f) => {
          const r = f.getBoundingClientRect();
          return r.width > 50 && r.height >= 200;
        });
      },
      mainSel,
      { timeout: 90_000 }
    )
    .catch(() => {});

  const roadmap = page.locator(`${mainSel} iframe[src*="roadmap"]`).first();
  if (await roadmap.count()) {
    await roadmap.waitFor({ state: "attached", timeout: 30_000 }).catch(() => {});
    await page
      .waitForFunction(
        (sel) => {
          const f = document.querySelector(`${sel} iframe[src*="roadmap"]`);
          return f && f.offsetHeight >= 400;
        },
        mainSel,
        { timeout: 60_000 }
      )
      .catch(() => {});
  }
  await page.waitForTimeout(800);
}

async function measureCaptureRoot(page, fallbackWidth, site) {
  const captureRootSel = site.selectors.captureRoot;
  const mainSel = site.selectors.main;

  return page.evaluate(
    ({ fallbackWidth, captureRootSel, mainSel }) => {
      const root = document.querySelector(captureRootSel);
      const main = document.querySelector(mainSel);
      if (!root) return null;
      const r = root.getBoundingClientRect();
      let bottom = r.top;
      for (const child of root.children) {
        bottom = Math.max(bottom, child.getBoundingClientRect().bottom);
      }
      const paintH = Math.ceil(bottom - r.top);
      return {
        width: Math.ceil(r.width) || fallbackWidth,
        height: paintH,
        mainHeight: main?.scrollHeight ?? 0,
        textLen: main?.innerText?.length ?? 0,
      };
    },
    { fallbackWidth, captureRootSel, mainSel }
  );
}

async function getCaptureRootRect(page, fallbackWidth, site) {
  const captureRootSel = site.selectors.captureRoot;
  const mainSel = site.selectors.main;

  return page.evaluate(
    ({ fallbackWidth, captureRootSel, mainSel }) => {
      const root = document.querySelector(captureRootSel);
      const main = document.querySelector(mainSel);
      if (!root || !main) return null;
      const r = root.getBoundingClientRect();
      const mainRect = main.getBoundingClientRect();
      let bottom = r.top;
      for (const child of root.children) {
        bottom = Math.max(bottom, child.getBoundingClientRect().bottom);
      }
      bottom = Math.max(bottom, mainRect.bottom);
      const paintH = Math.max(1, Math.ceil(bottom - r.top));
      return {
        x: Math.max(0, Math.floor(r.left + window.scrollX)),
        y: Math.max(0, Math.floor(r.top + window.scrollY)),
        width: Math.ceil(r.width) || fallbackWidth,
        height: paintH,
      };
    },
    { fallbackWidth, captureRootSel, mainSel }
  );
}

async function captureRootOnce(page, outPngPath, site) {
  const viewport = getViewport(site);

  await fs.mkdir(path.dirname(outPngPath), { recursive: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);

  const info = await measureCaptureRoot(page, viewport.width, site);
  if (!info?.height) throw new Error(`未找到 ${site.selectors.captureRoot}`);

  const rect = await getCaptureRootRect(page, viewport.width, site);
  if (!rect?.height) throw new Error("无法测量截图区域");

  const cdp = await page.context().newCDPSession(page);

  async function shotClip(clip) {
    const { data } = await cdp.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      fromSurface: true,
      clip: { ...clip, scale: 1 },
    });
    return Buffer.from(data, "base64");
  }

  if (rect.height <= CDP_SINGLE_MAX_H) {
    const buf = await shotClip({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    });
    await fs.writeFile(outPngPath, buf);
    return { mode: "cdp-single", chunks: 1, ...info };
  }

  const parts = [];
  let offset = 0;
  let idx = 0;
  while (offset < rect.height) {
    const h = Math.min(CDP_CHUNK_H, rect.height - offset);
    const buf = await shotClip({
      x: rect.x,
      y: rect.y + offset,
      width: rect.width,
      height: h,
    });
    const partPath = `${outPngPath}.part${idx}.png`;
    await fs.writeFile(partPath, buf);
    parts.push({ path: partPath, height: h });
    offset += h;
    idx++;
  }
  stitchPngVertical(parts, outPngPath);
  for (const p of parts) await fs.unlink(p.path).catch(() => {});
  return { mode: "cdp-stitch", chunks: parts.length, ...info };
}

export async function waitForArticleReady(page, siteOrId) {
  const site = resolveSite(siteOrId);
  const { selectors, layout } = site;

  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle", { timeout: 90_000 }).catch(() => {});
  await page.waitForSelector(selectors.main, { timeout: 30_000 });
  if (selectors.sidebar && layout?.requireLeftSidebar !== false) {
    await page.waitForSelector(selectors.sidebar, { timeout: 30_000 });
  }
  if (layout?.requireRightToc && selectors.rightToc) {
    await page.waitForSelector(selectors.rightToc, { timeout: 30_000 }).catch(() => {});
  }
  await page.waitForTimeout(1000);
}

export async function checkSessionValid(page, context, siteOrId) {
  const site = resolveSite(siteOrId);
  if (!site.auth?.cookieName && !site.auth?.sessionCheckPath) return true;
  const auth = site.auth || {};
  const cookieName = auth.cookieName || "site-token";

  const cookies = await context.cookies(site.baseUrl);
  if (cookies.some((c) => c.name === cookieName && c.value)) return true;

  if (auth.sessionCheckPath) {
    await page.goto(absUrl(site, auth.sessionCheckPath), { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    return !(await hasPaywall(page, site));
  }
  return false;
}

export async function hasPaywall(page, siteOrId) {
  const site = resolveSite(siteOrId);
  const patterns = site.auth?.paywallPatterns;
  if (!patterns?.length) return false;
  return page.evaluate((patterns) => {
    const t = document.body?.innerText || "";
    return patterns.some((p) => t.includes(p));
  }, patterns);
}

export async function captureArticle(page, outPngPath, siteOrId) {
  const site = resolveSite(siteOrId);
  const { selectors, layout } = site;
  const captureRootSel = selectors.captureRoot;

  await page.locator(captureRootSel).first().waitFor({ state: "visible", timeout: 30_000 });

  const expected = await page.evaluate(
    ({ selectors, rightTocMarker }) => {
      const left = document.querySelector(selectors.sidebar);
      const right = document.querySelector(selectors.rightToc);
      const main = document.querySelector(selectors.main);
      return {
        hasLeft: !!left && left.offsetWidth > 100,
        hasRight: !!right && right.offsetWidth > 100,
        rightToc: rightTocMarker ? right?.innerText?.includes(rightTocMarker) ?? false : true,
        mainHeight: main?.scrollHeight ?? 0,
      };
    },
    { selectors, rightTocMarker: selectors.rightTocMarker }
  );

  if (layout.requireLeftSidebar !== false && selectors.sidebar && !expected.hasLeft) {
    throw new Error("截图前未检测到左侧目录栏");
  }
  if (layout.requireRightToc && selectors.rightToc && !expected.hasRight) {
    throw new Error("截图前未检测到右侧大纲栏");
  }

  await dismissUiOverlays(page, site);
  const shot = await captureRootOnce(page, outPngPath, site);

  const verify = verifyCaptureFile(outPngPath, {
    minHeight: Math.min(600, shot.height * 0.35),
  });
  if (!verify.ok) throw new Error(`截图校验失败: ${verify.issues.join("; ")}`);
  if (verify.height < expected.mainHeight * 0.45) {
    throw new Error(
      `截图高度 ${verify.height}px 明显小于正文 ${expected.mainHeight}px，可能被裁切`
    );
  }

  return {
    path: outPngPath,
    width: verify.width,
    height: verify.height,
    meta: {
      mode: shot.mode,
      chunks: shot.chunks,
      expectedHeight: shot.height,
      textLen: shot.textLen,
      rightToc: expected.rightToc,
      verify: verify.issues,
    },
  };
}

export async function prepareAndCapture(page, url, outPngPath, options = {}) {
  const site = resolveSite(options.site);
  const { allowPaywall = false } = options;

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await waitForArticleReady(page, site);
  await expandSidebarToCurrent(page, url, site);
  await scrollWindowToLoad(page);
  await expandMainCollapsibles(page, site);
  await waitForEmbeds(page, site);
  await applyCaptureLayout(page, site);
  await waitForEmbeds(page, site);
  await scrollWindowToLoad(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);

  if (!allowPaywall && site.auth?.paywallPatterns?.length && (await hasPaywall(page, site))) {
    throw new Error(`检测到会员墙，请先 node login.mjs --site ${site.id}`);
  }

  return captureArticle(page, outPngPath, site);
}

export async function expandSidebar(page, siteOrId) {
  const site = resolveSite(siteOrId);
  const sel = site.selectors.sidebar;
  if (!sel) return;

  for (let round = 0; round < 32; round++) {
    const labels = await page.evaluate((sidebarSel) => {
      const left = document.querySelector(sidebarSel);
      if (!left) return [];
      return [...left.querySelectorAll("button[aria-expanded='false']")]
        .map((b) => b.innerText?.trim())
        .filter(Boolean);
    }, sel);
    const todo = labels.filter((t) => !skipButton(site, t));
    if (!todo.length) break;
    for (const label of todo) {
      await page.getByRole("button", { name: label, exact: true }).click({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(100);
    }
  }
  await dismissUiOverlays(page, site);
}
