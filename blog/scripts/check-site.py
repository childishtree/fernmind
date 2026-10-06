#!/usr/bin/env python3
"""校验构建产物：路由、文章内容、锚点、本地资源、源文件、字体与社交卡片（仅用标准库）。"""
from collections import Counter
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit

root = Path("dist").resolve()
posts = json.loads(Path("src/posts.json").read_text(encoding="utf-8"))

# 与 scripts/routes.mjs 取同一个站点根地址：环境变量优先，其次 site.ts 里的 url。
site_url = os.environ.get("SITE_URL", "").rstrip("/")
if not site_url:
    configured = re.search(r"\burl:\s*'([^']*)'", Path("src/site.ts").read_text(encoding="utf-8"))
    site_url = (configured.group(1) if configured else "").rstrip("/")

META = re.compile(r'<meta (?:property|name)="([^"]+)" content="([^"]*)"\s*/?>')
CANONICAL = re.compile(r'<link rel="canonical" href="([^"]*)"\s*/?>')
TITLE = re.compile(r"<title>(.*?)</title>")
DESCRIPTION = re.compile(r'<meta name="description" content="([^"]*)"\s*/?>')
WENKAI_FACE = re.compile(r'@font-face\{font-family:"LXGW WenKai";([^}]*)\}')
INVALID_RANGE = re.compile(r"U\+[0-9A-Fa-f]+-U\+")
UNICODE_RANGE = re.compile(r"unicode-range:([^};\"]*)")
SCRIPT_OR_STYLE = re.compile(r"<(script|style)\b[^>]*>.*?</\1>", re.S | re.I)
TAG = re.compile(r"<[^>]*>")

# 这些字本来就该由专门字体渲染，不指望霞鹜文楷覆盖：控制与格式字符不需要字形，
# 数学字母数字符号由 MathML 的数学字体渲染，emoji 与杂项符号由系统 emoji 字体渲染。
SPECIALIZED = re.compile(
    "[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028\\u2029\\ufe00-\\ufe0f"
    "\\U0001d400-\\U0001d7ff\\U0001f000-\\U0001faff\\u2600-\\u27bf]"
)


def visible_text(html):
    """页面里真正会渲染成字形的文字：去掉 script/style 与标签，属性值不算。"""
    return TAG.sub(" ", SCRIPT_OR_STYLE.sub(" ", html))


