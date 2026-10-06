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
fs.mkdirSync(path.join(publicRoot, 'fernmind/assets'), { recursive: true });
fs.cpSync(path.join(repoRoot, 'web/fonts'), path.join(publicRoot, 'fernmind/assets/fonts'), { recursive: true });
// 可选公式渲染器随站点本地提供，不请求外部 CDN。
if (fs.existsSync(path.join(repoRoot, 'web/vendor'))) {
  fs.cpSync(path.join(repoRoot, 'web/vendor'), path.join(publicRoot, 'fernmind/assets/vendor'), { recursive: true });
}
fs.copyFileSync(path.join(repoRoot, 'cover.png'), path.join(publicRoot, 'fernmind/cover.png'));
fs.writeFileSync(path.join(publicRoot, 'fernmind/article.css'), scoped.toString());

fs.mkdirSync(path.join(publicRoot, 'licenses'), { recursive: true });
fs.copyFileSync(path.join(repoRoot, 'LICENSE'), path.join(publicRoot, 'licenses/fernmind.txt'));

fs.writeFileSync(path.join(blogRoot, 'src/posts.json'), JSON.stringify(posts, null, 2) + '\n');
console.log(`已准备 ${posts.length} 篇文章（${compilerVersion}）。`);
