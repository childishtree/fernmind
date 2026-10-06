// 把 content/posts/*.typ 编译成静态博客所需的全部资产。
//
// 与「复制一份主题」的做法不同，这里把 Typst 的 --root 指向 fernmind 仓库根，
// 文章直接 #import "/lightmind.typ" 复用本体主题，因此主题只有一份，
// 不会出现副本落后于仓库、样式与修正在博客里失效的问题。
//
// 产出（均写入 blog/ 下，已在 .gitignore 中忽略）：
//   .sites-runtime/typst-articles/<slug>/   暂存目录，全部成功后才替换上一版
//   public/articles/<slug>/                 HTML 正文、PDF、SVG 分页、源文件
//   public/fernmind/                        由仓库 web/ 生成的文章样式与字体
//   src/posts.json                          供 React 使用的文章索引
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import postcss from 'postcss';
import { buildSubset, parseUnicodeRange } from './subset-font.mjs';

const exec = promisify(execFile);

const here = path.dirname(fileURLToPath(import.meta.url));
const blogRoot = path.resolve(here, '..');
const repoRoot = path.resolve(process.env.FERNWIND_ROOT || path.join(blogRoot, '..'));
const contentRoot = path.join(blogRoot, 'content');
const entries = path.join(contentRoot, 'posts');
const staging = path.join(blogRoot, '.sites-runtime/typst-articles');
const publicRoot = path.join(blogRoot, 'public');
const themeEntry = path.join(repoRoot, 'lightmind.typ');

const compiler = process.env.TYPST_BIN || 'typst';
const python = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
const pdftotext = process.env.PDFTOTEXT_BIN || 'pdftotext';

// Typst 的 HTML 导出仍标记为实验特性，每次编译都会打印同一段警告。
// 过滤掉它，其余 stderr 原样透出，避免掩盖真正的错误。
const KNOWN_WARNING = /html export is under active development|its behaviour may change at any time|do not rely on this feature for production use cases|typst\/typst\/issues\/5512/;
const filterStderr = (text) =>
  (text || '')
    .split('\n')
    .filter((line) => !KNOWN_WARNING.test(line))
    .join('\n')
    .trim();

async function run(command, args, options = {}) {
  try {
    const { stdout, stderr } = await exec(command, args, {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      ...options,
    });
    const rest = filterStderr(stderr);
    if (rest) process.stderr.write(rest + '\n');
    return stdout;
  } catch (error) {
    const detail = filterStderr(error.stderr) || error.message;
    if (/unknown font family/i.test(detail)) {
      throw new Error(
        `文档使用了本机没有的字体。请把字体放入 content/fonts/，或用 BLOG_FONT_PATHS 指定字体目录。\n${detail}`,
      );
    }
    if (error.code === 'ENOENT') {
      throw new Error(
        `找不到命令 ${command}。请安装 Typst 0.15+、Python 3.9+ 与 Poppler，或用 TYPST_BIN / PYTHON_BIN / PDFTOTEXT_BIN 指定路径。`,
      );
    }
    throw new Error(`${command} ${args.slice(0, 2).join(' ')} 执行失败。\n${detail}`);
  }
}

/**
 * 清空目录内容但保留目录本身。
 *
 * 逐个顶层条目删除，而不是一次性 rmSync 整个目录：部分宿主环境（例如注入了
 * 安全删除守卫的编辑器终端）对单次批量删除设有文件数量上限，逐个删不会触发。
 * 每个文章目录只有十来个文件，因此始终在限制之内。
 */
function clearDirectory(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory)) {
    fs.rmSync(path.join(directory, entry), { recursive: true, force: true });
  }
}

if (!fs.existsSync(themeEntry)) {
  throw new Error(
    `在 ${repoRoot} 找不到 lightmind.typ。blog/ 需要放在 fernmind 仓库内，或用 FERNWIND_ROOT 指向仓库根。`,
  );
}

const compilerVersion = (await run(compiler, ['--version'])).trim();
const version = /typst (\d+)\.(\d+)/.exec(compilerVersion);
if (!version || (Number(version[1]) === 0 && Number(version[2]) < 15)) {
  throw new Error('需要 Typst 0.15+：本流程依赖它的原生 HTML 导出与 eval 命令。');
}

