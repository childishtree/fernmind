// 博客的 Typst 入口：直接复用仓库根的主题，不再复制一份副本。
//
// 构建脚本把 Typst 的 --root 指向 fernmind 仓库根，所以这里可以用以 / 开头的
// root 绝对路径导入。主题只有一份，博客永远跟着仓库当前的 lightmind.typ 走，
// 不会出现「副本停在旧版本、样式修正在博客里失效」的问题。
#import "/lightmind.typ": lightmind, frontmatter, mark, kbd, task, tablem

// 文章统一入口。
//
// meta 是 content/posts/<slug>.json 解析出的字典。标题、摘要、初始主题、
// 公式渲染方式都从那里读取，正文里不必重复声明一遍。
//
// 可用参数（都可以在 JSON 里配置，也可以在 .typ 里显式覆盖）：
//   title        文章标题
//   excerpt      摘要，同时用作网页的 <meta name="description">
//   darkMode     true / false / "auto"（默认跟随系统，首屏不闪）
//   mathRenderer "native"（默认，原生 MathML）或 "mathjax"（本地打包，渲染更一致）
#let article(
  meta: (:),
  author: "Fernmind 博客",
  dark-mode: auto,
  font: ("LXGW WenKai", "Noto Sans SC"),
  code-font: ("Cascadia Code", "LXGW WenKai"),
  body,
) = {
  set document(author: author)
  let theme = if dark-mode == auto { meta.at("darkMode", default: "auto") } else { dark-mode }
  lightmind(
    title: meta.at("title", default: ""),
    description: meta.at("excerpt", default: ""),
    dark-mode: theme,
    math-renderer: meta.at("mathRenderer", default: "native"),
    font: font,
    code-font: code-font,
    equation-numbering: "(1)",
    body,
  )
}
