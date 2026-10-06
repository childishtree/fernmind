# Fernmind 博客

把 Typst 文章预渲染成静态博客。文章写一遍，同时得到可选中复制的网页正文、保留纸面版式的原版页面和可下载的 PDF。

博客的正文样式直接来自仓库根的 `web/fernmind.css` 与 `lightmind.typ`——**没有主题副本**，所以主题一改，博客跟着变。外壳用 [animal-island-ui](https://github.com/guokaigdg/animal-island-ui)（MIT），配色和字体通过 CSS 变量映射回 Fernmind。

正文与界面文字统一用霞鹜文楷，但**不随站点分发 12.7 MB 的全量字体**：构建时按站点实际用字裁成一百多 KB 的子集，详见[字体子集](#字体子集)。

> 这个目录需要留在 fernmind 仓库内：构建时 Typst 的 `--root` 指向仓库根，文章用 `#import "/lightmind.typ"` 复用本体主题。要放到别处，用 `FERNWIND_ROOT` 指向仓库根即可。

## 快速开始

需要 **Node.js 22.12+、Typst 0.15+、Python 3.9+、Poppler 的 `pdftotext`**，以及系统中安装的霞鹜文楷（LXGW WenKai）、Cascadia Code 与 Noto Sans SC。字体也可以用下面的环境变量指定。

```sh
cd blog
npm install
npm run dev          # 先编译文章，再启动开发服务器（http://127.0.0.1:5180）
```

构建静态站点：

```sh
npm run build        # 编译文章 + 类型检查 + 打包 + 逐路由预渲染
npm run check        # 校验产物：锚点、页数、图片、源文件一致性、社交卡片、字体子集
```

产物在 `blog/dist/`，整个目录可以直接部署到任意静态托管。每篇文章都有独立的预渲染页面，关闭 JavaScript 也能读到全文；主题切换、搜索和阅读模式切换需要 JavaScript。

## 命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 编译文章并启动开发服务器 |
| `npm run build` | 完整构建到 `dist/` |
| `npm run preview` | 本地预览已构建的站点 |
| `npm run articles:build` | 只编译文章（Typst → HTML / PDF / SVG / 文本） |
| `npm run article:pdf -- content/posts/welcome.typ` | 只编译一篇文章的 PDF 到 `output/pdf/` |
| `npm run check` | 校验 `dist/` 的完整性 |

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `TYPST_BIN` | Typst 可执行文件路径（不在 `PATH` 时） |
| `PDFTOTEXT_BIN` | `pdftotext` 路径 |
| `PYTHON_BIN` | Python 解释器（Windows 默认 `python`，其他系统默认 `python3`） |
| `BLOG_FONT_PATHS` | 额外字体目录，多个路径用系统路径分隔符连接 |
| `FERNWIND_ROOT` | fernmind 仓库根目录，默认取 `blog/` 的上一级 |
| `SITE_URL` | 覆盖 `src/site.ts` 里的站点地址，用于生成 `canonical` / `og:url` / `og:image` |

字体查找顺序：系统字体 → `content/fonts/` → `BLOG_FONT_PATHS`。检测到缺失字体会直接报错中止，不会静默替换。

## 添加文章

在 `content/posts/` 下创建两个同名文件：

```text
my-note.typ
my-note.json
```

`my-note.json`：

```json
{
  "title": "我的第一篇手记",
  "slug": "my-note",
  "date": "2026-10-06",
  "category": "Typst 排版",
  "tags": ["Typst", "笔记"],
  "excerpt": "用一两句话说明这篇文章解决了什么问题。",
  "featured": false
}
```

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `title` | ✅ | 文章标题 |
| `slug` | ✅ | 唯一的小写字母、数字与连字符，决定网址 `/posts/<slug>/` |
| `date` | ✅ | `YYYY-MM-DD`，文章按日期倒序排列 |
| `category` | ✅ | 分类名，需与 `src/site.ts` 的 `topics` 对应 |
| `excerpt` | ✅ | 摘要，同时用作 `<meta name="description">` |
| `tags` | | 字符串数组 |
| `featured` | | 为 `true` 时在首页标记为「开篇手记」 |
| `darkMode` | | `true` / `false` / `"auto"`（默认，跟随系统） |
| `mathRenderer` | | `"native"`（默认，原生 MathML）或 `"mathjax"`（本地打包） |
| `web` | | 设为 `false` 时跳过 HTML 导出，只展示原版页面与 PDF |

`my-note.typ`：

```typst
#import "../theme.typ": article, mark, kbd, task
#let post = json("my-note.json")
#show: article.with(meta: post)

= 研究的问题

正文、*粗体*、_斜体_、`行内代码`和 #mark[高亮]。

$ E = m c^2 $

#quote(attribution: "tip")[把长文拆成几节，每节只回答一个问题。]
#task(checked: true)[核对单位]
```

标题、摘要、初始主题、公式渲染方式都从 JSON 读取，正文里不必重复声明。改完运行 `npm run articles:build`，站点就会多出一篇文章。

`mathRenderer: "mathjax"` 的文章，构建时会往该页 `<head>` 注入一小段内联脚本，在首次绘制前把 `data-math-state="loading"` 写到 `<html>` 上，先把原生 MathML 藏起来，等 MathJax 排好版再揭示——避免「原生公式一闪、随即被 SVG 替换」。禁用 JavaScript 时脚本不执行、属性不存在，原生 MathML 正常显示。

## 阅读方式

- **网页阅读**：默认视图，展示 Typst 原生 HTML 导出的正文。文字可选中复制，公式是 MathML，目录与脚注是原生锚点；标题自动生成可复制的永久链接，代码块带复制按钮。
- **原版页面**：同一份 `.typ` 导出为逐页 SVG，保留固定纸面布局，支持 75%–250% 缩放。
- **独立阅读**：打开使用 Fernmind 原页面框架的 `document.html`，自带明暗切换。
- **PDF / 源文件**：在文章页底部下载。
- **搜索**：索引由同一篇文档生成的正文文字、标题、摘要和标签组成。

## 图片

两种写法都可以：

```typst
// 以文件引用。构建时复制到 public/articles/<slug>/images/ 并改写路径。
#image("/cover.png", alt: "封面图")

// 内嵌 base64。构建时还原为独立文件，避免正文体积失控。
```

以 `/` 开头的是 Typst 的 root 绝对路径（root 即仓库根），否则相对 `.typ` 文件解析。构建后 `/articles/<slug>/images/` 下会出现这些文件。

## 字体子集

霞鹜文楷的全量字体有 12.7 MB。直接随站点分发，单个文章页要下载 12.75 MB 的字体；只依赖主题自带的 `-Text` 子集也不行——它只覆盖 507 个码位，正文里出现一个子集之外的字，浏览器仍会把全量字体整个拉下来。

构建时改为**按站点实际用字生成子集**（`scripts/subset-font.mjs`，用 npm 的 `subset-font`）：

1. 收集站点会渲染出来的全部文字——文章源与元数据、`src/` 下的界面文案、以及导出的 HTML 正文；
2. 用 HarfBuzz 裁出只含这些字的子集，写成 `public/fernmind/assets/fonts/wenkai-subset.woff2`（通常一百多 KB）；
3. 把主题与独立阅读页里的霞鹜文楷 `@font-face` 合并成一条指向子集的声明，并附上 `unicode-range`。

`unicode-range` 按**子集里真有字形的码位**声明，而不是按请求的码位。两者之差是字体本身没有的字（emoji、数学斜体字母、控制字符）——把它们也声明进来的话，浏览器会选中这个字体、再画出 `.notdef`（豆腐块），反而不会回退到后备字体。

构建期有三条断言守着漏字（漏字不会报错，只会让页面悄悄换成后备字体）：

- `unicode-range` 与字形覆盖必须完全一致（区间合并算错、或多声明了没有的字形都会中止构建）；
- 页面真正渲染出来的字必须在请求集内（收集源漏了来源就会中止）；
- 排除该由专门字体渲染的字之后仍缺字形的，打印提示。

`npm run check` 还会做一次端到端复核：`dist/` 里每个页面的可见文字都必须落在子集的 `unicode-range` 内。

许可：霞鹜文楷采用 SIL OFL 1.1，其版权行含一条 ADDITIONAL PERMISSION，明确允许为网页字体分发而做子集化或转格式（如 WOFF2）并继续使用保留字体名，前提是不作为可安装的桌面字体分发。本子集只随站点作为网页字体提供，符合该许可。原文见 `../web/fonts/OFL-WenKai.txt`。

界面文字同样落到这款子集字体上。animal-island-ui 的默认字体栈里带 `"Noto Sans SC"`（三个字重合计 3.4 MB），所以 `src/fernmind-blog.css` 会把 `--animal-font-family` 覆盖成 Fernmind 的正文字体。这里有个坑：**库在 `:root` 上也声明了同一个变量，而且带 `!important`**，覆盖时不跟着写 `!important` 就永远赢不了；另有少数组件把字体栈硬编码在自身规则里（`.animal-checkboxGroup` 那条还带 `!important`），改变量压不住，只能按 `animal-` 类名前缀统一压回。

## 站点配置

`src/site.ts` 是站点文案与分类的唯一来源：站名、简介、首页标题、关于页段落、分类列表都在这里。`scripts/routes.mjs` 会从同一份配置生成各路由的 `<title>`、`<meta name="description">`、`canonical` 与 `og:*` / `twitter:*` 社交卡片，不必两处维护。

`site.url` 是部署后的站点根地址（末尾不带斜杠）。`canonical`、`og:url` 与 `og:image` 都要求绝对地址，所以这里要填真实域名；也可以用 `SITE_URL` 环境变量覆盖，例如 CI 里按分支生成预览地址。留空则只输出不依赖绝对地址的那部分社交标签。

独立阅读页（`/articles/<slug>/document.html`）是同一篇文章的另一种排法，构建时会补上 `canonical` 指向网页正文 `/posts/<slug>/`，避免被搜索引擎当成重复内容。

新增分类时在 `topics` 里加一项，并让文章的 `category` 与之对应。

## 目录结构

| 路径 | 作用 |
| --- | --- |
| `content/theme.typ` | 博客的 Typst 入口，`#import "/lightmind.typ"` 复用仓库根主题 |
| `content/posts/` | 文章源（`.typ` + 同名 `.json`） |
| `scripts/compile-typst.mjs` | 编译文章，生成 HTML / PDF / SVG / 文本、文章样式与字体子集 |
| `scripts/subset-font.mjs` | 按实际用字裁剪霞鹜文楷，并核对字形覆盖 |
| `scripts/extract-typst-html.py` | 从原生导出中抽出正文与标题锚点 |
| `scripts/routes.mjs` | 逐路由服务端预渲染，写出完整静态页面 |
| `scripts/check-site.mjs`、`check-site.py` | 产物校验 |
| `scripts/compile-one.mjs` | 单篇出 PDF |
| `src/site.ts` | 站点文案与分类配置 |
| `src/App.tsx` | 首页、归档、关于页与主题切换 |
| `src/TypstArticle.tsx` | 网页 / 原版阅读切换、目录与下载 |
| `src/reading.ts` | 正文增强：标题锚点与代码复制 |
| `src/mathjax.ts` | 按需加载本地打包的 MathJax |
| `src/fernmind-blog.css` | 把 Fernmind 变量接到 animal-island-ui，并把界面字体压回正文字体 |
| `public/` | 静态资源（图标、许可说明、文章产物） |

`src/posts.json`、`public/articles/`、`public/fernmind/`、`dist/`、`.sites-runtime/` 都是生成结果，不要直接编辑。文章先编译到 `.sites-runtime/typst-articles` 暂存，**全部成功后才替换上一版产物**，因此单篇编译失败不会留下半套站点。

## 已知限制

使用 `mathRenderer: "mathjax"` 时，浏览器控制台会出现一条 `sre/speech-worker.js` 加载失败的错误。原因是随站点提供的 `mml-svg.js` 是 MathJax 4.1.3 的官方完整打包版，内含无障碍朗读（SRE）栈，会去同目录找 `sre/speech-worker.js`，而仓库只随包提供了 `mml-svg.js` 本身。**这只影响公式的语音朗读，不影响公式渲染**（页面已正常排版为 SVG），且独立阅读页同样如此。若要消除，需要额外随站点提供 MathJax 的 `sre/` 目录，或改用不含无障碍栈的自定义打包版本。

## 许可

Fernmind / Lightmind：Copyright (c) 2026 Childish_tree，MIT，见仓库根的 `LICENSE`。

Animal Island UI：MIT，Copyright (c) 2026 guokaigdg，见 `public/licenses/animal-island-ui.txt`。

霞鹜文楷与 Cascadia Code 遵循各自的 SIL OFL，许可随字体提供（`../web/fonts/`）。