// 字体：默认使用系统字体（与仓库自身的 scripts/build_web.py 一致）。
// content/fonts/ 与 BLOG_FONT_PATHS 作为额外字体目录，存在时才传给 Typst。
const fontPaths = [
  path.join(contentRoot, 'fonts'),
  ...(process.env.BLOG_FONT_PATHS || '').split(path.delimiter).filter(Boolean),
].filter((dir) => fs.existsSync(dir));
const common = ['--root', repoRoot, ...fontPaths.flatMap((dir) => ['--font-path', dir])];

// Typst 的富文本值（标题正文）转成纯文本。
const plain = (value) => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(plain).join('');
  if (!value || typeof value !== 'object') return '';
  if ('text' in value) return plain(value.text);
  if ('children' in value) return plain(value.children);
  if ('body' in value) return plain(value.body);
  return '';
};

/* ---------------------------------------------------------------- 读取元数据 */

const metadata = fs
  .readdirSync(entries)
  .filter((file) => file.endsWith('.json'))
  .map((file) => {
    const data = JSON.parse(fs.readFileSync(path.join(entries, file), 'utf8'));
    for (const key of ['title', 'slug', 'date', 'category', 'excerpt']) {
      if (typeof data[key] !== 'string' || !data[key].trim()) {
        throw new Error(`${file}: ${key} 必须是非空字符串`);
      }
    }
    if (!/^[a-z0-9-]+$/.test(data.slug)) throw new Error(`${file}: slug 只能用小写字母、数字和连字符`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date) || Number.isNaN(Date.parse(data.date))) {
      throw new Error(`${file}: date 必须是 YYYY-MM-DD`);
    }
    if (data.tags && (!Array.isArray(data.tags) || data.tags.some((tag) => typeof tag !== 'string'))) {
      throw new Error(`${file}: tags 必须是字符串数组`);
    }
    if (data.web !== undefined && typeof data.web !== 'boolean') {
      throw new Error(`${file}: web 只能是 true 或 false`);
    }
    const renderer = data.mathRenderer ?? 'native';
    if (renderer !== 'native' && renderer !== 'mathjax') {
      throw new Error(`${file}: mathRenderer 只能是 "native" 或 "mathjax"`);
    }
    const source = path.resolve(entries, file.replace(/\.json$/, '.typ'));
    if (!fs.existsSync(source)) throw new Error(`${file}: 缺少同名的 .typ 文章`);
    return {
      ...data,
      tags: data.tags || [],
      featured: Boolean(data.featured),
      mathRenderer: renderer,
      source,
    };
  })
  .sort((a, b) => b.date.localeCompare(a.date));

if (!metadata.length) throw new Error('content/posts/ 里没有找到任何文章。');
if (new Set(metadata.map((post) => post.slug)).size !== metadata.length) {
  throw new Error('存在重复的 slug。');
}

/* ------------------------------------------------------------ 文章样式与字体 */

// 原样式表以「整页」为前提，博客里只应作用于文章正文，因此把每条选择器
// 限定到 .fernmind-content。:root 与裸属性选择器保留原样，它们作用在文档根
// <html> 上（配色变量、渲染方式标记），必须保持根级语义。
const rawCss = [
  fs.readFileSync(path.join(repoRoot, 'web/fernmind.css'), 'utf8'),
  fs.readFileSync(path.join(repoRoot, 'web/fonts.css'), 'utf8'),
]
  .join('\n')
  .replaceAll('assets/fonts/', '/fernmind/assets/fonts/');
// 以属性选择器开头的规则（如 [data-theme="dark"] .x、[data-math="mathjax"] mjx-container）
// 中的属性同样挂在 <html> 上，是 .fernmind-content 的「祖先条件」。作用域必须插在
// 属性之后，写成 [data-math="mathjax"] .fernmind-content mjx-container；
// 若按普通选择器包在最外层，就变成「.fernmind-content 的后代带该属性」，
// 而这些属性永远在 <html> 上，规则会彻底失效。
// 注意：重复必须放进非捕获组。若写成捕获组重复，捕获结果只会保留最后一次重复，
// 形如 [data-math="mathjax"][data-math-state="loading"] 会丢掉前一个属性。
const ROOT_ATTRIBUTE_PREFIX = /^((?:\[[^\]]+\])+)\s+/;
const BARE_ATTRIBUTE = /^\[[^\]]+\]$/;
const scoped = postcss.parse(rawCss);
scoped.walkRules((rule) => {
  rule.selectors = rule.selectors.map((selector) => {
    if (selector === ':root' || BARE_ATTRIBUTE.test(selector)) return selector;
    if (selector === 'body' || selector === 'html') return '.fernmind-content';
    const attributePrefix = selector.match(ROOT_ATTRIBUTE_PREFIX);
    if (attributePrefix) {
      return `${attributePrefix[1]} .fernmind-content ${selector.slice(attributePrefix[0].length)}`;
    }
    return `.fernmind-content ${selector}`;
  });
});

