/** @deprecated 请使用 node scrape.mjs --site labuladong --section ai-coding */
import { parseCommonArgs } from "./lib/cli-args.mjs";
import { runScrape } from "./lib/scrape-runner.mjs";

const opts = parseCommonArgs(process.argv.slice(2), {
  site: "labuladong",
  section: "ai-coding",
});

runScrape(opts).catch((e) => {
  console.error(e);
  process.exit(1);
});
