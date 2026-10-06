#!/usr/bin/env python3
"""Check generated local assets and document navigation without a browser."""
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1] / "dist"
class Document(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []; self.links = []; self.assets = []; self.tags = Counter()
    def handle_starttag(self, tag, attrs):
        self.tags[tag] += 1
        a = dict(attrs)
        if a.get("id"): self.ids.append(a["id"])
        if tag == "a" and a.get("href"): self.links.append(a["href"])
        if tag in ("img", "script", "link"):
            source = a.get("src") or a.get("href")
            if source: self.assets.append(source)

text = (ROOT / "index.html").read_text(encoding="utf-8")
doc = Document(); doc.feed(text)
errors = []
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
if errors: raise SystemExit("\n".join(errors))
print(f"Verified {len(doc.ids)} anchors, {doc.tags['table']} tables, {doc.tags['math']} equations, {doc.tags['img']} images and local assets.")
