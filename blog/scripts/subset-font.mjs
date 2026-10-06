// 构建期把霞鹜文楷裁剪成「只含站点实际用到的字」的子集。
//
// 为什么要做：web/fonts/LXGWWenKai-Regular.woff 是 12.7 MB 的全量字体，而
// web/fonts.css 里那条带 unicode-range 的 -Text 子集只覆盖 507 个码位；正文里
// 只要出现一个子集之外的字，浏览器就得把 12.7 MB 全量拉下来（实测单个文章页
// 下载 12.75 MB）。这里按实际用字生成子集，通常只有一百多 KB。
//
// 许可：霞鹜文楷采用 SIL OFL 1.1，其版权行含一条 ADDITIONAL PERMISSION，
// 明确允许「为网页字体分发而做子集化或转格式（如 WOFF/WOFF2）」并继续使用
// 保留字体名，前提是不作为可安装的桌面字体分发。本子集只随站点作为网页字体
// 提供，符合该许可。详见 web/fonts/OFL-WenKai.txt。
import fs from 'node:fs';
import subsetFont from 'subset-font';

/** 把一批字符压缩成 CSS unicode-range 的区间写法。 */
export function toUnicodeRange(text) {
  const points = [...new Set([...text].map((ch) => ch.codePointAt(0)))].sort((a, b) => a - b);
  const ranges = [];
  for (const point of points) {
    const last = ranges[ranges.length - 1];
    if (last && point === last[1] + 1) last[1] = point;
    else ranges.push([point, point]);
  }
  // CSS 的 <urange> 只在区间开头写一次 U+：U+20-7E，写成 U+20-U+7E 是无效值，
  // 浏览器会丢掉整条 unicode-range，子集字体就会声称覆盖全部码位——缺字反而
  // 变成豆腐块，而不是回退到后备字体。
  const hex = (value) => value.toString(16).toUpperCase();
  return ranges.map(([from, to]) => (from === to ? `U+${hex(from)}` : `U+${hex(from)}-${hex(to)}`)).join(',');
}

/**
 * toUnicodeRange 的逆运算：把 CSS unicode-range 还原成码位集合。
 *
 * 用来校验写进样式表的区间确实无损地表达了请求的字符集——区间合并的边界
 * （差一、漏并）出错时，只比对字符串看不出来，展开成集合才比得出来。
 * 解析不了就抛错而不是静默跳过：被悄悄丢掉的片段正是要抓的东西。
 */
export function parseUnicodeRange(range) {
  const points = new Set();
  for (const part of range.split(',')) {
    const [from, to, ...rest] = part.trim().replace(/^U\+/i, '').split('-');
    const start = Number.parseInt(from, 16);
    const end = to === undefined ? start : Number.parseInt(to, 16);
    if (rest.length || !Number.isInteger(start) || !Number.isInteger(end)) {
      throw new Error(`无法解析的 unicode-range 片段「${part.trim()}」（区间只在开头写一次 U+）。`);
    }
    for (let point = start; point <= end; point += 1) points.add(point);
  }
  return points;
}

/**
 * 读取 SFNT（TrueType/OpenType）字体的 cmap，返回它真正含有字形的码位集合。
 *
 * 为什么需要：harfbuzz 的子集器对「字体里没有这个字」是静默跳过的，只看
 * 「请求了什么」无法发现漏字，必须回过头问字体「你到底给出了什么」。
 * 取 sfnt 而不是 woff2 是为了省掉 Brotli 解压，直接用 DataView 读表。
 */
