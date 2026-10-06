// HTML adapter for fernmind. The document body remains ordinary Typst.
#let kbd(body) = html.kbd(body)
#let mark(body) = html.mark(body)
#let task(checked: false, body) = html.div(class: "task-item", {
  html.elem("input", attrs: (type: "checkbox", disabled: "", aria-label: if checked { "已完成" } else { "未完成" }, ..if checked { (checked: "") } else { (:)}))
  html.span(body)
})
// 图片未显式提供 alt 时的兜底替代文本。
// Typst 的 HTML 导出对 alt: none 不会输出 alt 属性，直接产出缺少替代文本的
// <img>（无障碍缺陷）；这里用 set 规则补一个中性兜底值，作者显式写的 alt 优先生效。
// scripts/check_web.py 会把仍在使用该兜底值的图片列为提醒，促使其补上真实描述。
#let image-alt-fallback = "插图"

#let frontmatter(..args) = {
  let fields = args.named()
  let banner = fields.at("banner", default: none)
  if banner != none {
    let _ = fields.remove("banner")
    html.div(class: "document-banner", style: "height:" + str(banner.at(1) / 1pt) + "pt", image(banner.at(0), alt: "原项目的山林主题横幅"))
  }
  let lines = ("---",)
  for (key, value) in fields.pairs() {
    let value = if type(value) == array { "[" + value.join(", ") + "]" } else { str(value) }
    lines.push(key + ": " + value)
  }
  lines.push("---")
  html.pre(class: "frontmatter", lines.join("\n"))
}

