/**
 * PDF 书签（目录大纲），改编自 Marp CLI (MIT)
 * https://github.com/marp-team/marp-cli/blob/main/src/utils/pdf.ts
 */

/** @typedef {{ title: string, to: number, italic?: boolean, bold?: boolean }} PDFOutlineItem */
/** @typedef {{ title: string, to?: number, children: PDFOutline[], open?: boolean }} PDFOutlineGroup */

/** @param {import('pdf-lib').PDFDocument} doc */
/** @param {readonly (PDFOutlineItem | PDFOutlineGroup)[]} outlines */
export async function setOutline(doc, outlines) {
  const { PDFHexString } = await import("pdf-lib");

  const rootRef = doc.context.nextRef();
  const refMap = new WeakMap();

  const flatten = (items) => {
    const result = [];
    const walk = (list) => {
      for (const o of list) {
        result.push(o);
        if (o.children?.length) walk(o.children);
      }
    };
    walk(items);
    return result;
  };

  const walk = (items, callback) => {
    for (const o of items) {
      const ret = callback(o);
      if (o.children?.length && ret !== false) walk(o.children, callback);
    }
  };

  const getOpeningCount = (items) => {
    let count = 0;
    walk(items, (o) => {
      count += 1;
      return !("open" in o && o.open === false);
    });
    return count;
  };

  for (const outline of flatten(outlines)) {
    refMap.set(outline, doc.context.nextRef());
  }

  const pageRefs = (() => {
    const refs = [];
    doc.catalog.Pages().traverse((kid, ref) => {
      if (kid.get(kid.context.obj("Type"))?.toString() === "/Page") {
        refs.push(ref);
      }
    });
    return refs;
  })();

  const createOutline = (items, parent) => {
    for (let i = 0; i < items.length; i++) {
      const outline = items[i];
      const outlineRef = refMap.get(outline);

      const destOrAction = (() => {
        if (typeof outline.to === "number") {
          return { Dest: [pageRefs[outline.to], "Fit"] };
        }
        return {};
      })();

      const childrenDict = (() => {
        if (outline.children?.length > 0) {
          createOutline(outline.children, outlineRef);
          return {
            First: refMap.get(outline.children[0]),
            Last: refMap.get(outline.children[outline.children.length - 1]),
            Count: getOpeningCount(outline.children) * (outline.open !== false ? 1 : -1),
          };
        }
        return {};
      })();

      doc.context.assign(
        outlineRef,
        doc.context.obj({
          Title: PDFHexString.fromText(outline.title),
          Parent: parent,
          ...(i > 0 ? { Prev: refMap.get(items[i - 1]) } : {}),
          ...(i < items.length - 1 ? { Next: refMap.get(items[i + 1]) } : {}),
          ...childrenDict,
          ...destOrAction,
          F: (outline.italic ? 1 : 0) | (outline.bold ? 2 : 0),
        })
      );
    }
  };

  createOutline(outlines, rootRef);

  const rootCount = getOpeningCount(outlines);
  doc.context.assign(
    rootRef,
    doc.context.obj({
      Type: "Outlines",
      ...(rootCount > 0
        ? {
            First: refMap.get(outlines[0]),
            Last: refMap.get(outlines[outlines.length - 1]),
          }
        : {}),
      Count: rootCount,
    })
  );

  doc.catalog.set(doc.context.obj("Outlines"), rootRef);
}

/** URL 路径 → 章节名 */
const CHAPTER_LABELS = {
  intro: "入门与规划",
  changelog: "更新日志",
  "computer-science": "计算机基础",
  "data-structure": "第一章 经典数据结构",
  "dynamic-programming": "第三章 动态规划",
  "graph": "图论",
  "binary-search": "二分查找",
  "sliding-window": "滑动窗口",
  "linked-list": "链表",
  "array": "数组",
  "backtrack": "第二章 回溯搜索",
  "greedy": "贪心",
  "divide-and-conquer": "分治",
  "sort": "排序",
  "other": "第四章 其他技巧",
  home: "本站",
};

export function chapterKeyFromUrl(url) {
  const seg = new URL(url).pathname.replace(/^\/zh\/algo\//, "").split("/").filter(Boolean)[0];
  return seg || "home";
}

export function displayTitle(title, url) {
  if (title && !title.startsWith("http")) return title;
  const slug = new URL(url).pathname.replace(/^\/zh\/algo\//, "").replace(/\/$/, "");
  return slug.split("/").pop().replace(/-/g, " ") || "未命名";
}

/**
 * 按 toc 顺序生成嵌套书签：章节 → 文章（每篇 PDF 的第 1 页）
 * @param {{ title: string, url: string, pageIndex: number, pageCount: number }[]} entries
 */
export function buildOutlineTree(entries) {
  const tree = [];
  let group = null;

  const flush = () => {
    if (!group) return;
    tree.push(group);
    group = null;
  };

  for (const e of entries) {
    const key = chapterKeyFromUrl(e.url);
    const chapterTitle = CHAPTER_LABELS[key] || key;

    if (!group || group._key !== key) {
      flush();
      group = {
        _key: key,
        title: chapterTitle,
        open: true,
        children: [],
      };
    }

    group.children.push({
      title: displayTitle(e.title, e.url),
      to: e.pageIndex,
    });
  }
  flush();

  // 若只有单章且条目很多，也可扁平；嵌套更易浏览
  if (tree.length === 1 && tree[0].children.length > 0) {
    return tree;
  }
  if (tree.length === 0 && entries.length > 0) {
    return entries.map((e) => ({
      title: displayTitle(e.title, e.url),
      to: e.pageIndex,
    }));
  }
  return tree;
}
