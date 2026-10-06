#import "../theme.typ": article, mark, task
#let post = json("math-and-tables.json")
#show: article.with(meta: post)

= 公式

行内公式直接写在 `$ $` 之间，比如质能方程 $E = m c^2$，或者用 $q_("ref") > 0$ 表示一个参考尺度。

行间公式单独成段，会自动居中并放进公式卡片：

$ sum_(i=1)^n i = frac(n (n + 1), 2) $

需要被引用的公式加上标签，正文里就能用 `@` 指过去。下面这个公式带编号，并会在后文被引用：

$ integral_0^infinity e^(-x^2) dif x = frac(sqrt(pi), 2) $ <gauss>

矩阵和分段函数同样是一行写完：

$ A = mat(1, 2; 3, 4), quad det(A) = -2 $

由 @gauss 可以得到高斯积分的结果；把它代入 $sigma$ 的归一化条件，就能确定系数。

#quote(attribution: "note")[这篇文章在 JSON 里把 `mathRenderer` 设为 `mathjax`，公式会用本地打包的 MathJax 重新排版成 SVG；其余文章仍使用浏览器原生的 MathML。两种方式的取舍见文末。]

== 两种公式渲染方式

#table(
  columns: (1fr, 1.4fr, 1.4fr),
  table.header([], [native（默认）], [mathjax]),
  [依赖], [浏览器原生支持], [本地打包，约 1 MB],
  [首屏], [无需额外加载], [加载期先隐藏，避免闪动],
  [字形一致性], [各浏览器略有差异], [各处一致],
)

两种方式都在正文里保留 MathML，搜索引擎和无障碍工具都能读到公式本身。

= 表格

窄表直接写，宽度不够时由排版决定：

#table(
  columns: (auto, 1fr, auto),
  table.header([符号], [含义], [单位]),
  [$q$], [被比较的物理量], [—],
  [$q_("ref")$], [人为选定的参考尺度], [—],
  [$epsilon$], [相对差异], [—],
)

列多、内容长时，表格外层会出现横向滚动区域，不会把正文撑破：

#table(
  columns: (1fr, 1fr, 1fr, 1fr, 1fr, 1fr),
  table.header(
    [时间步], [步长], [迭代次数], [残差], [壁面 $y^+$], [备注],
  ),
  [0], [1.0e-4], [12], [3.2e-3], [—], [初始化],
  [1], [1.0e-4], [48], [7.1e-4], [12.4], [开始收敛],
  [2], [5.0e-5], [96], [1.8e-4], [9.7], [加密时间步],
  [3], [5.0e-5], [210], [4.3e-6], [8.9], [残差达标],
)

== 表格适合放什么

适合放「同一组字段在多个对象上的取值」，不适合放需要解释的推导过程。后者更适合写成正文，再配一张表做汇总。

= 代码

带语言的代码块会显示语言标签，右上角提供复制按钮：

```python
import numpy as np

def relative_difference(q1, q2, ref):
    """按参考尺度归一化后的相对差异。"""
    return abs(q2 - q1) / max(abs(q1), abs(ref))
```

没有标注语言的代码块也能正常显示，只是不显示语言栏：

```text
my-note.typ
my-note.json
```

Typst 自身也是一等公民：

```typst
$ epsilon = frac(abs(q_2 - q_1), max(abs(q_1), q_("ref"))) $
```

= 收尾

把符号定义、单位、判断依据写在一起，比只留下最后一张图有用得多。

#task(checked: true)[公式、表格、代码块都确认过网页与 PDF 两种排版]
#task(checked: false)[补一份完整的参数表]
