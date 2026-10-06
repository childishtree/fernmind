// 把客户端构建产物（SPA shell）与逐路由的服务端渲染结果合并，
// 为每条路由写出一个完整的静态页面。关闭 JavaScript 也能读到全文。
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import react from '@vitejs/plugin-react';

// 复用同一套 React 组件做构建时渲染，不启动 HTTP 服务。
await build({
  configFile: false,
  plugins: [react()],
  ssr: { noExternal: ['animal-island-ui', 'naive-icons'] },
  build: {
    ssr: 'src/render.tsx',
    outDir: '.sites-runtime/prerender',
    emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: 'render.mjs' } },
  },
});

const bundle = await import(
  pathToFileURL(path.resolve('.sites-runtime/prerender/render.mjs')).href
);
const { renderPage, buildRoutes, site } = bundle;

const shell = fs.readFileSync('dist/index.html', 'utf8');
const escape = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

// 站点根地址。canonical / og:url / og:image 都要求绝对地址，所以要么在 site.ts 里
// 填好域名，要么用 SITE_URL 覆盖。留空时只输出不依赖绝对地址的标签，不留半截地址。
const SITE_URL = (process.env.SITE_URL || site.url || '').replace(/\/+$/, '');
const SOCIAL_IMAGE = SITE_URL ? `${SITE_URL}/fernmind/cover.png` : '';

/**
 * 社交卡片与规范链接。分享到社交平台时靠这些标签决定卡片长相，
 * 搜索引擎也靠 canonical 合并带查询串的重复地址。
 */
function socialTags(route, title, description, date) {
  const full = `${title} · ${site.name}`;
  const url = SITE_URL ? `${SITE_URL}${route ? `/${route}/` : '/'}` : '';
  const tags = [
    `<meta property="og:type" content="${route.startsWith('posts/') ? 'article' : 'website'}"/>`,
    `<meta property="og:site_name" content="${escape(site.name)}"/>`,
    `<meta property="og:locale" content="zh_CN"/>`,
    `<meta property="og:title" content="${escape(full)}"/>`,
    `<meta property="og:description" content="${escape(description)}"/>`,
    `<meta name="twitter:card" content="${SOCIAL_IMAGE ? 'summary_large_image' : 'summary'}"/>`,
    `<meta name="twitter:title" content="${escape(full)}"/>`,
    `<meta name="twitter:description" content="${escape(description)}"/>`,
  ];
  if (url) {
    tags.unshift(`<link rel="canonical" href="${escape(url)}"/>`);
    tags.splice(1, 0, `<meta property="og:url" content="${escape(url)}"/>`);
    tags.push(`<meta property="og:image" content="${escape(SOCIAL_IMAGE)}"/>`);
    tags.push(`<meta property="og:image:alt" content="${escape(full)}"/>`);
    tags.push(`<meta name="twitter:image" content="${escape(SOCIAL_IMAGE)}"/>`);
  }
  if (date) tags.push(`<meta property="article:published_time" content="${escape(date)}"/>`);
  return tags.join('\n    ');
}

// 与 web/theme.typ 同款防闪：MathJax 文章的原生 MathML 必须在首次绘制前就隐藏，
// 否则会先看到原生公式、随后被替换成 SVG，出现一次闪动。
// 内联脚本同步执行，在解析 <head> 时就把 data-math / data-math-state 写好。
// 页面脚本排完版后会提前置为 "ready"；这里的 3 秒兜底保证即使页面脚本没有执行
// （例如水合失败），公式也不会被永久藏住。禁用 JavaScript 时脚本不执行、
// 属性不存在，原生 MathML 正常显示。
const MATH_ANTI_FLASH =
  '<script>(function(){var d=document.documentElement;' +
  'd.dataset.math="mathjax";d.dataset.mathState="loading";' +
  'setTimeout(function(){if(d.dataset.mathState==="loading")d.dataset.mathState="ready"},3000)})();</script>';

function pageHtml({ path: route, title, description, date, math }) {
  let html = shell
    .replace(/<title>.*?<\/title>/, `<title>${escape(title)} · ${escape(site.name)}</title>`)
    .replace(
      /<meta name="description" content="[^"]*"\s*\/?>/,
      () =>
        `<meta name="description" content="${escape(description)}"/>\n    ` +
        socialTags(route, title, description, date),
    )
    // 用函数形式替换，避免渲染结果里的 $& 等序列被当成替换模式。
    .replace('<div id="root"></div>', () => `<div id="root">${renderPage(`/${route}`)}</div>`);
  if (math === 'mathjax') {
    html = html.replace(
      '<link rel="stylesheet" href="/fernmind/article.css" />',
      `<link rel="stylesheet" href="/fernmind/article.css" />\n    ${MATH_ANTI_FLASH}`,
    );
  }
  return html;
}

const { pages, notFound } = buildRoutes();

for (const meta of pages) {
  const directory = path.join('dist', meta.path);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'index.html'), pageHtml(meta));
}

fs.writeFileSync('dist/404.html', pageHtml(notFound));

// 独立阅读页是 Typst 原生导出的同一篇文章的另一种排法，Typst 只写到 og:title /
// og:description / og:type / og:locale / twitter:card，缺 canonical 与绝对地址。
// 这里补上，并把 canonical 指向网页正文：同一篇文章有两个 URL，不声明规范地址
// 会被搜索引擎当成重复内容。
if (SITE_URL) {
  for (const meta of pages) {
    if (!meta.path.startsWith('posts/')) continue;
    const file = path.join('dist', 'articles', meta.path.slice('posts/'.length), 'document.html');
    if (!fs.existsSync(file)) continue;
    const canonical = `${SITE_URL}/${meta.path}/`;
    const alt = `${meta.title} · ${site.name}`;
    const extra = [
      `<link rel="canonical" href="${escape(canonical)}"/>`,
      `<meta property="og:url" content="${escape(canonical)}"/>`,
      `<meta property="og:site_name" content="${escape(site.name)}"/>`,
      `<meta property="og:image" content="${escape(SOCIAL_IMAGE)}"/>`,
      `<meta property="og:image:alt" content="${escape(alt)}"/>`,
      `<meta name="twitter:card" content="summary_large_image"/>`,
      `<meta name="twitter:image" content="${escape(SOCIAL_IMAGE)}"/>`,
    ].join('');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('</head>', `${extra}</head>`));
  }
}

console.log(`已预渲染 ${pages.length} 个完整页面与 1 个 404 页面。`);
