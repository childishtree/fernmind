// 只编译一篇文章的 PDF，方便快速检查纸面排版。
// 用法：npm run article:pdf -- content/posts/welcome.typ
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const blogRoot = path.resolve(here, '..');
const repoRoot = path.resolve(process.env.FERNWIND_ROOT || path.join(blogRoot, '..'));
const compiler = process.env.TYPST_BIN || 'typst';

const file = process.argv[2];
if (!file) throw new Error('用法：npm run article:pdf -- content/posts/welcome.typ');

const target = path.resolve(blogRoot, file);
if (!target.startsWith(path.join(blogRoot, 'content') + path.sep)) {
  throw new Error('文章必须位于 blog/content/ 下。');
}
if (!fs.existsSync(target)) throw new Error(`找不到 ${file}`);

const args = ['compile', '--root', repoRoot];
const fontDir = path.join(blogRoot, 'content/fonts');
if (fs.existsSync(fontDir)) args.push('--font-path', fontDir);

const outputDir = path.join(blogRoot, 'output/pdf');
fs.mkdirSync(outputDir, { recursive: true });
const output = path.join(outputDir, path.basename(target, '.typ') + '.pdf');
args.push(target, output);

const { stderr } = await run(compiler, args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
if (stderr.trim()) process.stderr.write(stderr);
console.log(`已生成 ${path.relative(blogRoot, output)}`);