class Document(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.paths = []
        self.tags = Counter()

    def handle_starttag(self, tag, attrs):
        self.tags[tag] += 1
        a = dict(attrs)
        if a.get("id"):
            self.ids.append(a["id"])
        for attribute in ("href", "src"):
            if a.get(attribute):
                self.paths.append(a[attribute])

    handle_startendtag = handle_starttag


errors = []

# ---------------------------------------------------------------- 路由页面

pages = [
    root / "index.html",
    root / "archive/index.html",
    root / "about/index.html",
    root / "404.html",
]
pages += [root / f"posts/{post['slug']}/index.html" for post in posts]
# 独立阅读页：由 Typst 原生导出，不是 React 渲染的。
pages += [root / post["webUrl"].lstrip("/") for post in posts if post["webUrl"]]

checked = 0
for file in pages:
    if not file.is_file():
        errors.append(f"缺少页面：{file.relative_to(root)}")
        continue
    source = file.read_text(encoding="utf-8")
    document = Document()
    document.feed(source)
    if document.tags["main"] != 1:
        errors.append(f"{file.name}：应有且仅有一个 <main>，实际 {document.tags['main']} 个")
    if any(count > 1 for count in Counter(document.ids).values()):
        errors.append(f"{file}：存在重复锚点")
    resources = document.paths + re.findall(r'url\(["\']?([^\)"\']+)', source)
    for resource in resources:
        parsed = urlsplit(resource)
        if parsed.scheme or parsed.netloc:
            continue
        if not parsed.path:
            if parsed.fragment and unquote(parsed.fragment) not in document.ids:
                errors.append(f"{file}：缺少锚点 {resource}")
            continue
        target = (
            root / unquote(parsed.path).lstrip("/")
            if parsed.path.startswith("/")
            else file.parent / unquote(parsed.path)
        )
        if target.is_dir():
            target = target / "index.html"
        if not target.is_file():
            errors.append(f"{file}：缺少本地资源 {resource}")

    relative = file.relative_to(root).as_posix()
    if relative.startswith("articles/"):
        # 独立阅读页：Typst 原生导出，路径形如 articles/<slug>/document.html。
        route, is_standalone = "", True
    elif relative == "404.html":
        route, is_standalone = "404", False
    elif relative == "index.html":
        route, is_standalone = "", False
    else:
        route, is_standalone = relative[: -len("/index.html")], False

    head = source.split("</head>")[0]
    meta = dict(META.findall(head))
    canonical = CANONICAL.search(head)

    # 每页都要有完整的社交卡片，分享出去才有像样的预览。
    for key in (
        "og:type",
        "og:site_name",
        "og:locale",
        "og:title",
        "og:description",
        "twitter:card",
        "twitter:title",
        "twitter:description",
    ):
        if not meta.get(key):
            errors.append(f"{relative}：缺少 {key}")
    if meta.get("og:locale") not in (None, "zh_CN"):
        errors.append(f"{relative}：og:locale 应为 zh_CN，实际 {meta['og:locale']}")

    expected_type = "article" if is_standalone or route.startswith("posts/") else "website"
    if meta.get("og:type") not in (None, expected_type):
        errors.append(f"{relative}：og:type 应为 {expected_type}，实际 {meta['og:type']}")

    # og:title / og:description 与页面自身的标题、描述必须一致，否则分享卡片会跑偏。
    title = TITLE.search(head)
    if title and meta.get("og:title") and meta["og:title"] != title.group(1):
        errors.append(f"{relative}：og:title 与 <title> 不一致")
    description = DESCRIPTION.search(head)
    if description and meta.get("og:description") and meta["og:description"] != description.group(1):
        errors.append(f"{relative}：og:description 与 description 不一致")

    if site_url:
        if is_standalone:
            # 独立阅读页是同一篇文章的另一种排法，规范地址指回网页正文，避免被判重复内容。
            expected = f"{site_url}/posts/{relative[len('articles/') : -len('/document.html')]}/"
        else:
            expected = f"{site_url}/{route}/" if route else f"{site_url}/"
        if not canonical:
            errors.append(f"{relative}：缺少 <link rel=canonical>")
        elif canonical.group(1) != expected:
            errors.append(f"{relative}：canonical 应为 {expected}，实际 {canonical.group(1)}")
        if meta.get("og:url") != expected:
            errors.append(f"{relative}：og:url 应为 {expected}，实际 {meta.get('og:url')}")
        image = meta.get("og:image", "")
        if not image.startswith(f"{site_url}/"):
            errors.append(f"{relative}：og:image 不是本站绝对地址（{image}）")
        elif not (root / urlsplit(image).path.lstrip("/")).is_file():
            errors.append(f"{relative}：og:image 指向的文件不存在（{image}）")
        if meta.get("twitter:image") != image:
            errors.append(f"{relative}：twitter:image 与 og:image 不一致")
    checked += 1

# ---------------------------------------------------------------- 文章内容

for post in posts:
    slug = post["slug"]
    source = (root / f"posts/{slug}/index.html").read_text(encoding="utf-8")

    if post["math"] not in ("native", "mathjax"):
        errors.append(f"{slug}：math 取值异常（{post['math']}）")

    if post["math"] == "mathjax":
        # 防闪脚本必须内联在 <head>，在首次绘制前写好 data-math / data-math-state="loading"，
        # 否则原生 MathML 会先露出来、再被 MathJax 替换，出现一次闪动。
        head = source.split("</head>")[0]
        if 'dataset.math="mathjax"' not in head or 'dataset.mathState="loading"' not in head:
            errors.append(f"{slug}：MathJax 文章缺少首屏防闪脚本")

    if post["html"]:
        if post["headings"] and not post["webHeadings"]:
            errors.append(f"{slug}：网页目录为空")
        # 默认阅读视图必须是真实的 Fernmind 正文，而不是 SVG 占位。
        if 'class="fernmind-content"' not in source or 'class="typst-page"' in source:
            errors.append(f"{slug}：默认阅读视图没有包含真实的 Fernmind 正文")
        if not all(f'id="{h["id"]}"' in source for h in post["webHeadings"]):
            errors.append(f"{slug}：侧栏目录的目标锚点缺失")
        if "<math" in post["html"] and "<math" not in source:
            errors.append(f"{slug}：预渲染页面丢失了原生 MathML")

        # 正文里的图片必须真的存在（构建时应已外置并复制到文章目录）。
        for src in re.findall(r'<img\b[^>]*\ssrc="([^"]*)"', post["html"]):
            if re.match(r"^(?:https?:|data:)", src):
                continue
            if not src.startswith("/articles/"):
                errors.append(f"{slug}：图片未被外置为站点路径（{src}）")
                continue
            if not (root / src.lstrip("/")).is_file():
                errors.append(f"{slug}：图片文件缺失（{src}）")

    if not (root / post["pdf"].lstrip("/")).read_bytes().startswith(b"%PDF-"):
        errors.append(f"{slug}：PDF 无效")
    for page in post["pages"]:
        if "<svg" not in (root / page["src"].lstrip("/")).read_text(encoding="utf-8"):
            errors.append(f"{slug}：SVG 页面无效")

    # 下载的源文件必须与 content/posts 下的入口完全一致。
    expected = Path("content/posts") / post["file"]
    if expected.read_bytes() != (root / post["source"].lstrip("/")).read_bytes():
        errors.append(f"{slug}：可下载的源文件与 .typ 入口不一致")

    # 独立阅读页里的「下载网页项目」应已改写为许可说明，不再指向源码包。
    if post["webUrl"]:
        standalone = (root / post["webUrl"].lstrip("/")).read_text(encoding="utf-8")
        if "fernmind-web-source.zip" in standalone:
            errors.append(f"{slug}：独立阅读页仍指向已不存在的源码包链接")

# ---------------------------------------------------------------- 样式与字体

css = (root / "fernmind/article.css").read_text(encoding="utf-8")
if ".fernmind-content .code-block" not in css:
    errors.append("文章样式缺少 .fernmind-content .code-block，作用域化可能失败")
if "--accent:#4a7c59" not in css:
    errors.append("文章样式缺少 Fernmind 原始配色变量")
# data-math 挂在 <html> 上，是 .fernmind-content 的祖先条件，作用域必须插在属性之后。
if '[data-math="mathjax"] .fernmind-content' not in css:
    errors.append('文章样式缺少 [data-math="mathjax"] .fernmind-content，公式规则可能失效')
if '.fernmind-content [data-math=' in css:
    errors.append("文章样式出现 .fernmind-content [data-math=...]，作用域方向反了，规则永远不会命中")
# 表格行样式必须限定 thead / tbody。Typst 的导出把表头放进 <thead>、数据行放进
# <tbody>，而 :first-child / :nth-child 是**相对父元素**计数的：裸的 tr:first-child
# 会同时命中 thead 的第一行与 tbody 的第一行（数据首行被画成表头），裸的
# tr:nth-child 也会在 tbody 里重新计数，斑马纹整体错位一行。
TABLE_ROW_PSEUDO = re.compile(r"tr:(?:first-child|last-child|nth-child\([^)]*\))")
for match in TABLE_ROW_PSEUDO.finditer(css):
    boundary = max(css.rfind("}", 0, match.start()), css.rfind("{", 0, match.start()), css.rfind(",", 0, match.start()))
    selector = css[boundary + 1 : match.end()].strip()
    if "thead" not in selector and "tbody" not in selector:
        errors.append(f"fernmind/article.css：选择器「{selector}」未限定 thead/tbody，表格行样式会串行")
# 代码块语法高亮的 token 颜色必须全部被样式覆盖。Typst 给每个 token 写内联
# style="color: #xxxxxx"，靠 CSS 的 span[style*="#xxxxxx"] 规则换成本主题配色；
# 漏掉任何一种，该 token 就会在浅色代码块上保留原色，几乎看不清。
TOKEN_COLOR = re.compile(r'style="color:\s*(#[0-9a-fA-F]{6})"')
for post in posts:
    for color in sorted(set(TOKEN_COLOR.findall(post.get("html") or ""))):
        if f'span[style*="{color}"]' not in css:
            errors.append(f"{post['slug']}：代码块 token 颜色 {color} 没有对应的样式覆盖规则")
for resource in re.findall(r'url\(["\']?([^\)"\']+)', css):
    if not (root / resource.lstrip("/")).is_file():
        errors.append("缺少随站点提供的字体：" + resource)

# ---------------------------------------------------------------- 字体子集

# 站点不应再分发 12.7 MB 的全量霞鹜文楷；正文用字由构建期按实际用字裁成子集。
fonts = root / "fernmind/assets/fonts"
full_fonts = sorted(p.name for p in fonts.glob("LXGWWenKai-*")) if fonts.is_dir() else []
if full_fonts:
    errors.append("站点仍在分发霞鹜文楷全量字体：" + "、".join(full_fonts))
subset = fonts / "wenkai-subset.woff2"
if not subset.is_file():
    errors.append("缺少按实际用字生成的字体子集：fernmind/assets/fonts/wenkai-subset.woff2")
elif subset.stat().st_size > 512 * 1024:
    errors.append(f"字体子集异常偏大（{subset.stat().st_size} 字节），用字收集可能失控")

# 子集声明散落在文章样式与各独立阅读页的内联样式里，逐份检查。
styles = {"fernmind/article.css": css}
for post in posts:
    if post["webUrl"]:
        name = post["webUrl"].lstrip("/")
        styles[name] = (root / name).read_text(encoding="utf-8")
for name, text in styles.items():
    if "LXGWWenKai" in text:
        errors.append(f"{name}：仍引用霞鹜文楷全量字体")
    if "wenkai-subset.woff2" not in text:
        errors.append(f"{name}：没有引用字体子集")
    face = WENKAI_FACE.search(text)
    if not face:
        errors.append(f'{name}：找不到 font-family:"LXGW WenKai" 的 @font-face')
        continue
    # 没有 unicode-range，字体就会对全部码位生效，缺字画成豆腐块而不是回退。
    if "unicode-range" not in face.group(1):
        errors.append(f"{name}：霞鹜文楷的 @font-face 缺少 unicode-range，缺字会变成豆腐块")
    # CSS 的 <urange> 只在区间开头写一次 U+：U+20-7E 合法，U+20-U+7E 无效。
    if INVALID_RANGE.search(text):
        errors.append(f"{name}：unicode-range 写成 U+xx-U+yy，浏览器会整条丢弃")

# 端到端复核：页面真正渲染出来的文字必须落在子集的 unicode-range 内。落在范围外
# 就会回退到后备字体，页面上冒出一款「异体」字。这一步覆盖正文与界面两处文案，
# 也覆盖「有人新加了一段界面文案却没进收集源」这种情况。
declared = set()
for part in UNICODE_RANGE.search(css).group(1).split(","):
    part = part.strip()
    if not part.upper().startswith("U+"):
        errors.append(f"fernmind/article.css：无法解析的 unicode-range 片段「{part}」")
        continue
    bounds = part[2:].split("-")
    declared.update(range(int(bounds[0], 16), int(bounds[-1], 16) + 1))

for file in pages:
    if not file.is_file():
        continue
    fallback = sorted(
        {
            ord(character)
            for character in visible_text(file.read_text(encoding="utf-8"))
            if not SPECIALIZED.match(character) and ord(character) not in declared
        }
    )
    if fallback:
        errors.append(
            f"{file.relative_to(root)}：{len(fallback)} 个字符不在字体子集内"
            f"（{''.join(map(chr, fallback))}），会回退到后备字体"
        )

if errors:
    raise SystemExit("\n".join(errors))

print(
    f"已校验 {checked} 个页面、{len(posts)} 篇 Typst 文章，"
    "锚点、PDF、SVG、图片、源文件下载、社交卡片与字体子集均正常。"
)
