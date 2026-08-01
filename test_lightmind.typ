#import "lightmind.typ": frontmatter, lightmind, mark, tablem,kbd,task

// ============================================================================
// lightmind.typ 完整功能测试
// 改编自 LightMindTheme/showcase/showcase-zh.md
// 覆盖：frontmatter、目录、标题层级、段落与行内格式、引用块与警告块、
//       列表（无序/有序/任务）、表格、代码、数学公式、分隔线、图片、脚注、高亮
// ============================================================================



#show: doc => lightmind(
  title: "Lightmind 主题功能测试",
  allow-page-breaks: false,
  // dark-mode: true,
  doc,
)

// ---------- 前置元信息 ----------
#frontmatter(
  title: "Lightmind 主题演示",
  author: "SunMoonTrain",
  date: "2026-05-06",
  tags: ("theme", "markdown", "demo"),
  banner: ("cover.png", 150pt),
)

// ---------- 目录 ----------
#outline(title: "目录")

= 引言

一个山林森林绿调、霞骛文楷正文、等宽代码的 Typst 主题。

灵感来源于山间日落与森林边缘的温暖留白——主色取自远山的绿，配色用米黄纸面承托文字，代码块沉入深海军蓝。本文档系统地展示主题在各种 Typst 语法下的表现，可作功能验证，也作设计样张。

= 标题层级

== 二级标题（H2）：深绿细线

=== 三级标题（H3）：左侧色条点缀

==== 四级标题（H4）

===== 五级标题（H5）

====== 六级标题（H6）

各级标题应当层次清晰，但不会过分突兀。`= 标题层级` 即一级标题（H1，双线），H2 单线、H3 左侧绿色色条、H4–H6 渐弱。

= 段落与行内格式

这是一个普通段落。*这是粗体（深森林绿）*，_这是斜体_，_*这是粗斜体*_，#strike[这是删除线]，#underline[这是下划线]。

行内代码：`const greeting = "Hello, world"`；行内数学：$E = m c^2$；行内键位：#kbd[Ctrl] + #kbd[Shift] + #kbd[P]。

#highlight[这是高亮文本]，可以混合 #highlight[_斜体高亮_]。H#sub[2]O 是水的化学式，E = mc#super[2] 是质能方程。

[这是一个链接](https://typora.io)，链接里的 `代码`，邮箱 #link("mailto:noreply@example.com")[noreply\@example.com]。

= 引用块与警告块

#quote[
  一行普通引用。中间留 4px 山林绿左色条，米雾绿底色，圆角矩形包裹。
  #quote[嵌套引用，色调更柔和。]
  引用里也可以放 *粗体*、_斜体_ 和 `代码`。
]

#quote(attribution: "note")[
  蓝色调。用于补充说明、温馨提示。
]

#quote(attribution: "tip")[
  主色绿。用于实用建议、最佳实践。
]

#quote(attribution: "important")[
  紫色调。用于关键信息，不容忽视。
]

#quote(attribution: "warning")[
  暖橙黄。需要注意，可能影响结果。
]

#quote(attribution: "caution")[
  砖红调。危险操作或破坏性变更。
]

= 列表

== 无序列表

- 第一项
- 第二项
  - 嵌套：空心 marker
  - 嵌套二
    - 三层嵌套
- 第三项

== 有序列表

1. 准备食材
2. 加热油锅
  1. 倒油
  2. 等待至七成热
3. 下锅翻炒

== 任务列表

#task(checked: true)[写主题大纲]
#task(checked: true)[实现配色变量]
#task(checked: true)[写完代码块语法高亮]
#task(checked: false)[跨平台测试]
#task(checked: false)[上传到主题仓库]

= 表格

== 基本表格

#table(
  columns: 4,
  [OS], [全球占比], [中国占比], [备注],
  [Windows], [76.56], [87.55], [--],
  [macOS], [17.10], [5.44], [--],
  [Linux], [1.93], [0.75], [--],
  [Chrome OS], [1.72], [0.01], [--],
)

== 对齐方式

#table(
  columns: 3,
  align: (x, y) => if x == 0 {
    left + horizon
  } else if x == 1 {
    center + horizon
  } else {
    right + horizon
  },
  [左对齐], [居中], [右对齐],
  [Apple], [苹果], [1.0],
  [Banana], [香蕉], [2.5],
  [Cherry], [樱桃], [18.7],
)