export function readCmap(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const tables = view.getUint16(4);
  let cmap = 0;
  for (let i = 0; i < tables; i += 1) {
    const record = 12 + i * 16;
    if (view.getUint32(record) === 0x636d6170) cmap = view.getUint32(record + 8);
  }
  if (!cmap) throw new Error('字体缺少 cmap 表，无法核对字形覆盖。');

  const encodings = view.getUint16(cmap + 2);
  const subtables = [];
  for (let i = 0; i < encodings; i += 1) {
    const record = cmap + 4 + i * 8;
    subtables.push({
      platform: view.getUint16(record),
      offset: cmap + view.getUint32(record + 4),
    });
  }
  // format 12 覆盖整个 Unicode（含 BMP 之外），format 4 只覆盖 BMP。
  // 优先 Windows 平台的 Unicode 全量映射，其次任意 format 12，再退回 format 4。
  const formatOf = (subtable) => view.getUint16(subtable.offset);
  const chosen =
    subtables.find((s) => formatOf(s) === 12 && s.platform === 3) ||
    subtables.find((s) => formatOf(s) === 12) ||
    subtables.find((s) => formatOf(s) === 4 && s.platform === 3) ||
    subtables.find((s) => formatOf(s) === 4);
  if (!chosen) throw new Error('字体的 cmap 里没有 format 4 或 format 12 子表。');

  const covered = new Set();
  if (formatOf(chosen) === 12) {
    const groups = view.getUint32(chosen.offset + 12);
    for (let g = 0; g < groups; g += 1) {
      const group = chosen.offset + 16 + g * 12;
      const first = view.getUint32(group);
      const last = view.getUint32(group + 4);
      const glyph = view.getUint32(group + 8);
      for (let point = first; point <= last; point += 1) {
        // 字形 0 是 .notdef，等同于「没有这个字」。
        if (glyph + (point - first) !== 0) covered.add(point);
      }
    }
    return covered;
  }

  const segments = view.getUint16(chosen.offset + 6) / 2;
  const ends = chosen.offset + 14;
  const starts = ends + segments * 2 + 2; // 中间隔一个 reservedPad
  const deltas = starts + segments * 2;
  const offsets = deltas + segments * 2;
  for (let s = 0; s < segments; s += 1) {
    const last = view.getUint16(ends + s * 2);
    const first = view.getUint16(starts + s * 2);
    if (first === 0xffff) continue; // 末段是 0xFFFF 的哨兵段
    const delta = view.getInt16(deltas + s * 2);
    const rangeOffset = view.getUint16(offsets + s * 2);
    for (let point = first; point <= last; point += 1) {
      let glyph;
      if (rangeOffset === 0) {
        glyph = (point + delta) & 0xffff;
      } else {
        const index = offsets + s * 2 + rangeOffset + (point - first) * 2;
        glyph = index + 2 <= buffer.length ? view.getUint16(index) : 0;
        if (glyph !== 0) glyph = (glyph + delta) & 0xffff;
      }
      if (glyph !== 0) covered.add(point);
    }
  }
  return covered;
}

/**
 * 生成字体子集。
 * @returns {Promise<{ bytes: number, characters: number, unicodeRange: string, requested: Set<number>, covered: Set<number> }>}
 *   requested 是请求裁剪的码位，covered 是产物里真有字形的码位，两者之差即字体缺字。
 *   unicodeRange 只描述 covered，不描述 requested。
 */
export async function buildSubset({ source, output, text }) {
  const characters = [...new Set(text)].sort();
  const request = characters.join('');
  const original = fs.readFileSync(source);

  const subset = await subsetFont(original, request, { targetFormat: 'woff2' });
  fs.mkdirSync(output.replace(/[\\/][^\\/]+$/, ''), { recursive: true });
  fs.writeFileSync(output, subset);

  // 再裁一份未压缩的 sfnt 用于核对字形覆盖。多花约 0.6 秒，换掉「静默漏字」这类
  // 只有到浏览器里才会显形的问题。
  const covered = readCmap(await subsetFont(original, request, { targetFormat: 'sfnt' }));

  // unicode-range 按「真有字形的码位」声明，而不是按请求的码位。
  // 两者之差是字体缺的字（emoji、数学斜体字母、控制字符等）。若把它们也声明进来，
  // 浏览器会认为本字体覆盖这些码位、选中它、然后画出 .notdef（豆腐块）；
  // 不声明才会继续往后找后备字体。
  const declared = [...covered]
    .sort((a, b) => a - b)
    .map((point) => String.fromCodePoint(point))
    .join('');

  return {
    bytes: subset.length,
    characters: characters.length,
    unicodeRange: toUnicodeRange(declared),
    requested: new Set(characters.map((character) => character.codePointAt(0))),
    covered,
  };
}
