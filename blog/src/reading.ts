// 网页阅读视图的正文增强：标题锚点与代码块复制。
//
// Fernmind 的 web/theme.js 面向「整页独立阅读」，作用域是 .paper；博客里正文被
// 嵌进 .fernmind-content，所以这里做一份同样逻辑的适配。回到顶部由
// animal-island-ui 的 BackTop 提供，不在正文里重复实现。

const slugify = (text: string): string => {
  const source = text.trim().toLowerCase();
  let result = '';
  for (let i = 0; i < source.length; i += 1) {
    const code = source.charCodeAt(i);
    // ASCII 字母数字与 CJK 保留，其余字符转连字符。
    const isWord = (code >= 48 && code <= 57) || (code >= 97 && code <= 122) || code >= 128;
    result += isWord ? source[i] : '-';
  }
  while (result.includes('--')) result = result.split('--').join('-');
  return result.replace(/^-+/, '').replace(/-+$/, '');
};

const copyText = async (text: string): Promise<boolean> => {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 非安全上下文等情况，落到下面的兜底方案。
    }
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(area);
  return ok;
};

/** 就地增强 root 内的正文，返回一个撤销全部改动的清理函数。 */
export function enhanceReading(root: HTMLElement | null): () => void {
  if (!root) return () => {};

  const anchors: HTMLAnchorElement[] = [];
  const buttons: HTMLButtonElement[] = [];
  const bareBlocks: HTMLElement[] = [];
  const generatedIds: Array<[HTMLElement, string]> = [];
  const timers = new Set<number>();

  const used = new Set<string>();
  root.querySelectorAll<HTMLElement>('[id]').forEach((element) => used.add(element.id));

  /* ---------------- 标题锚点 ---------------- */
  // Typst 只在标题被目录或链接引用时才分配 id；其余标题这里自行生成 slug，
  // 保证每一节都有可复制的永久链接。
  root.querySelectorAll<HTMLElement>('h2, h3, h4, h5, h6').forEach((heading) => {
    if (heading.closest('.document-outline')) return;
    // Typst 把 id 放在包裹标题的 .heading-level-N 上，而不是 h2 本身。
    const host = heading.parentElement?.id ? heading.parentElement : heading;
    let id = host.id;
    if (!id) {
      const base = slugify(heading.textContent || '') || 'section';
      id = base;
      let suffix = 1;
      while (used.has(id)) id = `${base}-${suffix++}`;
      used.add(id);
      host.id = id;
      generatedIds.push([host, id]);
    }
    const anchor = document.createElement('a');
    anchor.className = 'heading-anchor';
    anchor.href = `#${id}`;
    anchor.setAttribute('aria-label', '本节链接');
    anchor.textContent = '#';
    heading.appendChild(anchor);
    anchors.push(anchor);
  });

  /* ---------------- 代码块复制 ---------------- */
  root.querySelectorAll<HTMLElement>('.code-block').forEach((block) => {
    const pre = block.querySelector('pre');
    if (!pre) return;
    // 没有语言标签栏时代码贴着顶部，复制按钮会压住首行，需要额外留白。
    if (!block.querySelector('.code-language')) {
      block.classList.add('code-block--bare');
      bareBlocks.push(block);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-button';
    button.textContent = '复制';
    button.setAttribute('aria-label', '复制代码');
    button.addEventListener('click', async () => {
      const ok = await copyText(pre.innerText);
      button.textContent = ok ? '已复制' : '复制失败';
      button.classList.toggle('copied', ok);
      const timer = window.setTimeout(() => {
        button.textContent = '复制';
        button.classList.remove('copied');
        timers.delete(timer);
      }, 1600);
      timers.add(timer);
    });
    block.appendChild(button);
    buttons.push(button);
  });

  return () => {
    anchors.forEach((anchor) => anchor.remove());
    buttons.forEach((button) => button.remove());
    bareBlocks.forEach((block) => block.classList.remove('code-block--bare'));
    generatedIds.forEach(([element, id]) => {
      if (element.id === id) element.removeAttribute('id');
    });
    timers.forEach((timer) => window.clearTimeout(timer));
  };
}
