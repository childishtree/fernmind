# Fernmind 网页版

基于 Childish_tree 的 [fernmind](https://github.com/childishtree/fernmind)，将 Lightmind 中文文档主题增加为可生成 HTML 的版本。网页内容由原 `test_lightmind.typ` 编译，保留原示例及配图。原作者、版权和 MIT 许可证均保留。

## 快速使用

需要 **Typst 0.15.1 或更新版本**、Python 3.9+。Python 构建脚本只使用标准库。首次运行时，Typst 会获取原项目依赖 `cuti:0.4.0` 和 `tablem:0.3.0`。

```sh
python scripts/build_web.py
python -m http.server 8000 --directory dist
```

浏览器打开 `http://localhost:8000`。将 `dist/` 中的全部文件上传到静态网站空间即可发布，不需要 Node.js、数据库或服务器应用。

指定 Typst 可执行文件：

```sh
python scripts/build_web.py --typst /path/to/typst
```

编译一个新文档：

```sh
python scripts/build_web.py --entry template/main.typ
```

每次构建都会重新编译文档并更新资源，不依赖上一次构建的时间戳。

启用改进的公式渲染（本地打包的 MathJax）：

```sh
python scripts/build_web.py --math-renderer mathjax
```

## 编写内容

继续使用原来的命令名称和参数。使用本项目的本地适配文件导入，而不是原版 Universe 包：

```typst
#import "lightmind.typ": lightmind, frontmatter, mark, kbd, task, tablem
#show: doc => lightmind(title: "我的文档", equation-numbering: "(1)", doc)
#frontmatter(title: "我的文档", author: "作者", tags: ("笔记", "研究"))
#outline(title: "目录")
= 开始
正文、*粗体*、_斜体_、#mark[高亮]、#kbd[Ctrl]。
#quote(attribution: "tip")[提示内容。]
#task(checked: true)[已完成的事项]
$ E = m c^2 $
```

网页右上角可切换明暗主题，并在当前浏览器保存偏好。首次打开默认遵从 `dark-mode` 参数；这项偏好不会改变 Typst 源文件。任务列表保留原文档中的完成状态，不作为待办应用存储数据。

## 文件与定制

| 文件 | 作用 |
| --- | --- |
| `lightmind.typ` | 原模板；增加 HTML 分支及辅助函数的转发，保留 PDF 分支 |
| `web/theme.typ` | 将主题组件映射到语义化 HTML，处理公式编号和脚注 |
| `web/fernmind.css` | 原配色、标题、代码、表格、公式、图片及手机布局 |
| `web/theme.js` | 明暗主题切换 |
| `web/fonts/` | 随站点提供的霞鹜文楷、Cascadia Code 及字体许可证 |
| `web/vendor/mathjax/` | 可选的 MathJax 组件（MathML→SVG）及 Apache-2.0 许可证 |
| `test_lightmind.typ` | 原仓库的完整功能示例 |
| `scripts/build_web.py` | 编译、提取图片资源、复制字体并生成源码包 |
| `dist/` | 可发布的网页文件 |

`font` 和 `code-font` 映射为网页字体栈。默认字体随网站提供；指定其他字体时需自行提供相应的网页字体或确保访问者安装了字体。`show-code-lang`、`plain-image-alts`、`equation-numbering`、`title`、`dark-mode` 均有网页对应行为。`allow-page-breaks` 仅影响 PDF；网页采用连续滚动。

## 公式渲染（可选）

默认公式沿用 Typst 导出的原生 MathML：零 JavaScript、可选中复制，但排版细节随浏览器实现而异。

设置 `math-renderer: "mathjax"` 后，页面会加载随站点本地打包的 MathJax（`web/vendor/mathjax/`，Apache-2.0），把 `<math>` 重新排版为 SVG——跨浏览器一致、不依赖访问者系统安装的数学字体，深色模式下自动跟随文字颜色，且仍不请求任何外部 CDN。代价是页面额外加载约 1.7 MB 脚本。

```typst
#show: doc => lightmind(math-renderer: "mathjax", doc)
```

命令行构建时用 `--math-renderer mathjax` 亦可（`test_lightmind.typ` 通过 `sys.inputs` 读取该开关）。两种模式都无需改动文档正文，切换只影响输出。

网页保留原样式语言，目录改为章节链接。浏览器换行、屏幕尺寸和 MathML 排版会与 PDF 有细微差异。HTML 导出仍是 Typst 的实验功能，本版已用 Typst 0.15.1 编译完整示例；建议固定这个编译器版本复现。

修改内容后再次运行构建命令。网站可直接打开阅读，正文不是截图；数学公式为原生 MathML。样式、脚本、图片、字体均在生成目录中，不依赖外部 CDN。

## 原项目与许可证

原仓库和提交记录见 `UPSTREAM.json`。本项目沿用 MIT 许可证；字体各自的 SIL Open Font License 随字体目录附带。源码包不包含任何托管账号信息。
