#!/usr/bin/env node
/**
 * 抓取站点目录 → toc.json
 *
 * 用法:
 *   node toc.mjs --site labuladong --section algo
 *   node toc.mjs --site labuladong --section ai-coding
 */

import { parseCommonArgs } from "./lib/cli-args.mjs";
import { runToc } from "./lib/toc-runner.mjs";
import { resolvePaths } from "./lib/site-config.mjs";

const opts = parseCommonArgs(process.argv.slice(2));
const { authFile } = resolvePaths(opts.site, opts.section);
const storageState = process.env.STORAGE_STATE || authFile;

runToc({ siteId: opts.site, sectionId: opts.section, storageState }).catch((e) => {
  console.error(e);
  process.exit(1);
});
