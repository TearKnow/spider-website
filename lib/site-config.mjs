import path from "path";
import labuladong, { buildLayoutCss as labuladongLayoutCss } from "../sites/labuladong.mjs";
import vue3Nuxt, { buildLayoutCss as vue3NuxtLayoutCss } from "../sites/vue3-nuxt.mjs";

const REGISTRY = {
  labuladong: { site: labuladong, buildLayoutCss: labuladongLayoutCss },
  "vue3-nuxt": { site: vue3Nuxt, buildLayoutCss: vue3NuxtLayoutCss },
};

export const DEFAULT_SITE_ID = "labuladong";
export const DEFAULT_SECTION_ID = "algo";

export function listSites() {
  return Object.keys(REGISTRY);
}

export function listSections(siteId = DEFAULT_SITE_ID) {
  const { site } = getSiteBundle(siteId);
  return Object.keys(site.sections || {});
}

/** @returns {{ site: import('../sites/labuladong.mjs').site, buildLayoutCss: Function }} */
export function getSiteBundle(siteId = DEFAULT_SITE_ID) {
  const bundle = REGISTRY[siteId];
  if (!bundle) {
    throw new Error(
      `未知站点 "${siteId}"，可用: ${listSites().join(", ")}。新站点见 sites/_template.mjs`
    );
  }
  return bundle;
}

export function getSite(siteId = DEFAULT_SITE_ID) {
  return getSiteBundle(siteId).site;
}

export function getSection(siteId, sectionId) {
  const site = getSite(siteId);
  const section = site.sections?.[sectionId];
  if (!section) {
    throw new Error(
      `未知章节 "${sectionId}"（站点 ${siteId}），可用: ${listSections(siteId).join(", ")}`
    );
  }
  return { ...section, id: sectionId };
}

export function absUrl(site, urlOrPath) {
  if (!urlOrPath) return site.baseUrl;
  if (urlOrPath.startsWith("http")) return urlOrPath;
  return `${site.baseUrl.replace(/\/$/, "")}${urlOrPath.startsWith("/") ? "" : "/"}${urlOrPath}`;
}

export function resolvePaths(siteId, sectionId) {
  const site = getSite(siteId);
  const section = getSection(siteId, sectionId);
  const outDir = path.resolve(section.output.dir);
  return {
    site,
    section,
    tocFile: path.resolve(section.tocFile),
    outDir,
    pagesDir: path.join(outDir, "pages"),
    shotsDir: path.join(outDir, "screenshots"),
    bookFile: path.resolve(section.output.book),
    authFile: path.resolve(site.auth?.file || "auth.json"),
    startUrl: absUrl(site, section.toc.startPath),
    loginUrl: absUrl(site, site.auth?.loginPath || "/"),
    verifyUrl: absUrl(site, site.auth?.verifyPath || section.toc.startPath),
  };
}

export function getViewport(site) {
  return site.layout?.viewport || { width: 1920, height: 1080 };
}

export function getLayoutCss(siteId, viewport) {
  const { site, buildLayoutCss } = getSiteBundle(siteId);
  return buildLayoutCss(site, viewport);
}
