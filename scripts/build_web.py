#!/usr/bin/env python3
"""Build the real Typst source into the Fernmind website (Python standard library)."""
import argparse
import base64
import hashlib
import os
from pathlib import Path
import re
import shutil
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]

def build(typst, entry, math_renderer="native"):
    dist = ROOT / "dist"
    dist.mkdir(exist_ok=True)
    assets = dist / "assets"
    (assets / "images").mkdir(parents=True, exist_ok=True)
    (assets / "fonts").mkdir(exist_ok=True)
    for path in (ROOT / "web/fonts").glob("*"):
        if path.suffix in (".woff", ".woff2", ".txt"):
            shutil.copy2(path, assets / "fonts" / path.name)
    # 可选公式渲染器（如 MathJax）随站点本地提供，不请求外部 CDN。
    vendor = ROOT / "web/vendor"
    if vendor.is_dir():
        shutil.copytree(vendor, assets / "vendor", dirs_exist_ok=True)
    command = [
        typst, "compile", "--root", str(ROOT), "--features", "html",
        "--format", "html",
    ]
    if math_renderer != "native":
        command += ["--input", "math-renderer=" + math_renderer]
    command += [str(ROOT / entry), str(dist / "index.html")]
    subprocess.run(command, cwd=ROOT, check=True)
    source = (dist / "index.html").read_text(encoding="utf-8")
    def externalize(match):
        kind, data = match.groups()
        raw = base64.b64decode(data)
        suffix = {"png": "png", "jpeg": "jpg", "webp": "webp", "gif": "gif"}[kind]
        filename = hashlib.sha256(raw).hexdigest()[:20] + "." + suffix
        (assets / "images" / filename).write_bytes(raw)
        return 'src="assets/images/' + filename + '"'
    source = re.sub(r'src="data:image/(png|jpeg|webp|gif);base64,([^"\s]+)"', externalize, source)
    (dist / "index.html").write_text(source, encoding="utf-8")
    shutil.copy2(ROOT / "LICENSE", dist / "LICENSE.txt")

    # Package the reusable source, without hosting identity, caches or credentials.
    files = ["lightmind.typ", "test_lightmind.typ", "typst.toml", "README.md",
             "README.en.md", "README-WEB.md", "LICENSE", "cover.png",
             "lightmind-light.png", "lightmind-dark.png", "UPSTREAM.json"]
    for folder in ("web", "scripts", "template"):
        for path in sorted((ROOT / folder).rglob("*")):
            if path.is_file() and path.suffix not in (".ttf", ".pyc"):
                files.append(path.relative_to(ROOT).as_posix())
    with zipfile.ZipFile(dist / "fernmind-web-source.zip", "w", zipfile.ZIP_DEFLATED) as archive:
        for name in files:
            archive.write(ROOT / name, "fernmind-web/" + name)
    print("Built dist/index.html and dist/fernmind-web-source.zip")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--typst", default=os.getenv("TYPST_BIN") or shutil.which("typst"), help="Typst 0.15.1+ executable")
    parser.add_argument("--entry", default="test_lightmind.typ", help="Typst document relative to the project root")
    parser.add_argument("--math-renderer", default="native", choices=("native", "mathjax"),
                        help="网页公式渲染：native(默认, 原生 MathML) 或 mathjax(本地打包的 MathJax)")
    args = parser.parse_args()
    if not args.typst:
        parser.error("Install Typst 0.15.1+, or pass --typst /path/to/typst")
    build(args.typst, args.entry, args.math_renderer)
