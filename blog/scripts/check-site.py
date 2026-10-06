#!/usr/bin/env python3
"""校验构建产物：路由、文章内容、锚点、本地资源、源文件与字体（仅用标准库）。"""
from collections import Counter
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit

root = Path("dist").resolve()
posts = json.loads(Path("src/posts.json").read_text(encoding="utf-8"))


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
for resource in re.findall(r'url\(["\']?([^\)"\']+)', css):
    if not (root / resource.lstrip("/")).is_file():
        errors.append("缺少随站点提供的字体：" + resource)

if errors:
    raise SystemExit("\n".join(errors))

print(
    f"已校验 {checked} 个页面、{len(posts)} 篇 Typst 文章，"
    "锚点、PDF、SVG、图片、源文件下载与 Fernmind 字体均正常。"
)
