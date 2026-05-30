import { DEFAULT_SECTION_ID, DEFAULT_SITE_ID } from "./site-config.mjs";

export function parseCommonArgs(argv, defaults = {}) {
  const opts = {
    site: defaults.site || DEFAULT_SITE_ID,
    section: defaults.section || DEFAULT_SECTION_ID,
    limit: 0,
    from: 0,
    resume: true,
    test: false,
    url: null,
    requireAuth: defaults.requireAuth ?? true,
    allowPaywall: false,
    ...defaults,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--site" && argv[i + 1]) opts.site = argv[++i];
    else if (a === "--section" && argv[i + 1]) opts.section = argv[++i];
    else if (a === "--limit" && argv[i + 1]) opts.limit = Number(argv[++i]);
    else if (a === "--from" && argv[i + 1]) opts.from = Number(argv[++i]);
    else if (a === "--url" && argv[i + 1]) opts.url = argv[++i];
    else if (a === "--no-resume") opts.resume = false;
    else if (a === "--no-auth-check") opts.requireAuth = false;
    else if (a === "--allow-paywall") opts.allowPaywall = true;
    else if (a === "--test") opts.test = true;
    else if (a === "--out" && argv[i + 1]) opts.out = argv[++i];
    else if (a === "--toc" && argv[i + 1]) opts.toc = argv[++i];
    else if (a === "--pages-dir" && argv[i + 1]) opts.pagesDir = argv[++i];
  }

  if (opts.test && opts.limit === 0) opts.limit = 3;
  if (opts.test) opts.resume = false;
  return opts;
}