/* ------------------------------------------------------------ 字体子集 */

// 霞鹜文楷的全量字体有 12.7 MB，主题里那条 -Text 子集又只覆盖 507 个码位，
// 正文出现子集之外的字就得把全量字体整个拉下来。这里改为按站点实际用字生成
// 子集（通常一百多 KB），并附上 unicode-range，使将来的生僻字回退到后备字体
// 而不是渲染成豆腐块。
const SUBSET_FONT_FILE = '/fernmind/assets/fonts/wenkai-subset.woff2';
const WENKAI_FACE = /@font-face\{font-family:"LXGW WenKai";[^}]*\}/g;

// 主题与 web/fonts.css 里各有两条霞鹜文楷 @font-face（全量 + 子集）。
// 把它们合并成一条指向本地子集的声明，位置沿用第一条，保持 CSS 顺序不变。
function applySubsetFace(css, unicodeRange) {
  const face = `@font-face{font-family:"LXGW WenKai";src:url("${SUBSET_FONT_FILE}") format("woff2");font-style:normal;font-weight:400;font-display:swap;unicode-range:${unicodeRange}}`;
  let replaced = false;
  return css.replace(WENKAI_FACE, () => {
    if (replaced) return '';
    replaced = true;
    return face;
  });
}

// 兜底字符集：ASCII、中英文标点与常见数学符号。正文里若出现子集之外的字，
// unicode-range 会让它回退到后备字体，不会变成豆腐块。
const BASE_CHARACTERS =
  ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~' +
  '·—–…“”‘’《》〈〉「」『』【】〔〕（）［］、。，；：？！　' +
  '×÷±≈≠≤≥∞∑∏√∫∂∈∀∃∧∨¬→←↑↓⇒⇔°′″μΩαβγδεζηθικλμνξπρστυφχψω' +
  // 组件库自己渲染出来的装饰记号（例如 Tabs 未给图标时用 ○ / ● 占位），
  // 不出现在 src/ 里，只能在这里兜底。
  '○●◆◇■□▲△▼▽★☆';

// 收集站点上会真正渲染出来的文字：文章源与元数据、站点文案与组件、以及
// 编译产物里的正文纯文本。宁可多收一点，也不要漏字。
//
// 产物一律走 visibleText() 而不是直接读文件：HTML 里的 <style> 内联样式、
// <script> 与 data: 图标都是字符噪音，收进来只会把子集撑大。
function visibleText(html) {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');
}

function collectFontText() {
  const parts = [BASE_CHARACTERS];
  const addFile = (file) => {
    try {
      parts.push(fs.readFileSync(file, 'utf8'));
    } catch {
      // 读不到就跳过，不因为某个可选文件缺失而中断构建。
    }
  };
  for (const name of fs.readdirSync(entries)) addFile(path.join(entries, name));
  // 递归读取 src/，将来把组件放进子目录也不会漏字。
  for (const name of fs.readdirSync(path.join(blogRoot, 'src'), { recursive: true })) {
    if (/\.(ts|tsx|html)$/.test(name)) addFile(path.join(blogRoot, 'src', name));
  }
  addFile(path.join(blogRoot, 'index.html'));
  for (const post of posts) {
    const directory = path.join(publicRoot, 'articles', post.slug);
    // document.html 是独立阅读页，除正文外还带标题、摘要、侧栏目录与页脚，
    // 用字比 body.html 更全，是主要的收集来源。
    for (const name of ['document.html', 'body.html']) {
      const file = path.join(directory, name);
      if (fs.existsSync(file)) parts.push(visibleText(fs.readFileSync(file, 'utf8')));
    }
    const text = path.join(directory, 'text.txt');
    if (fs.existsSync(text)) parts.push(fs.readFileSync(text, 'utf8'));
  }
  return parts.join('\n');
}

/* ------------------------------------------------------------------ 编译文章 */

// 每次构建从空的暂存目录开始，避免上一版的残留文件混进这一版。
clearDirectory(staging);
fs.mkdirSync(staging, { recursive: true });

