#!/usr/bin/env node
/**
 * 合并单篇 PDF 为带嵌套书签的电子书
 *
 * 用法:
 *   node book.mjs --site labuladong --section algo
 *   node book.mjs --site labuladong --section ai-coding
 */

import path from "path";
import { parseCommonArgs } from "./lib/cli-args.mjs";
import { runMerge } from "./lib/merge-runner.mjs";
import { resolvePaths } from "./lib/site-config.mjs";

const opts = parseCommonArgs(process.argv.slice(2));

if (opts.test) {
  opts.pagesDir = path.resolve("test/pages");
  opts.out = path.resolve("test/labuladong-book.pdf");
} else {
  const paths = resolvePaths(opts.site, opts.section);
  opts.pagesDir = opts.pagesDir ? path.resolve(opts.pagesDir) : paths.pagesDir;
  opts.out = opts.out ? path.resolve(opts.out) : paths.bookFile;
  opts.tocFile = opts.toc ? path.resolve(opts.toc) : paths.tocFile;
}

runMerge(opts).catch((e) => {
  console.error(e);
  process.exit(1);
});
