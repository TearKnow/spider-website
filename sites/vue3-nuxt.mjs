/** vue3-nuxt.vercel.app 博客站点适配 */

export const site = {
  id: "vue3-nuxt",
  name: "vue3-nuxt 博客",
  baseUrl: "https://vue3-nuxt.vercel.app",
  locale: "zh-CN",

  selectors: {
    sidebar: null,
    rightToc: "nav.toc.desktop-toc",
    main: ".article-body",
    captureRoot: "[data-capture-root]",
    captureRootSource: ".article-shell",
    rightTocMarker: "目录",
  },

  skipButtonTexts: [],

  layout: {
    mode: "article-toc",
    viewport: { width: 1920, height: 1080 },
    requireLeftSidebar: false,
    requireRightToc: true,
    hideSelectors: [
      ".top-bar",
      ".reading-progress",
      ".toc-toggle",
      "nav.toc.mobile-toc",
      ".comment-nav-btn",
      "footer",
    ],
  },

  sections: {
    blog: {
      toc: {
        mode: "list",
        startPath: "/blog",
        linkSelector: "a.blog-post-list-card__title",
        hrefPattern: "^/blog/[^/]+$",
        pathTitlesPrefix: ["博客"],
        minItems: 1,
      },
      tocFile: "toc-vue3-nuxt-blog.json",
      output: {
        dir: "output/vue3-nuxt",
        book: "output/vue3-nuxt-blog.pdf",
      },
    },
  },
};

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

      .blog-article {
        overflow: visible !important;
        height: auto !important;
        min-height: 0 !important;
        background: #fff !important;
      }

      ${selectors.captureRootSource} {
        display: flex !important;
        flex-direction: row !important;
        align-items: flex-start !important;
        justify-content: center !important;
        gap: 24px !important;
        width: ${viewport.width}px !important;
        max-width: ${viewport.width}px !important;
        margin: 0 auto !important;
        overflow: visible !important;
        box-sizing: border-box !important;
        padding: 24px 48px !important;
        background: #fff !important;
      }

      ${selectors.captureRootSource} article {
        flex: 1 1 auto !important;
        min-width: 0 !important;
        max-width: 820px !important;
        overflow: visible !important;
      }

      ${selectors.main} {
        overflow: visible !important;
        height: auto !important;
        max-height: none !important;
      }

      ${selectors.rightToc} {
        display: block !important;
        visibility: visible !important;
        position: static !important;
        top: auto !important;
        flex: 0 0 240px !important;
        width: 240px !important;
        min-width: 240px !important;
        height: auto !important;
        max-height: none !important;
        overflow: visible !important;
      }

      ${selectors.main} details {
        overflow: visible !important;
      }

      ${selectors.main} details[open] > *:not(summary) {
        display: block !important;
        visibility: visible !important;
      }

      ${selectors.main} img {
        max-width: 100% !important;
        height: auto !important;
      }

      pre, code {
        white-space: pre-wrap !important;
        word-break: break-word !important;
      }
    `;
}

export default site;
