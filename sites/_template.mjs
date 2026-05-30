/**
 * 新站点适配模板 — 复制为 sites/your-site.mjs 并在 lib/site-config.mjs 注册
 *
 * 必填：baseUrl、selectors、sections
 * 可选：auth、layout、buildLayoutCss（可从 labuladong.mjs 复制后改 CSS）
 */

export const site = {
  id: "example",
  name: "示例文档站",
  baseUrl: "https://docs.example.com",
  locale: "zh-CN",

  auth: {
    file: "auth-example.json",
    cookieName: "session",
    loginPath: "/login",
    verifyPath: "/docs/member-only-page",
    sessionCheckPath: "/docs/member-only-page",
    paywallPatterns: ["登录后查看", "成为会员"],
    verifyMinMainLength: 1000,
  },

  selectors: {
    sidebar: "nav.sidebar",
    rightToc: "aside.toc",
    main: "main",
    captureRoot: "[data-capture-root]",
    sidebarScrollRoot: null,
    rightTocMarker: "",
  },

  skipButtonTexts: [],

  layout: {
    mode: "three-column",
    viewport: { width: 1920, height: 1080 },
    sidebarWidth: 280,
    rightTocWidth: 240,
    requireRightToc: false,
    hideSelectors: ["header", "footer"],
  },

  sections: {
    docs: {
      toc: {
        mode: "sidebar",
        startPath: "/docs/",
        hrefIncludes: "/docs/",
        minItems: 1,
      },
      sitemapPrefix: "https://docs.example.com/docs/",
      tocFile: "toc-example.json",
      output: {
        dir: "output/example",
        book: "output/example-book.pdf",
      },
    },
  },
};

export function buildLayoutCss(siteConfig, viewport) {
  const { selectors, layout } = siteConfig;
  const hide = (layout.hideSelectors || []).join(",\n      ");
  return `
      ${hide} { display: none !important; }
      html, body { margin: 0 !important; background: #fff !important; }
      ${selectors.captureRoot} {
        display: flex !important;
        width: ${viewport.width}px !important;
      }
      ${selectors.sidebar} { width: ${layout.sidebarWidth}px !important; flex-shrink: 0 !important; }
      ${selectors.main} { flex: 1 !important; overflow: visible !important; }
    `;
}

export default site;
