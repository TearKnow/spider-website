# doc-scraper

将文档站按**侧栏顺序**抓取为 **PNG + 单篇 PDF**，再合并为**带嵌套书签**的电子书。

当前内置站点：

| 站点 id | 章节 | 说明 |
|---------|------|------|
| `labuladong` | `algo` / `ai-coding` | labuladong.online 教程 |
| `vue3-nuxt` | `blog` | [vue3-nuxt 博客](https://vue3-nuxt.vercel.app/blog) |

## 架构

```
sites/           站点适配（选择器、登录、布局 CSS）
lib/             通用引擎（截图、目录、合并）
login.mjs        登录
toc.mjs          抓目录
scrape.mjs       抓正文
book.mjs         合并成书
```

新站点：复制 `sites/_template.mjs` → 在 `lib/site-config.mjs` 注册 → 调试选择器与 CSS。

---

## 快速开始（labuladong）

```powershell
cd d:\www\labuladong
npm install

# 1. 登录（自动检测 Cookie 并保存 auth.json）
node login.mjs

# 2. 抓目录
node toc.mjs --site labuladong --section algo
# 或 AI 编程：
node toc.mjs --site labuladong --section ai-coding

# 3. 试跑 3 篇
node scrape.mjs --site labuladong --section algo --test

# 4. 全量抓取（断点续传，跳过已有 PDF）
node scrape.mjs --site labuladong --section algo

# 5. 合并电子书
node book.mjs --site labuladong --section algo
```

**npm 快捷命令：**

| 命令 | 等价于 |
|------|--------|
| `npm run login` | `node login.mjs` |
| `npm run toc` | labuladong algo 目录 |
| `npm run scrape` | labuladong algo 全量抓取 |
| `npm run book` | labuladong algo 合并 |
| `npm run toc:ai` / `scrape:ai` / `book:ai` | labuladong AI 编程 |
| `npm run toc:vue3` / `scrape:vue3` / `book:vue3` | vue3-nuxt 博客 |

**常用参数：**

```powershell
node scrape.mjs --site labuladong --section ai-coding --limit 2 --no-resume
node scrape.mjs --site labuladong --section algo --from 10 --limit 5
node book.mjs --site labuladong --section ai-coding --out output/my-book.pdf
```

旧脚本（`fetch-toc.mjs`、`scrape-to-pdf.mjs` 等）仍可用，内部转发到新 CLI。

---

## 输出结构

```
output/
  pages/              单篇 PDF
  screenshots/        单篇 PNG
  labuladong-book.pdf 合并书（algo）
output/ai-coding/
  pages/
  screenshots/
output/ai-coding-book.pdf
toc.json              algo 目录
toc-ai-coding.json    AI 编程目录
auth.json             登录态
```

文件名规则：`0001__L1-章节__L2-文章__L3-....png`，书签按 `L1/L2/...` 嵌套。

---

## 添加新站点

1. 复制 `sites/_template.mjs` 为 `sites/your-site.mjs`
2. 在 `lib/site-config.mjs` 的 `REGISTRY` 中注册
3. 填写 `baseUrl`、`selectors`、`auth`、`sections`
4. 按需改写 `buildLayoutCss()`（截图布局）
5. 试跑：`node scrape.mjs --site your-site --section docs --limit 2`

---

## 告诉我这些信息，即可快速抓取

以后你要抓**新网站**，按下面清单提供信息（越完整越快；标 **★** 为最少必填）。

### 一、站点基本信息（必填 ★）

| 信息 | 示例 |
|------|------|
| **网站域名** ★ | `https://example.com` |
| **要抓的范围** ★ | 某一章节 / 整个文档站 / 指定 URL 列表 |
| **是否需要登录** ★ | 否 / 是（会员全文） |
| **输出形式** ★ | 每页 PNG+PDF + 合并带书签 PDF |

### 二、目录来源（必填 ★，选一种）

**A. 左侧/右侧导航（推荐）**

- 任意一篇文档的完整 URL ★
- 目录链接规律（如 `/docs/` 开头）
- 侧栏层级大概几层

**B. sitemap**

- sitemap 地址
- 要包含的 URL 前缀

**C. 手动 URL 列表**

- 直接给 URL 列表或 JSON
- 每篇标题（没有也可从页面取）

**D. 顺序**

- 侧栏顺序 / sitemap / 你给的列表顺序

### 三、页面结构

发 **1～2 个典型 URL**，并说明：

| 信息 | 说明 |
|------|------|
| 正文区域 | 如 `main`、`article` |
| 左侧目录 / 右侧大纲 | 有没有 |
| **截图范围** ★ | 只要正文 / 左+正文+右 / 整页 |
| 视口宽度 | 默认 1920 |
| 特殊内容 | 折叠块、iframe、懒加载、视频 |

不确定时只给 URL 也行，我可以先分析页面。

### 四、登录（需要时）

| 信息 | 说明 |
|------|------|
| 登录入口 URL | |
| 登录方式 | 微信 / 邮箱 / GitHub 等 |
| 登录成功标志 | 头像、Cookie 名等 |
| 未登录表现 | 截断 / 弹窗 / 跳转 |
| 能否本机手动登一次 | 能则用 `login.mjs` 存会话 |

### 五、命名与成书

| 信息 | 默认 |
|------|------|
| 文件名 | `0001__L1-章节__L2-文章` |
| 书签 | 跟侧栏 L1/L2/L3 |
| 书名 | `output/xxx-book.pdf` |

### 六、抓取策略（可选）

- 先试跑 N 篇
- 断点续传 / 重抓
- 间隔与重试

### 最简模板（复制填写）

```text
【站点】
域名：
范围：
示例 URL（1～2 个）：

【登录】要/不要；方式：

【目录】侧栏 / sitemap / URL 列表：

【截图】要哪些区域；宽度：

【输出】书名、先试跑几篇：

【其它】
```

**示例（最少信息）：**

```text
网站：https://xxx.com
范围：/docs/ 下全部教程
登录：要，会员内容
目录：左侧导航，按侧栏顺序
截图：左栏 + 正文 + 右侧大纲，宽 1920
先试跑 2 篇
示例页：https://xxx.com/docs/intro
```

---

## 技术说明

- 视口默认 **1920px** 宽
- 超长页用 CDP 裁切 + 无重叠纵向拼接（避免 Chromium 重复块 bug）
- 抓取前自动展开 `<details>`、等待 iframe/懒加载
- 会员墙检测：未登录会中止并提示重新 `login.mjs`

## 依赖

- Node.js 18+
- 本机 Google Chrome（或 `npx playwright install chromium`）
