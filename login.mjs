#!/usr/bin/env node
/**
 * 手动登录并保存会话
 *
 * 用法:
 *   node login.mjs
 *   node login.mjs --site labuladong --section ai-coding
 */

import { parseCommonArgs } from "./lib/cli-args.mjs";
import { runLogin } from "./lib/login-runner.mjs";

const opts = parseCommonArgs(process.argv.slice(2), { section: "algo" });

runLogin({ siteId: opts.site, sectionId: opts.section }).catch((e) => {
  console.error(e);
  process.exit(1);
});