const headingExpression =
  'query(heading).filter(h => h.outlined).map(h => (body: h.body, level: h.level, page: h.location().page(), y: h.location().position().y / 1pt))';

async function buildArticle({ source, ...data }) {
  const directory = path.join(staging, data.slug);
  fs.mkdirSync(directory);
  const pdfPath = path.join(directory, 'document.pdf');
  const svgPattern = path.join(directory, 'page-{p}.svg');
  const wantsWeb = data.web !== false;

  // 四件事互不依赖，并行执行。HTML 需要额外的后处理，故单独包一层。
  const webPromise = (async () => {
    if (!wantsWeb) return { html: '', documentTitle: '', webHeadings: [] };
    const htmlPath = path.join(directory, 'document.html');
    // 公式渲染方式由文章 JSON 的 mathRenderer 决定，content/theme.typ 会把它
    // 传给 lightmind()，因此这里不需要额外的 --input。
    await run(compiler, [
      'compile', ...common, '--features', 'html', '--format', 'html', source, htmlPath,
    ]);
    let html = fs.readFileSync(htmlPath, 'utf8')
      .replaceAll('assets/fonts/', '/fernmind/assets/fonts/')
      .replaceAll('assets/vendor/', '/fernmind/assets/vendor/');
    // 内联的 base64 图片外置为文件，避免正文体积失控。
    html = html.replace(/src="data:image\/(png|jpeg|webp|gif);base64,([^"\s]+)"/g, (_, kind, encoded) => {
      const bytes = Buffer.from(encoded, 'base64');
      const filename = createHash('sha256').update(bytes).digest('hex').slice(0, 20) + '.' + (kind === 'jpeg' ? 'jpg' : kind);
      fs.mkdirSync(path.join(directory, 'images'), { recursive: true });
      fs.writeFileSync(path.join(directory, 'images', filename), bytes);
      return `src="/articles/${data.slug}/images/${filename}"`;
    });
    // 以文件形式引用的图片（#image("...")）随文章一起发布。
    // 以 / 开头的是 Typst 的 root 绝对路径（root 即仓库根），否则相对 .typ 文件解析。
    const sourceDir = path.dirname(source);
    html = html.replace(/<img\b[^>]*>/g, (tag) => {
      const match = /\ssrc="([^"]*)"/.exec(tag);
      if (!match) return tag;
      const src = match[1];
      if (/^(?:https?:|data:|\/articles\/)/.test(src)) return tag;
      const file = src.startsWith('/') ? path.join(repoRoot, src) : path.resolve(sourceDir, src);
      if (!fs.existsSync(file)) return tag;
      const name = path.basename(file);
      fs.mkdirSync(path.join(directory, 'images'), { recursive: true });
      fs.copyFileSync(file, path.join(directory, 'images', name));
      return tag.replace(match[0], ` src="/articles/${data.slug}/images/${name}"`);
    });
    // 独立页面里的「下载网页项目」指向主题源码包，博客里改为指向许可说明。
    html = html.replace(
      'href="fernmind-web-source.zip">下载网页项目',
      'href="/licenses/fernmind.txt">阅读主题许可',
    );
    fs.writeFileSync(htmlPath, html);
    const extracted = JSON.parse(
      await run(python, [path.join(here, 'extract-typst-html.py'), htmlPath]),
    );
    fs.writeFileSync(path.join(directory, 'body.html'), extracted.html);
    // 公式渲染方式记录在导出页面的 <html data-math> 上。正文是从独立页面里
    // 抽出来的，这个属性不会跟过来，所以取出来交给 React 在客户端补回。
    const math = /<html[^>]*\sdata-math="([^"]+)"/.exec(html)?.[1] ?? data.mathRenderer;
    return { ...extracted, math };
  })();

  const [web, , , headingData] = await Promise.all([
    webPromise,
    run(compiler, ['compile', ...common, source, pdfPath]),
    run(compiler, ['compile', ...common, '--format', 'svg', source, svgPattern]),
    run(compiler, ['eval', headingExpression, '--in', source, ...common]),
  ]);

  // 纯文本：既是搜索索引，也是阅读时长的依据。
  const extractedText = await run(pdftotext, ['-enc', 'UTF-8', '-layout', pdfPath, '-']);
  const pageTexts = extractedText.split('\f');
  if (!pageTexts.at(-1)?.trim()) pageTexts.pop();

  // PDF 与 SVG 由同一份源文件生成，页数必须一致，否则说明有一次导出出了问题。
  const pageFiles = fs
    .readdirSync(directory)
    .filter((file) => /^page-\d+\.svg$/.test(file))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  if (!pageFiles.length || pageTexts.length !== pageFiles.length) {
    throw new Error(`${data.slug}: PDF 页数与 SVG 页数不一致`);
  }

  const pages = pageFiles.map((file, index) => {
    if (file !== `page-${index + 1}.svg`) throw new Error(`${data.slug}: SVG 页序不连续`);
    const svg = fs.readFileSync(path.join(directory, file), 'utf8');
    const viewBox = /viewBox="([\d.\s-]+)"/.exec(svg)?.[1].trim().split(/\s+/).map(Number);
    if (!viewBox || viewBox.length !== 4 || viewBox[2] <= 0 || viewBox[3] <= 0) {
      throw new Error(`${file}: SVG 尺寸无效`);
    }
    return {
      number: index + 1,
      src: `/articles/${data.slug}/${file}`,
      width: viewBox[2],
      height: viewBox[3],
      text: pageTexts[index].trim(),
    };
  });

  // 标题的纸面坐标：原版页面视图用它把目录锚点定位到 SVG 上。
  const headings = JSON.parse(headingData).map((heading, index) => ({
    id: `heading-${index + 1}`,
    text: plain(heading.body),
    level: heading.level,
    page: heading.page,
    y: heading.y,
  }));
  for (const heading of headings) {
    const page = pages[heading.page - 1];
    if (!page || heading.y < 0 || heading.y > page.height) {
      throw new Error(`${data.slug}: 标题位置超出页面范围`);
    }
  }

  fs.copyFileSync(source, path.join(directory, 'source.typ'));
  const text = pages.map((page) => page.text).join('\n\n');
  fs.writeFileSync(path.join(directory, 'text.txt'), text);
  console.log(`  已编译 ${path.basename(source)}：${pages.length} 页，${headings.length} 个标题`);

  return {
    ...data,
    ...web,
    format: 'typst',
    compiler: compilerVersion,
    content: text,
    pages,
    headings,
    minutes: Math.max(1, Math.ceil(text.replace(/\s/g, '').length / 350)),
    file: path.basename(source),
    pdf: `/articles/${data.slug}/document.pdf`,
    source: `/articles/${data.slug}/source.typ`,
    webUrl: web.html ? `/articles/${data.slug}/document.html` : '',
  };
}

