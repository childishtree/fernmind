// 调用 scripts/check-site.py 校验构建产物。
// 用异步 execFile 而不是 spawnSync：某些环境（例如注入了 shim 的宿主）会
// 让 spawnSync 无法创建子进程。
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const python = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');

try {
  const { stdout, stderr } = await run(python, ['scripts/check-site.py'], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
} catch (error) {
  if (error.stdout) process.stdout.write(error.stdout);
  if (error.stderr) process.stderr.write(error.stderr);
  if (error.code === 'ENOENT') {
    console.error(`找不到 ${python}，请安装 Python 3.9+ 或设置 PYTHON_BIN。`);
    process.exitCode = 1;
  } else {
    process.exitCode = typeof error.code === 'number' ? error.code : 1;
  }
}
