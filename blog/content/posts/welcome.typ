#import "../theme.typ": article, mark, kbd, task
#let post = json("welcome.json")
#show: article.with(meta: post)

= 一套源文件，三种阅读方式

这个博客的每一篇文章都是一份普通的 Typst 源文件。构建时，同一份源文件会被导出三次，分别服务于不同的阅读场景：

- *网页正文* 由 Typst 的原生 HTML 导出生成，文字可以选中复制，公式是浏览器原生的 MathML，目录和脚注是普通锚点；
- *原版页面* 把文档导出为逐页 SVG，完整保留 Typst 的纸面版式，包括分页位置和固定行宽；
- *PDF* 与源文件一起提供下载，适合存档、打印或转发。

三种产物来自同一份文字，所以不会出现「网页和 PDF 说法不一致」的情况。改一处，三处一起更新。

== 为什么不用 Markdown

Markdown 的问题不在写作，而在表达的上限。一旦需要带编号的公式、跨页的表格、精确的图文位置，就得引入各种扩展语法，最终每种渲染器认得的子集都不一样。

Typst 本身就是一套完整的排版语言。写起来接近 Markdown 的手感，但需要精确控制时随时可以往下走一层：

```typst
= 一个标题
正文里的 *强调* 与 #mark[高亮]。

$ E = m c^2 $          // 行间公式
$ a^2 + b^2 = c^2 $ <pyth>   // 带标签，方便引用
```

== 三种阅读方式怎么选

#table(
  columns: (1fr, 2fr),
  table.header([场景], [建议]),
  [快速浏览、复制文字、搜索关键词], [网页正文],
  [确认原始版式、核对分页与图表位置], [原版页面],
  [离线保存、打印、发给别人], [PDF],
)

阅读页顶部的切换按钮可以在前两者之间来回切，缩放在 75% 到 250% 之间调整。

= 排版组件开箱可用

Fernmind 的公开命令可以直接用在正文里，不需要额外引入。

== 强调与标记

普通强调用 `*粗体*` 和 `_斜体_`；需要标出判断依据时用 #mark[高亮]，它会在纸面上留下一道底色。表示按键用 #kbd[Ctrl] + #kbd[P]。

== 引用与提示框

一般的引用直接写：

#quote(block: true)[先把今天的思考放下来，允许明天的自己继续补充。]

需要区分轻重时，给引用加上 attribution 就会变成提示框：

#quote(attribution: "tip")[把长文拆成几节，每节只回答一个问题，读起来会轻松很多。]

#quote(attribution: "warning")[Typst 的 HTML 导出仍是实验特性，建议在项目里固定编译器版本。]

== 待办与脚注

#task(checked: true)[确认文章能编译出网页、PDF 和 SVG 三种产物]
#task(checked: false)[补一张自己的配图]

脚注用来放补充说明#footnote[脚注会出现在正文末尾，并与正文中的编号互相跳转。]，正文因此可以保持干净。

= 图片

图片可以用文件引用，构建时会随文章一起发布：

#figure(
  image("/cover.png", width: 78%, alt: "Fernmind 主题的封面图，山林绿配色。"),
  caption: [仓库根目录的 cover.png，构建时被复制到文章的资源目录。],
)

也可以直接内嵌 base64，构建脚本会把它还原成独立文件，避免正文体积失控。

= 新增一篇文章

在 `content/posts/` 下放两个同名文件即可：

```text
my-note.typ
my-note.json
```

JSON 里写元数据：

```json
{
  "title": "我的第一篇手记",
  "slug": "my-note",
  "date": "2026-10-06",
  "category": "Typst 排版",
  "tags": ["Typst", "笔记"],
  "excerpt": "用一两句话说明这篇文章解决了什么问题。"
}
```

`.typ` 里三行起手：

```typst
#import "../theme.typ": article
#let post = json("my-note.json")
#show: article.with(meta: post)
```

标题、摘要、初始主题、公式渲染方式都从 JSON 读取，正文里不必重复。改完重新构建，站点就会多出一篇文章。

进一步阅读：#link("https://typst.app/docs/")[Typst 官方文档]。
