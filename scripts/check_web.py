#!/usr/bin/env python3
"""Check generated local assets, navigation and accessibility without a browser."""
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1] / "dist"
THEME = Path(__file__).resolve().parents[1] / "web" / "theme.typ"

# 兜底 alt 由主题定义，这里直接读回来，避免两边写死后失配。
_match = re.search(r'#let image-alt-fallback\s*=\s*"([^"]*)"', THEME.read_text(encoding="utf-8"))
FALLBACK_ALT = _match.group(1) if _match else "插图"


class Document(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []; self.links = []; self.assets = []; self.tags = Counter()
        self.imgs = []; self.anchors = []; self.metas = []; self.headings = []
        self.html_attrs = {}
    def handle_starttag(self, tag, attrs):
        self.tags[tag] += 1
        a = dict(attrs)
        if tag == "html":
            self.html_attrs = a
        if a.get("id"): self.ids.append(a["id"])
        if tag == "a":
            if a.get("href"): self.links.append(a["href"])
            self.anchors.append(a)
        if tag == "img": self.imgs.append(a)
        if tag == "meta": self.metas.append(a)
        if tag in ("h1", "h2", "h3", "h4", "h5", "h6"): self.headings.append(int(tag[1]))
        if tag in ("img", "script", "link"):
            source = a.get("src") or a.get("href")
            if source: self.assets.append(source)


text = (ROOT / "index.html").read_text(encoding="utf-8")
doc = Document(); doc.feed(text)
errors = []
warnings = []

# --- 结构与导航 ---
for id_, count in Counter(doc.ids).items():
    if count > 1: errors.append("Duplicate id: " + id_)
for link in doc.links:
    if link.startswith("#") and unquote(link[1:]) not in doc.ids:
        errors.append("Missing anchor: " + link)
paths = doc.assets + [a for a in doc.links if not a.startswith("#")]
paths += re.findall(r'url\([\"\']?([^\)\"\']+)', text)
for path in paths:
    parsed = urlsplit(path)
    if not parsed.scheme and parsed.path and not (ROOT / unquote(parsed.path).lstrip("/")).is_file():
        errors.append("Missing file: " + path)
if doc.tags['main'] != 1: errors.append("Expected one main document")
if not doc.tags['title']: errors.append("Page metadata title missing")

# --- 无障碍：图片替代文本 ---
for img in doc.imgs:
    if "alt" not in img:
        errors.append("Image without alt attribute: " + (img.get("src") or "")[:60])
    elif img["alt"] == FALLBACK_ALT:
        warnings.append("Image uses the fallback alt, please write a real one: " + (img.get("src") or "")[:60])

# --- 无障碍：标题层级不得跳级 ---
previous = 0
for level in doc.headings:
    if previous and level - previous > 1:
        warnings.append(f"Heading level jumps from h{previous} to h{level}")
    previous = level

# --- 无障碍：外链需新标签打开并带 rel 保护 ---
for anchor in doc.anchors:
    href = anchor.get("href") or ""
    if href.startswith("http://") or href.startswith("https://"):
        rel = (anchor.get("rel") or "").split()
        if anchor.get("target") != "_blank":
            warnings.append("External link missing target=_blank: " + href)
        if "noopener" not in rel:
            warnings.append("External link missing rel=noopener: " + href)

# --- 元信息 ---
meta_names = {m.get("name") for m in doc.metas}
meta_props = {m.get("property") for m in doc.metas}
for required in ("description", "viewport", "color-scheme"):
    if required not in meta_names: errors.append("Missing meta name=" + required)
if "theme-color" not in meta_names: warnings.append("Missing meta name=theme-color")
for required in ("og:title", "og:description", "og:type"):
    if required not in meta_props: warnings.append("Missing meta property=" + required)
if not doc.html_attrs.get("lang"): errors.append("html element missing lang")
if "data-math" not in doc.html_attrs: errors.append("html element missing data-math")

# --- 表格行样式必须限定 thead / tbody ---
# Typst 的 HTML 导出把表头放进 <thead>、数据行放进 <tbody>，而 :first-child /
# :nth-child 是**相对父元素**计数的：裸的 tr:first-child 会同时命中 thead 的第一行
# 与 tbody 的第一行（数据首行被画成表头），裸的 tr:nth-child 也会在 tbody 里重新
# 计数，斑马纹整体错位一行。CSS 内联在 <style> 里，所以直接在整页文本上扫。
for _match in re.finditer(r"tr:(?:first-child|last-child|nth-child\([^)]*\))", text):
    _boundary = max(
        text.rfind("}", 0, _match.start()),
        text.rfind("{", 0, _match.start()),
        text.rfind(",", 0, _match.start()),
    )
    _selector = text[_boundary + 1 : _match.end()].strip()
    if "thead" not in _selector and "tbody" not in _selector:
        errors.append("Table row selector not scoped to thead/tbody: " + _selector)

for warning in warnings:
    print("warning: " + warning)
if errors: raise SystemExit("\n".join(errors))
print(f"Verified {len(doc.ids)} anchors, {doc.tags['table']} tables, {doc.tags['math']} equations, "
      f"{doc.tags['img']} images and local assets ({len(warnings)} warnings).")
