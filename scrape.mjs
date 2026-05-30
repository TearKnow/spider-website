#!/usr/bin/env node
/**
 * 按目录抓取 → PNG + 单篇 PDF
 *
 * 用法:
 *   node scrape.mjs --site labuladong --section algo
 *   node scrape.mjs --site labuladong --section ai-coding --limit 2
 *   node scrape.mjs --site labuladong --section algo --test
 */

import { parseCommonArgs } from "./lib/cli-args.mjs";
import { runScrape } from "./lib/scrape-runner.mjs";

const opts = parseCommonArgs(process.argv.slice(2));

runScrape(opts).catch((e) => {
  console.error(e);
  process.exit(1);
});
