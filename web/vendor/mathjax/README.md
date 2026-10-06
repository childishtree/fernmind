# MathJax(可选数学公式渲染器)

- **组件**:`mml-svg.js`(MathML 输入 → SVG 输出,官方完整打包版,未做修改)
- **版本**:4.1.3
- **来源**:<https://www.npmjs.com/package/mathjax>(<https://cdn.jsdelivr.net/npm/mathjax@4/mml-svg.js>)
- **许可**:Apache-2.0,全文见同目录 `LICENSE`

## 用途

Fernmind 网页版的可选功能。默认公式使用 Typst 导出的原生 MathML 渲染;
当在文档中设置 `math-renderer: "mathjax"` 时,页面会加载本目录下的
`mml-svg.js`,由 MathJax 把 `<math>…</math>` 重新排版为 SVG,从而在不同
浏览器间获得一致、清晰的公式外观,且不依赖访问者系统安装的数学字体。

组件随站点本地提供,不请求任何外部 CDN。SVG 输出内嵌字形路径
(`fontCache: "global"`),无需额外下载字体文件。

## 更新方式

```sh
curl -sL -o web/vendor/mathjax/mml-svg.js https://cdn.jsdelivr.net/npm/mathjax@4/mml-svg.js
curl -sL -o web/vendor/mathjax/LICENSE      https://cdn.jsdelivr.net/npm/mathjax@4/LICENSE
```

升级后请同步更新上方的版本号,并重新构建验证。
