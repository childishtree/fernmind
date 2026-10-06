<div align="center">

[简体中文](README.md) | **English**

# 🍃 Lightmind Theme

> A forest-green Chinese document theme with light and dark modes.

[![Built with Typst](https://img.shields.io/badge/Typst-0.13%2B-239dad?logo=typst&logoColor=white)](https://typst.app)
[![Available on Typst Universe](https://img.shields.io/badge/Typst%20Universe-@preview%2Ffernmind-2ea44f)](https://typst.app/universe/package/fernmind)
[![Package version 0.1.0](https://img.shields.io/badge/version-0.1.0-orange)](https://typst.app/universe/package/fernmind)
[![MIT license](https://img.shields.io/github/license/childishtree/lightmind-typst)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/childishtree/lightmind-typst?style=social)](https://github.com/childishtree/lightmind-typst)

</div>

## 📖 Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Screenshots](#screenshots)
- [Installation](#installation)
- [Usage](#usage)
- [Options](#options)
- [Helper Functions](#helper-functions)
- [Table of Contents](#table-of-contents)
- [Full Demo](#full-demo)
- [Static Blog](#static-blog)
- [Contributing](#contributing)
- [License](#license)

## Introduction

Lightmind is a forest-green Chinese document theme, adapted from the Typora theme of the same name. It suits notes, blogs, documentation, and presentations. Cream paper surfaces carry the text, deep navy code blocks and rounded formula cards add contrast, and it ships with light/dark dual modes plus Markdown-style typesetting: YAML front matter, GitHub-style admonitions, task lists, and keycap styles.

## Features

- 🌲 Forest-green palette with cream paper and deep navy code blocks
- 🌗 Light / dark dual modes (via the `dark-mode` option; the web build can follow the system)
- 📝 Markdown-style typesetting: YAML front matter, admonitions, task lists, keycaps
- 📐 Rounded formula cards, soft-background table of contents, dotted leader lines
- 🎨 Chinese fake-bold / fake-italic (powered by `@preview/cuti`)
- 🧩 Reusable helpers: `frontmatter`, `mark`, `kbd`, `task`, `quote`
- 🖥️ Optional HTML export, plus a `blog/` scaffold that turns `.typ` articles into a static blog

## Screenshots

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="lightmind-dark.png">
  <img alt="Lightmind light / dark preview" src="lightmind-light.png">
</picture>

## Installation

Initialize a new project with the template:

```bash
typst init @preview/fernmind:0.1.0
```

Or import the theme into an existing document:

```typst
#import "@preview/fernmind:0.1.0": lightmind, frontmatter, mark, kbd, task
```

> Requires Typst 0.13+ (0.15+ recommended).

## Usage

```typst
#show: doc => lightmind(
  title: "My Document",
  // dark-mode: true,   // enable dark theme
  doc,
)

#frontmatter(
  title: "Lightmind Demo",
  author: "SunMoonTrain",
  date: "2026-05-06",
  tags: ("theme", "markdown", "demo"),
)
```

## Options

All parameters of `lightmind()`:

| Parameter | Description | Default |
| --- | --- | --- |
| `title` | Document title (centered, large); `none` hides it | `none` |
| `description` | Document description (web `<meta>` and PDF metadata) | theme default text |
| `dark-mode` | Light/dark theme: `true` dark / `false` light / `"auto"` follow the system (`"auto"` means light in PDF) | `"auto"` |
| `font` | Body font (fallback chain) | `("LXGW WenKai", "Source Han Serif SC")` |
| `code-font` | Code font (fallback chain) | `("Cascadia Code", "LXGW WenKai")` |
| `show-code-lang` | Whether to show the code block language label | `true` |
| `allow-page-breaks` | Whether page breaks are allowed; `false` outputs a single endless page | `true` |
| `plain-image-alts` | List of image `alt`s that use the default style (no rounded border) | `()` |
| `equation-numbering` | Auto-numbering pattern for block equations (e.g. `"(1)"`); `none` disables | `none` |
| `math-renderer` | Web only: formula rendering, `"native"` (MathML) or `"mathjax"` | `"native"` |

## Helper Functions

- `#frontmatter(title: ..., author: ..., date: ..., tags: (...), banner: ("cover.png", 150pt))`: YAML-style metadata block (accepts arbitrary key-value pairs; `banner` renders a top banner image)
- `#mark[...]`: highlighted text
- `#kbd[...]`: keycap style
- `#task(checked: true)[...]`: task list item
- `#quote(attribution: "note" \| "tip" \| "important" \| "warning" \| "caution")[...]`: GitHub-style admonition

Example:

```typst
#frontmatter(
  title: "Lightmind Demo",
  author: "SunMoonTrain",
  date: "2026-05-06",
  tags: ("theme", "markdown", "demo"),
  banner: ("cover.png", 150pt),
)

#quote(attribution: "tip")[ Primary green. For practical tips and best practices. ]

#task(checked: true)[Write the theme outline]
#task(checked: false)[Cross-platform testing]
```

## Table of Contents

Insert a table of contents with `#outline(title: "目录")` (or `#outline(title: "Table of Contents")`). The outline is rendered as a soft-background card with a green left bar: level-1 entries are bold, children are muted and auto-indented, entries carry dotted leader lines with page numbers, and the title inherits the level-1 heading style. It follows the theme automatically in dark mode.

## Full Demo

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="test_lightmind_dark.png">
  <img alt="Lightmind full feature demo" src="test_lightmind_light.png">
</picture>

## Static Blog

The `blog/` directory holds a scaffold that pre-renders Typst articles into a static blog. Write once, and the build produces three ways to read each article:

- **Web body**: Typst's native HTML export — selectable text, MathML formulas, native anchors for the outline and footnotes, and copy buttons on code blocks.
- **Original pages**: the same `.typ` exported as per-page SVG, preserving the fixed paper layout, with zoom from 75% to 250%.
- **PDF / source**: downloadable alongside every article.

It **does not copy the theme**. The build points Typst's `--root` at the repository root, so articles use `#import "/lightmind.typ"` and reuse `lightmind.typ` and `web/` directly — change the theme and the blog follows. The shell is built with [animal-island-ui](https://github.com/guokaigdg/animal-island-ui), with colours and fonts mapped back to Fernmind through CSS variables.

```sh
cd blog
npm install
npm run dev            # compile articles and start the dev server
npm run build          # build into blog/dist/
npm run check          # verify the output
```

Each article is a `.typ` plus a same-named `.json` in `content/posts/`; the JSON carries the title, excerpt, category and date. See [blog/README.md](blog/README.md) for details.

## Contributing

Issues and Pull Requests are welcome!

- 🐛 Report an issue: <https://github.com/childishtree/lightmind-typst/issues>
- 🚀 Submit code: <https://github.com/childishtree/lightmind-typst/pulls>
- 📦 Theme repository: <https://github.com/childishtree/lightmind-typst>

## License

MIT License, Copyright (c) 2026 Childish_tree. See [LICENSE](LICENSE).
