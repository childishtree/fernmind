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

function pageHtml(route, title, description, math) {
  let html = shell
    .replace(/<title>.*?<\/title>/, `<title>${escape(title)} · ${escape(site.name)}</title>`)
    .replace(
      /<meta name="description" content="[^"]*"\s*\/?>/,
      `<meta name="description" content="${escape(description)}"/>`,
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

for (const { path: route, title, description, math } of pages) {
  const directory = path.join('dist', route);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'index.html'), pageHtml(route, title, description, math));
}

fs.writeFileSync(
  'dist/404.html',
  pageHtml(notFound.path, notFound.title, notFound.description, notFound.math),
);
console.log(`已预渲染 ${pages.length} 个完整页面与 1 个 404 页面。`);