== 单元格里的复杂内容

#table(
  columns: 3,
  [名称], [描述], [状态],
  [*粗体名称*], [含 `行内代码` 和 _斜体_], [#sym.checkmark 正常],
  [长名称示例], [一段较长的描述文字，看看换行表现], [⚠ 警告],
  [第三行], [#link("https://example.com")[带链接的]单元格], [#sym.crossmark 失败],
)

= 代码

== 行内代码

下载 `npm install` 后运行 `npm run dev`，访问 `http://localhost:3000`。

== 代码块（多语言）

语法高亮颜色借鉴了 One Dark 主题。

```rust
// Rust
fn main() {
    let s = String::from("hello");
    let len = calculate_length(&s);
    println!("'{}' has length {}", s, len);
}

fn calculate_length(s: &String) -> usize {
    s.len()
}
```

```csharp
// C#
using System.Threading.Tasks;

[Serializable]
public class UserService<T> where T : class, new()
{
    public const int MaxRetries = 3;

    /// <summary>异步获取用户</summary>
    public async Task<T?> GetAsync(int id, string token = "")
    {
        if (id <= 0) throw new ArgumentException(nameof(id));
        var url = $"/api/users/{id:X}?t={token}";
        return await _http.GetFromJsonAsync<T>(url);
    }
}
```

```typescript
// TypeScript
import { Injectable } from '@nestjs/common';
import type { AuthToken } from './types';

/** 用户认证服务 */
@Injectable()
export class AuthService {
    public static readonly MAX_ATTEMPTS = 5;
    private cache = new Map<string, AuthToken>();

    async login(email: string, pwd: string): Promise<AuthToken | null> {
        if (!email.includes('@') || pwd.length < 8)
            throw new Error(`Invalid: ${email}`);
        return { token: 'abc', expiresIn: 3600, valid: true };
    }
}
```

= 数学公式

== 行内公式

欧拉公式 $e^(i pi) + 1 = 0$，毕达哥拉斯定理 $a^2 + b^2 = c^2$，导数 $f'(x) = lim_(h -> 0) (f(x+h) - f(x)) / h$。

== 行间公式（圆角米色卡片）

$ m = lim_(h -> 0) (f(a + h) - f(a)) / h =: f'(a) $

$
  integral.double_(x^2 + y^2 <= R^2) f(x, y) dif x dif y = integral_(theta = 0)^(2 pi) dif theta integral_(r = 0)^R f(r cos theta, r sin theta) r dif r
$

$ forall delta > 0, exists N in ZZ^+, text(s.t.) forall n > N, |a_n - l| < delta $

矩阵：

$
  A = mat(
    a_(1 1), a_(1 2), dots.h, a_(1 n);
    a_(2 1), a_(2 2), dots.h, a_(2 n);
    dots.v, dots.v, dots.down, dots.v;
    a_(m 1), a_(m 2), dots.h, a_(m n),
  )
$

= 分隔线

分隔线是柔和绿色。

#line(length: 100%)

= 图片

左对齐的图片：

#image("lightmind-light.png", width: 40%)

居中独立图片：

#figure(
  image("lightmind-dark.png", width: 60%),
  caption: [暗色主题预览],
)

= 脚注

霞骛文楷#footnote[LXGW WenKai，由 lxgw 维护的开源中文字体，基于霞鹜新晰黑改造。] 与等宽字体#footnote[JetBrains Mono，由 JetBrains 设计的等宽编程字体，支持连字。] 的搭配是这个主题的核心。

= 文本高亮

这是 #highlight[文本高亮]。

这是一段正常的文字，然后是一个包含中英文混排的 #mark[高亮 Highlight 测试] 文本，背景不会断层，且前后也不会与周围的文字发生重叠。

= 其他（tablem 演示）

类markdown 表格语法：

#tablem()[
  |1|2|3|
  |4|5|6|
  |7|8|9|
]

= 结束语

如果以上各部分都呈现得自然协调——

- 段落的呼吸节奏不卡顿
- 代码块深色不刺眼
- 公式圆角米色卡片融入页面
- 表格内外框层次分明
- 配色与正文呼应

那么这个主题已经基本可用了。

#quote(attribution: [Childish_tree])[Made with `lightmind.typ` · 山林之间，文字生长。]
