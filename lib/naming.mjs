/**
 * 文件名层级规则：使用左侧目录中文名（非 URL 英文段）
 *
 * 格式: {序号4位}__L1-{章节}__L2-{文章}...
 * 示例: 0002__L1-针对初学和速成的学习规划__L2-AI时代算法速成规划.png
 */

export function sanitizeName(name) {
  return (
    String(name || "未命名")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
      .replace(/\s+/g, "")
      .replace(/[\u200b\uFEFF]/g, "")
      .slice(0, 80) || "未命名"
  );
}

/** @param {string[]} pathTitles 侧栏层级中文标题（含当前文章名） */
export function buildFileSlugFromTitles(pathTitles, order) {
  const titles = pathTitles?.filter(Boolean)?.length ? pathTitles : ["未命名"];
  const idx = String(order).padStart(4, "0");
  const hier = titles.map((t, i) => `L${i + 1}-${sanitizeName(t)}`).join("__");
  return `${idx}__${hier}`;
}

/** @param {{ title: string, pathTitles?: string[], url?: string }} item */
export function buildFileSlug(item, order) {
  const pathTitles =
    item.pathTitles?.filter(Boolean)?.length > 0
      ? item.pathTitles
      : [item.title || "未命名"];
  return buildFileSlugFromTitles(pathTitles, order);
}

export function parseFileSlug(filename) {
  const base = filename.replace(/\.(pdf|png)$/i, "");
  const parts = base.split("__");
  const order = parseInt(parts[0], 10);
  const levels = [];
  for (let i = 1; i < parts.length; i++) {
    const m = parts[i].match(/^L(\d+)-(.+)$/);
    if (m) levels.push({ depth: Number(m[1]), name: m[2] });
  }
  return { order, levels };
}

/**
 * 按文件名中的中文层级生成嵌套 PDF 书签
 * @param {{ title: string, pageIndex: number, levels: { depth: number, name: string }[] }[]} entries
 */
export function buildOutlineFromLevels(entries) {
  const tree = [];
  const nodeAt = new Map();

  for (const e of entries) {
    const { levels } = e;
    if (!levels?.length) {
      tree.push({ title: e.title, to: e.pageIndex });
      continue;
    }

    let parentChildren = tree;
    let pathKey = "";

    for (let i = 0; i < levels.length - 1; i++) {
      const lvl = levels[i];
      pathKey += `${pathKey ? "/" : ""}L${lvl.depth}-${lvl.name}`;
      if (!nodeAt.has(pathKey)) {
        const node = { title: lvl.name, open: true, children: [] };
        nodeAt.set(pathKey, node);
        parentChildren.push(node);
      }
      parentChildren = nodeAt.get(pathKey).children;
    }

    parentChildren.push({ title: e.title, to: e.pageIndex });
  }

  return tree;
}

export function enrichTocItem(item, order, usedSlugs = null) {
  const pathTitles =
    item.pathTitles?.filter(Boolean)?.length > 0
      ? item.pathTitles
      : [item.title || "未命名"];
  let fileSlug = buildFileSlugFromTitles(pathTitles, order);
  if (usedSlugs) {
    let n = 2;
    const base = fileSlug;
    while (usedSlugs.has(fileSlug)) {
      fileSlug = `${base}~${n}`;
      n++;
    }
    usedSlugs.add(fileSlug);
  }
  return {
    ...item,
    pathTitles,
    depth: pathTitles.length,
    order,
    fileSlug,
  };
}