#let render(title: none, description: "Fernmind 中文文档主题，保留山林绿配色、霞鹜文楷与明暗两种阅读模式。", dark-mode: "auto", show-code-lang: true, equation-numbering: none, plain-image-alts: (), math-renderer: "native", font: ("LXGW WenKai", "Source Han Serif SC"), code-font: ("Cascadia Code", "LXGW WenKai"), doc) = {
  set text(lang: "zh")
  set document(title: if title == none { "Fernmind" } else { title }, description: description)
  set math.equation(numbering: equation-numbering)
  set quote(block: true)
  // 兜底替代文本：图片未写 alt 时也会输出 alt 属性，避免无替代文本的 <img>。
  set image(alt: image-alt-fallback)
  show heading: it => html.div(class: "heading-level-" + str(it.level), it)
  show heading.where(level: 6): it => html.div(class: "heading-level-6", html.h6(it.body))
  show outline: it => html.nav(class: "document-outline", aria-label: "文档目录", it)
  show raw.where(block: true): it => html.div(class: "code-block", {
    if show-code-lang { html.div(class: "code-language", if it.lang == none { "text" } else { it.lang }) }
    it
  })
  show math.equation.where(block: true): it => context html.div(class: "formula-card", {
    html.div(class: "equation-body", it)
    if it.numbering != none {
      html.span(class: "equation-number", numbering(it.numbering, ..counter(math.equation).at(it.location())))
    }
  })
  show image: it => html.span(class: if it.alt in plain-image-alts { "plain-image" } else { "framed-image" }, it)
  // 外链（http/https）在新标签页打开，并加 rel 防止 window.opener 被劫持。
  show link: it => {
    if type(it.dest) == str and (it.dest.starts-with("http://") or it.dest.starts-with("https://")) {
      html.a(href: it.dest, target: "_blank", rel: ("noopener", "noreferrer"), it.body)
    } else {
      it
    }
  }
  show footnote: it => context {
    let n = str(counter(footnote).at(it.location()).first())
    html.sup(html.a(href: "#fn-" + n, id: "fnref-" + n, aria-label: "脚注 " + n, n))
  }
  show table.cell: it => html.div(style: "text-align:" + if it.align == left + horizon { "left" } else if it.align == right + horizon { "right" } else { "center" }, it)
  show table: it => html.div(class: "table-scroll", tabindex: 0, role: "region", aria-label: "数据表格", it)
  show line: it => html.hr()
  show quote.where(block: true): it => {
    let kind = none
    for name in ("note", "tip", "important", "warning", "caution") {
      if it.attribution in (name, upper(name.slice(0, 1)) + name.slice(1), [#name]) { kind = name }
    }
    if kind != none {
      let names = (note: "ⓘ Note", tip: "♧ Tip", important: "◇ Important", warning: "⚠ Warning", caution: "⊗ Caution")
      html.aside(class: "admonition " + kind, {
        html.div(class: "admonition-title", names.at(kind))
        it.body
      })
    } else {
      // Typst 的 HTML 导出会把 attribution 放在 blockquote 之后的独立段落里，
      // 使署名与引文分家；这里自行构造，把署名收进引用框内部。
      html.elem("blockquote", {
        it.body
        if it.attribution != none { html.elem("footer", "— " + it.attribution) }
      })
    }
  }
  let css-fonts(value) = if type(value) == str { repr(value) } else { value.map(repr).join(",") }
  let page-title = if title == none { "Fernmind" } else { title + " · Fernmind" }
  // dark-mode: true/false 为作者指定的初始主题；"auto" 表示不预设，
  // 交给 <head> 里的内联脚本按 localStorage / 系统偏好决定（首屏不闪）。
  let theme-attr = if dark-mode == true { "dark" } else if dark-mode == false { "light" } else { none }
  let html-attrs = (lang: "zh-CN", "data-math": math-renderer, style: "--fm-body-font:" + css-fonts(font) + ";--fm-code-font:" + css-fonts(code-font))
  if theme-attr != none { html-attrs.insert("data-theme", theme-attr) }
  html.elem("html", attrs: html-attrs, {
    html.head({
      html.meta(charset: "utf-8")
      html.meta(name: "viewport", content: "width=device-width, initial-scale=1")
      html.meta(name: "color-scheme", content: "light dark")
      html.title(page-title)
      // 元信息：描述、社交卡片、浏览器地址栏配色。
      html.meta(name: "description", content: description)
      html.elem("meta", attrs: (property: "og:title", content: page-title))
      html.elem("meta", attrs: (property: "og:description", content: description))
      html.elem("meta", attrs: (property: "og:type", content: "article"))
      html.elem("meta", attrs: (property: "og:locale", content: "zh_CN"))
      html.elem("meta", attrs: (name: "twitter:card", content: "summary"))
      html.elem("meta", attrs: (name: "twitter:title", content: page-title))
      html.elem("meta", attrs: (name: "twitter:description", content: description))
      html.meta(name: "theme-color", content: "#f4f1e8", media: "(prefers-color-scheme: light)")
      html.meta(name: "theme-color", content: "#161d1a", media: "(prefers-color-scheme: dark)")
      html.link(rel: "icon", type: "image/svg+xml", href: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%234a7c59'/%3E%3Cpath d='M10 25V8h13v3H14v5h8v3h-8v6' fill='%23faf7ef'/%3E%3C/svg%3E")
      html.style(read("fernmind.css") + read("fonts.css"))
      // 首屏主题解析：优先 localStorage，其次作者预设的 data-theme，最后跟随系统。
      // 内联于 <head>、同步执行，因此首次绘制前 data-theme 已就位，不会闪白/闪黑。
      // __fmFollowSystem 标记"当前是跟随系统"，供 theme.js 在系统主题变化时实时切换。
      html.script("(function(){try{var e=document.documentElement,f=e.dataset.theme,s=localStorage.getItem('fernmind-theme'),x=(s==='light'||s==='dark'),m=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';e.dataset.theme=x?s:(f||m);window.__fmFollowSystem=!x&&!f}catch(_){}})();")
      if math-renderer == "mathjax" {
        // 加载期先隐藏原生公式，等 MathJax 把 <math> 全部换成 <mjx-container> 后再显示，
        // 避免"原生 MathML → SVG"两步渲染的闪动；定时器兜底，加载失败也不会永久藏住内容。
        // 注：MathJax v4 的 startup.promise / renderPromise 在本打包构建里不会 settle，
        //     故改用 MutationObserver 直接观察 DOM 完成度，不依赖其内部时序。
        html.script("(function(){var d=document.documentElement,g=document.getElementsByTagName.bind(document),done=false,mo=null;function reveal(){if(done)return;done=true;if(mo)mo.disconnect();d.dataset.mathState='ready'}window.__fmMathReveal=reveal;d.dataset.mathState='loading';if(window.MutationObserver){mo=new MutationObserver(function(){if(!g('math').length&&g('mjx-container').length)reveal()});mo.observe(d,{childList:true,subtree:true})}setTimeout(reveal,3000)})();")
      }
    })
    html.body({
      html.a(class: "skip-link", href: "#document", "跳到正文")
      html.header(class: "site-toolbar", {
        html.a(class: "wordmark", href: "#document", "🍃 Fernmind")
        // aria-pressed 的初始值只是占位，theme.js 会按实际生效的主题同步。
        html.button(type: "button", id: "theme-toggle", aria-label: "切换明暗主题", aria-pressed: dark-mode == true, {
          // 浅色模式显示月亮（点击切到深色），深色模式显示太阳。
          // 用两个图标 + CSS 按 data-theme 切换，JS 无需改动 DOM 内容。
          html.elem("svg", attrs: (class: "icon-moon", viewBox: "0 0 24 24", width: "18", height: "18", "aria-hidden": "true", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round"), {
            html.elem("path", attrs: (d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"))
          })
          html.elem("svg", attrs: (class: "icon-sun", viewBox: "0 0 24 24", width: "18", height: "18", "aria-hidden": "true", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round"), {
            html.elem("circle", attrs: (cx: "12", cy: "12", r: "4"))
            html.elem("path", attrs: (d: "M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"))
          })
        })
      })
      html.main(class: "paper", id: "document", {
        if title != none { html.h1(class: "document-title", title) }
        doc
        context {
          let notes = query(footnote)
          if notes.len() > 0 {
            html.elem("section", attrs: (role: "doc-endnotes", "aria-label": "脚注"), {
              html.hr()
              html.h2("注释")
              html.ol(for note in notes {
                let n = str(counter(footnote).at(note.location()).first())
                html.li(id: "fn-" + n, {
                  note.body
                  [ ]
                  html.elem("a", attrs: (href: "#fnref-" + n, role: "doc-backlink", "aria-label": "返回脚注 " + n), "返回正文")
                })
              })
            })
          }
        }
      })
      html.footer(class: "site-footer", {
        html.p("Fernmind / Lightmind · © 2026 Childish_tree · MIT")
        html.div(class: "footer-links", {
          html.a(href: "https://github.com/childishtree/fernmind", target: "_blank", rel: ("noopener", "noreferrer"), "原项目")
          html.a(href: "fernmind-web-source.zip", "下载网页项目")
        })
      })
      // 可选：用本地打包的 MathJax 把 Typst 导出的 MathML 重新排版为 SVG。
      // 配置脚本必须先于 MathJax 主脚本执行，故两者顺序固定。
      if math-renderer == "mathjax" {
        html.script("window.MathJax={svg:{fontCache:'global'},options:{enableMenu:false}};")
        html.elem("script", attrs: (src: "assets/vendor/mathjax/mml-svg.js", defer: ""))
      }
      html.script(read("theme.js"))
    })
  })
}
