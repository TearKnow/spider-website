import readline from "readline";
import { launchBrowser } from "./browser.mjs";
import { absUrl, resolvePaths } from "./site-config.mjs";

const POLL_MS = 1000;
const TIMEOUT_MS = 10 * 60 * 1000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function askEnter(question) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) return resolve(false);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, () => {
      rl.close();
      resolve(true);
    });
  });
}

async function hasAuthCookie(context, site) {
  const cookieName = site.auth?.cookieName || "site-token";
  const cookies = await context.cookies(site.baseUrl);
  return cookies.some((c) => c.name === cookieName && c.value);
}

async function waitForLogin(context, site) {
  console.log("请在浏览器中完成登录…");
  console.log("检测到登录后会自动保存，无需按 Enter。");
  if (process.stdin.isTTY) {
    console.log("（也可登录后直接在本窗口按 Enter 立即保存）");
  }

  const deadline = Date.now() + TIMEOUT_MS;
  const enterPromise = askEnter("\n>>> 按 Enter 立即保存会话… ").then((v) => (v ? "manual" : null));

  while (Date.now() < deadline) {
    if (await hasAuthCookie(context, site)) {
      console.log(`✓ 检测到 ${site.auth?.cookieName || "cookie"}`);
      return "auto";
    }

    const raced = await Promise.race([enterPromise, sleep(POLL_MS).then(() => null)]);
    if (raced === "manual") return "manual";
  }

  throw new Error(`等待登录超时（${TIMEOUT_MS / 60000} 分钟）`);
}

async function verifyLogin(context, site, verifyUrl) {
  const page = await context.newPage();
  const patterns = site.auth?.paywallPatterns || [];
  const minLen = site.auth?.verifyMinMainLength ?? 3000;
  const mainSel = site.selectors?.main || "main";

  try {
    await page.goto(verifyUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(2000);
    const info = await page.evaluate(
      ({ mainSel, patterns }) => {
        const header = document.querySelector("header")?.innerText || "";
        const main = document.querySelector(mainSel)?.innerText || "";
        return {
          loginBtn: header.includes("登录"),
          len: main.length,
          paywall: patterns.some((p) => main.includes(p) || document.body.innerText.includes(p)),
        };
      },
      { mainSel, patterns }
    );
    if (info.loginBtn || info.paywall || info.len < minLen) {
      console.warn("⚠ 会员页校验未通过，正文可能不完整");
      console.warn(`  顶栏仍显示登录: ${info.loginBtn}, 正文长度: ${info.len}`);
    } else {
      console.log(`✓ 会员页校验通过（正文约 ${info.len} 字）`);
    }
  } finally {
    await page.close();
  }
}

export async function runLogin({ siteId, sectionId }) {
  const paths = resolvePaths(siteId, sectionId);
  const { site, authFile, loginUrl, verifyUrl } = paths;
  const viewport = site.layout?.viewport || { width: 1920, height: 1080 };

  console.log(`站点: ${site.name} (${site.id})`);
  console.log(`登录成功后保存到: ${authFile}`);

  const browser = await launchBrowser({ headless: false });
  const context = await browser.newContext({
    locale: site.locale || "zh-CN",
    viewport,
  });
  const page = await context.newPage();
  await page.goto(loginUrl, { waitUntil: "domcontentloaded" });

  const mode = await waitForLogin(context, site);
  await context.storageState({ path: authFile });
  console.log(`已保存: ${authFile}（${mode === "manual" ? "手动" : "自动"}）`);

  if (!(await hasAuthCookie(context, site))) {
    console.error("未检测到登录 Cookie，请重新运行 login");
    await browser.close();
    process.exit(1);
  }

  await verifyLogin(context, site, verifyUrl);
  console.log("后续爬取:");
  console.log(`  node scrape.mjs --site ${siteId} --section ${sectionId}`);

  await browser.close();
}
