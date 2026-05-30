import fs from "fs";
import path from "path";
import { chromium } from "playwright";

/** Playwright 自带 Chromium 是否已安装 */
function hasBundledChromium() {
  try {
    const base = process.env.PLAYWRIGHT_BROWSERS_PATH
      || path.join(process.env.LOCALAPPDATA || "", "ms-playwright");
    if (!base || !fs.existsSync(base)) return false;
    const dirs = fs.readdirSync(base).filter((d) => d.startsWith("chromium-"));
    return dirs.some((d) => {
      const exe = path.join(base, d, "chrome-win64", "chrome.exe");
      return fs.existsSync(exe);
    });
  } catch {
    return false;
  }
}

/**
 * 启动选项：优先用本机 Chrome（无需 npx playwright install）
 * PowerShell 请勿用 set，可用: $env:USE_SYSTEM_CHROME="1"
 */
export function getLaunchOptions({ headless = true } = {}) {
  const forceSystem =
    process.env.USE_SYSTEM_CHROME === "1" ||
    process.env.USE_SYSTEM_CHROME === "true";
  const autoSystem = !hasBundledChromium();

  const opts = { headless };
  if (forceSystem || autoSystem) {
    opts.channel = "chrome";
  }
  return opts;
}

export async function launchBrowser(options = {}) {
  const opts = getLaunchOptions(options);
  if (opts.channel === "chrome") {
    console.log("使用本机 Google Chrome 启动浏览器");
  }
  return chromium.launch(opts);
}
