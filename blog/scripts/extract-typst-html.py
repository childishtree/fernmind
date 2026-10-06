#!/usr/bin/env python3
"""从 Typst 原生导出的 HTML 中切出文章正文与标题锚点（仅用 Python 标准库）。

Typst 的 HTML 导出会生成一整页（工具栏、正文、页脚、脚本）。博客只需要
<main class="paper"> 里的正文，并且希望：

* 去掉 h1.document-title —— 标题由 React 的页头渲染，避免重复；
* 给没有 id 的标题补上锚点 —— Typst 只在标题被目录或链接引用时才分配 id，
  未被引用的标题在这里补一个 web-heading-N，供侧栏目录跳转。

输出 JSON：{"html": ..., "documentTitle": ..., "webHeadings": [...]}
"""
import json
from html.parser import HTMLParser
from pathlib import Path
import re
import sys

VOID = {
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
}


class Article(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.source = source
        # 行首偏移表：HTMLParser 只给出行列号，需要自己换算成字符下标。
        self.offsets = [0]
        for line in source.splitlines(keepends=True):
            self.offsets.append(self.offsets[-1] + len(line))
        self.stack = []
        self.start = self.end = None
        self.main_depth = None
        self.active_heading = None
        self.headings = []
        self.ids = set()
        self.edits = []
        self.outline_depth = None
        self.title_start = self.title_end = None
        self.title_depth = None
        self.title = []

    def source_offset(self):
        line, column = self.getpos()
        return self.offsets[line - 1] + column

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        inside = self.start is not None and self.end is None
        if tag == "main" and "paper" in attrs.get("class", "").split():
            if self.start is not None:
                raise ValueError("正文里出现了多个 <main class=\"paper\">")
            self.start = self.source_offset() + len(self.get_starttag_text())
            self.main_depth = len(self.stack)
        elif inside:
            # 正文里不应出现脚本或样式，出现了说明抽取边界判断错了。
            if tag in {"script", "style"}:
                raise ValueError("正文中不应包含 script 或 style")
            if attrs.get("id"):
                if attrs["id"] in self.ids:
                    raise ValueError("正文中存在重复锚点：" + attrs["id"])
                self.ids.add(attrs["id"])
            # 目录（document-outline）里的标题不参与正文锚点。
            if "document-outline" in attrs.get("class", "").split():
                self.outline_depth = len(self.stack)
            level = re.search(r"(?:^|\s)heading-level-([1-6])(?:\s|$)", attrs.get("class", ""))
            if level and self.outline_depth is None:
                anchor = attrs.get("id")
                if not anchor:
                    anchor = "web-heading-" + str(len(self.headings) + 1)
                    self.ids.add(anchor)
                    # 在开始标签末尾插入 id，位置 = 标签起点 + 标签长度 - 1（跳过 '>'）
                    position = self.source_offset() + len(self.get_starttag_text()) - 1
                    self.edits.append((position, position, ' id="' + anchor + '"'))
                self.active_heading = {
                    "id": anchor,
                    "level": int(level[1]),
                    "text": "",
                    "depth": len(self.stack),
                }
            if tag == "h1" and "document-title" in attrs.get("class", "").split():
                self.title_start = self.source_offset()
                self.title_depth = len(self.stack)
        if tag not in VOID:
            self.stack.append(tag)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if not self.stack or self.stack[-1] != tag:
            raise ValueError("原生 HTML 标签不匹配：" + tag)
        depth = len(self.stack) - 1
        if self.main_depth == depth and tag == "main":
            self.end = self.source_offset()
        if self.active_heading and self.active_heading["depth"] == depth:
            heading = self.active_heading
            heading.pop("depth")
            heading["text"] = re.sub(r"\s+", " ", heading["text"]).strip()
            self.headings.append(heading)
            self.active_heading = None
        if self.title_depth == depth and tag == "h1":
            self.title_end = self.source_offset() + len("</h1>")
            self.title_depth = None
        if self.outline_depth == depth:
            self.outline_depth = None
        self.stack.pop()

    def handle_data(self, data):
        if self.active_heading:
            self.active_heading["text"] += data
        if self.title_depth is not None:
            self.title.append(data)


source = Path(sys.argv[1]).read_text(encoding="utf-8")
article = Article(source)
article.feed(source)
if article.start is None or article.end is None:
    raise SystemExit(
        "没有找到 <main class=\"paper\">。请使用 content/theme.typ 的 article 入口，"
        "或在该文章的 JSON 里设置 \"web\": false 以直接展示 PDF 页面。"
    )
if article.title_start is not None and article.title_end is not None:
    article.edits.append((article.title_start, article.title_end, ""))

chunks = []
cursor = article.start
for start, end, replacement in sorted(article.edits):
    chunks.append(source[cursor:start])
    chunks.append(replacement)
    cursor = end
chunks.append(source[cursor:article.end])

print(json.dumps(
    {
        "html": "".join(chunks),
        "documentTitle": "".join(article.title).strip(),
        "webHeadings": article.headings,
    },
    ensure_ascii=False,
))
