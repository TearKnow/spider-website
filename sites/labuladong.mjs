/** labuladong.online 站点适配 */

export const site = {
  id: "labuladong",
  name: "labuladong.online",
  baseUrl: "https://labuladong.online",
  locale: "zh-CN",

  auth: {
    file: "auth.json",
    cookieName: "site-token",
    loginPath: "/zh/algo/home/",
    verifyPath: "/zh/ai-coding/basics/mcp-protocol/",
    sessionCheckPath: "/zh/algo/data-structure/binary-tree-part1/",
    paywallPatterns: [
      "成为会员即可解锁",
      "尚未登录",
      "没有权限",
      "解锁全文",
    ],
    verifyMinMainLength: 3000,
  },

  selectors: {
    sidebar: "aside:not(.algo-toc)",
    rightToc: "aside.algo-toc",
    main: "main",
    captureRoot: "[data-capture-root]",
    sidebarScrollRoot: ".overflow-y-auto",
    rightTocMarker: "此页内容",
  },

  skipButtonTexts: [
    "标记阅读状态",
    "清除阅读历史",
    "复制链接",
    "全屏",
  ],

  layout: {
    mode: "three-column",
    viewport: { width: 1920, height: 1080 },
    sidebarWidth: 320,
    rightTocWidth: 260,
    requireRightToc: true,
    hideSelectors: [
      'button[aria-label="打开 AI 聊天"]',
      "[data-ai-chat]",
      ".ai-chat",
      "header",
      "[data-radix-popper-content-wrapper]",
      '[role="menu"]',
      '[role="tooltip"]',
      '[role="dialog"]',
      ".sticky.top-12.pc\\:hidden",
      ".sticky.top-12.lg\\:top-14.pc\\:hidden",
      ".fixed.top-20.right-4.z-50",
    ],
  },

  sections: {
    algo: {
      toc: {
        mode: "sidebar",
        startPath: "/zh/algo/home/",
        hrefIncludes: "/zh/algo/",
        minItems: 50,
      },
      sitemapPrefix: "https://labuladong.online/zh/algo/",
      tocFile: "toc.json",
      output: {
        dir: "output",
        book: "output/labuladong-book.pdf",
      },
      testExtraUrl:
        "https://labuladong.online/zh/algo/problem-set/dynamic-programming-i/",
    },
    "ai-coding": {
      toc: {
        mode: "sidebar",
        startPath: "/zh/ai-coding/ai-guide/",
        hrefIncludes: "/zh/ai-coding/",
        minItems: 5,
      },
      sitemapPrefix: "https://labuladong.online/zh/ai-coding/",
      tocFile: "toc-ai-coding.json",
      output: {
        dir: "output/ai-coding",
        book: "output/ai-coding-book.pdf",
      },
    },
  },
};

/** 三栏布局 CSS（站点专用，新站点可覆写此函数） */
export function buildLayoutCss(siteConfig, viewport) {
  const { selectors, layout } = siteConfig;
  const hide = (layout.hideSelectors || []).join(",\n      ");

  return `
      ${hide} {
        display: none !important;
      }

      html, body {
        margin: 0 !important;
        padding: 0 !important;
        height: auto !important;
        overflow: visible !important;
        background: #fff !important;
      }

      .min-h-screen.h-screen.overflow-y-auto,
      div.h-screen.overflow-y-auto {
        height: auto !important;
        min-height: 0 !important;
        overflow: visible !important;
      }

      ${selectors.captureRoot} {
        display: flex !important;
        flex-direction: row !important;
        align-items: flex-start !important;
        width: ${viewport.width}px !important;
        max-width: ${viewport.width}px !important;
        min-width: ${viewport.width}px !important;
        margin: 0 auto !important;
        overflow: visible !important;
        box-sizing: border-box !important;
        background: #fff !important;
        transform: none !important;
      }

      ${selectors.sidebar},
      ${selectors.rightToc} {
        display: block !important;
        visibility: visible !important;
        flex-shrink: 0 !important;
        position: static !important;
        top: auto !important;
      }

      ${selectors.sidebar} {
        width: ${layout.sidebarWidth}px !important;
        min-width: ${layout.sidebarWidth}px !important;
        max-height: calc(100vh - 4rem) !important;
        overflow: hidden !important;
      }

      ${selectors.rightToc} {
        width: ${layout.rightTocWidth}px !important;
        min-width: ${layout.rightTocWidth}px !important;
        height: auto !important;
        overflow: visible !important;
      }

      ${selectors.captureRoot} > .flex-1 {
        flex: 1 1 auto !important;
        min-width: 0 !important;
        overflow: visible !important;
        height: auto !important;
      }

      ${selectors.main} {
        overflow: visible !important;
        height: auto !important;
        max-height: none !important;
      }

      ${selectors.main} details {
        overflow: visible !important;
      }

      ${selectors.main} details[open] > *:not(summary) {
        display: block !important;
        visibility: visible !important;
        overflow: visible !important;
      }

      ${selectors.main} details:has(iframe) {
        open: true;
      }
      ${selectors.main} details > div:has(iframe),
      ${selectors.main} [class*="h-[80vh]"],
      ${selectors.main} [class*="h-\\[80vh\\]"] {
        height: 80vh !important;
        min-height: 520px !important;
        max-height: none !important;
        overflow: visible !important;
      }

      ${selectors.main} iframe {
        display: block !important;
        width: 100% !important;
        height: 100% !important;
        min-height: 480px !important;
      }

      ${selectors.main} img {
        max-width: 100% !important;
        height: auto !important;
      }
      pre, code { white-space: pre-wrap !important; word-break: break-word !important; }
    `;
}

export default site;