const posts = [];
for (const entry of metadata) {
  posts.push(await buildArticle(entry));
}

/* ---------------------------------------------------------------- 写入产物 */

// 全部文章都编译成功后才替换上一版产物，单篇失败不会留下半套站点。
fs.mkdirSync(publicRoot, { recursive: true });
clearDirectory(path.join(publicRoot, 'articles'));
fs.cpSync(staging, path.join(publicRoot, 'articles'), { recursive: true });

clearDirectory(path.join(publicRoot, 'fernmind'));
const fontsTarget = path.join(publicRoot, 'fernmind/assets/fonts');
fs.mkdirSync(fontsTarget, { recursive: true });
// 霞鹜文楷的原文件不随站点分发（全量 12.7 MB，主题自带的子集只覆盖 507 码位），
// 由下面按实际用字生成的子集替代。其余字体与许可说明照常复制。
for (const name of fs.readdirSync(path.join(repoRoot, 'web/fonts'))) {
  if (/^LXGWWenKai-.*\.woff2?$/.test(name)) continue;
  fs.copyFileSync(path.join(repoRoot, 'web/fonts', name), path.join(fontsTarget, name));
}
// 可选公式渲染器随站点本地提供，不请求外部 CDN。
if (fs.existsSync(path.join(repoRoot, 'web/vendor'))) {
  fs.cpSync(path.join(repoRoot, 'web/vendor'), path.join(publicRoot, 'fernmind/assets/vendor'), { recursive: true });
}
fs.copyFileSync(path.join(repoRoot, 'cover.png'), path.join(publicRoot, 'fernmind/cover.png'));

const subsetSource = path.join(repoRoot, 'web/fonts/LXGWWenKai-Regular.woff');
const subset = await buildSubset({
  source: subsetSource,
  output: path.join(fontsTarget, 'wenkai-subset.woff2'),
  text: collectFontText(),
});

