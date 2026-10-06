(() => {
  const root = document.documentElement;
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : { matches: false };

  /* ---------------- 明暗主题 ---------------- */
  const toggle = document.getElementById('theme-toggle');
  // 实际生效的主题：显式 data-theme 优先，否则跟随系统偏好（dark-mode: "auto"）。
  const isDark = () => {
    const t = root.dataset.theme;
    if (t === 'dark') return true;
    if (t === 'light') return false;
    return mq.matches;
  };
  // 太阳/月亮图标由 CSS 依 [data-theme] 切换，这里只同步无障碍属性与提示。
  const syncToggle = () => {
    const dark = isDark();
    const label = dark ? '切换到浅色模式' : '切换到深色模式';
    toggle.setAttribute('aria-pressed', String(dark));
    toggle.setAttribute('aria-label', label);
    toggle.setAttribute('title', label);
  };
  if (toggle) {
    toggle.addEventListener('click', () => {
      // 点击写入显式主题，覆盖系统偏好并记住选择。
      root.dataset.theme = isDark() ? 'light' : 'dark';
      window.__fmFollowSystem = false;
      try { localStorage.setItem('fernmind-theme', root.dataset.theme); } catch (_) {}
      syncToggle();
    });
    // 仍处于"跟随系统"状态时，系统主题切换要实时生效并同步按钮状态。
    if (mq.addEventListener) mq.addEventListener('change', () => {
      if (window.__fmFollowSystem) root.dataset.theme = mq.matches ? 'dark' : 'light';
      syncToggle();
    });
    syncToggle();
  }

  /* ---------------- 标题锚点 ---------------- */
  // Typst 只在标题被目录/链接引用时才分配 id；未被引用的标题这里自行生成 slug，
  // 保证每节都有可复制的永久链接。ASCII 字母数字与 CJK 保留，其余字符转连字符。
  const slugify = (text) => {
    const s = text.trim().toLowerCase();
    let res = '';
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      const isWord = (c >= 48 && c <= 57) || (c >= 97 && c <= 122) || c >= 128;
      res += isWord ? s[i] : '-';
    }
    while (res.indexOf('--') >= 0) res = res.split('--').join('-');
    while (res.charAt(0) === '-') res = res.slice(1);
    while (res.slice(-1) === '-') res = res.slice(0, -1);
    return res;
  };
  const usedIds = {};
  document.querySelectorAll('.paper [id]').forEach((el) => { usedIds[el.id] = true; });
  let slugSeq = 0;
  document.querySelectorAll('.paper h2, .paper h3, .paper h4, .paper h5, .paper h6').forEach((heading) => {
    // 目录面板里的标题不需要锚点。
    if (heading.closest('.document-outline')) return;
    const host = (heading.parentElement && heading.parentElement.id) ? heading.parentElement : heading;
    let id = host.id;
    if (!id) {
      const base = slugify(heading.textContent) || 'section';
      id = base;
      while (usedIds[id]) { slugSeq += 1; id = base + '-' + slugSeq; }
      usedIds[id] = true;
      host.id = id;
    }
    const anchor = document.createElement('a');
    anchor.className = 'heading-anchor';
    anchor.href = '#' + id;
    anchor.setAttribute('aria-label', '本节链接');
    anchor.textContent = '#';
    heading.appendChild(anchor);
  });

  /* ---------------- 代码块复制 ---------------- */
  document.querySelectorAll('.code-block').forEach((block) => {
    const pre = block.querySelector('pre');
    if (!pre) return;
    // 没有语言标签栏时，代码贴着顶部，复制按钮会压住首行，需要留出空间。
    if (!block.querySelector('.code-language')) block.classList.add('code-block--bare');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-button';
    button.textContent = '复制';
    button.setAttribute('aria-label', '复制代码');
    let timer = 0;
    const flash = (text) => {
      button.textContent = text;
      button.classList.add('copied');
      clearTimeout(timer);
      timer = setTimeout(() => { button.textContent = '复制'; button.classList.remove('copied'); }, 1600);
    };
    // 剪贴板 API 不可用（旧浏览器/非安全上下文）时退回 execCommand。
    const fallback = (text) => {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
      document.body.removeChild(area);
      flash(ok ? '已复制' : '复制失败');
    };
    button.addEventListener('click', () => {
      const text = pre.innerText;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => flash('已复制'), () => fallback(text));
      } else {
        fallback(text);
      }
    });
    block.appendChild(button);
  });

  /* ---------------- 回到顶部 ---------------- */
  const toTop = document.createElement('button');
  toTop.type = 'button';
  toTop.id = 'back-to-top';
  toTop.textContent = '↑';
  toTop.setAttribute('aria-label', '回到顶部');
  toTop.setAttribute('title', '回到顶部');
  toTop.addEventListener('click', () => {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });
  const onScroll = () => { toTop.classList.toggle('visible', window.scrollY > 480); };
  window.addEventListener('scroll', onScroll, { passive: true });
  document.body.appendChild(toTop);
  onScroll();
})();
