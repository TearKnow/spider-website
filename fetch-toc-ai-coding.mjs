/** @deprecated 请使用 node toc.mjs --site labuladong --section ai-coding */
import { parseCommonArgs } from "./lib/cli-args.mjs";
import { runToc } from "./lib/toc-runner.mjs";
import { resolvePaths } from "./lib/site-config.mjs";

const opts = parseCommonArgs(process.argv.slice(2), {
  site: "labuladong",
  section: "ai-coding",
});
const { authFile } = resolvePaths(opts.site, opts.section);

runToc({
  siteId: opts.site,
  sectionId: opts.section,
  storageState: process.env.STORAGE_STATE || authFile,
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