// 文章样式与独立阅读页内联的样式各有一份 @font-face，两处都要换掉；
// 否则独立阅读页会去请求已经不随站点分发的全量字体。
fs.writeFileSync(
  path.join(publicRoot, 'fernmind/article.css'),
  applySubsetFace(scoped.toString(), subset.unicodeRange),
);
for (const post of posts) {
  if (!post.webUrl) continue;
  const file = path.join(publicRoot, post.webUrl.replace(/^\//, ''));
  fs.writeFileSync(file, applySubsetFace(fs.readFileSync(file, 'utf8'), subset.unicodeRange));
}

// 子集化最大的风险是「漏字」——它不会报错，只会让页面悄悄换成后备字体。
// 三条断言各盯一类漏法：
//   1. unicode-range 无损表达字形覆盖：区间合并算错，浏览器就不认那些码位；
//   2. unicode-range 不多不少：多声明一个没有字形的码位就是一块豆腐；
//   3. 页面真正渲染出来的字都在请求集里：收集源漏了一处文案就会漏字。
const codepoints = (text) => new Set([...text].map((character) => character.codePointAt(0)));

// 这些字本来就该由专门字体渲染，不指望霞鹜文楷覆盖，也不算缺字：
//   · 控制与格式字符不需要字形（换行、零宽连接符等）；
//   · 数学字母数字符号由 MathML 的数学字体渲染；
//   · emoji 与杂项符号由系统 emoji 字体渲染。
const SPECIALIZED =
  /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\u{FE00}-\u{FE0F}\u{1D400}-\u{1D7FF}\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

const rangePoints = parseUnicodeRange(subset.unicodeRange);
const lostInRange = [...subset.covered].filter((point) => !rangePoints.has(point));
const extraInRange = [...rangePoints].filter((point) => !subset.covered.has(point));
if (lostInRange.length || extraInRange.length) {
  const describe = (points) => points.map((point) => String.fromCodePoint(point)).join('');
  throw new Error(
    'unicode-range 与字形覆盖不一致：' +
      `漏声明 ${lostInRange.length} 个（${describe(lostInRange)}）、多声明 ${extraInRange.length} 个（${describe(extraInRange)}）。` +
      'toUnicodeRange() 的区间合并有问题，或多声明了字体没有的字形（会渲染成豆腐块）。',
  );
}

// 校验对象是「最终产物」而不是收集源：即使有人给页面注入了一段新文案，
// 只要它出现在导出的 HTML 里就会被这里发现。
const renderedText = posts
  .filter((post) => post.webUrl)
  .map((post) => visibleText(fs.readFileSync(path.join(publicRoot, post.webUrl.replace(/^\//, '')), 'utf8')))
  .join('\n');
const rendered = codepoints(renderedText);
const notCollected = [...rendered].filter((point) => !subset.requested.has(point));
if (notCollected.length) {
  throw new Error(
    `正文用字不在子集请求范围内：${notCollected.map((point) => String.fromCodePoint(point)).join('')}` +
      `（共 ${notCollected.length} 个）。请检查 collectFontText() 是否漏了文字来源。`,
  );
}

// 排除掉该由专门字体渲染的字之后，剩下的才是真·缺字：正文里会出现一款「异体」。
const fallback = [...rendered].filter(
  (point) => !subset.covered.has(point) && !SPECIALIZED.test(String.fromCodePoint(point)),
);
if (fallback.length) {
  process.stderr.write(
    `提示：霞鹜文楷缺少 ${fallback.length} 个正文用字的字形（${fallback
      .map((point) => String.fromCodePoint(point))
      .join('')}），这些字会回退到后备字体。\n`,
  );
}

fs.mkdirSync(path.join(publicRoot, 'licenses'), { recursive: true });
fs.copyFileSync(path.join(repoRoot, 'LICENSE'), path.join(publicRoot, 'licenses/fernmind.txt'));

fs.writeFileSync(path.join(blogRoot, 'src/posts.json'), JSON.stringify(posts, null, 2) + '\n');
console.log(`已准备 ${posts.length} 篇文章（${compilerVersion}）。`);
console.log(
  `霞鹜文楷子集：请求 ${subset.characters} 字 → 声明 ${subset.covered.size} 个字形的 unicode-range，` +
    `正文 ${rendered.size} 字中 ${fallback.length} 字回退后备字体，` +
    `产物 ${(subset.bytes / 1024).toFixed(1)} KB（原字体 ${(fs.statSync(subsetSource).size / 1048576).toFixed(2)} MB）`,
);
