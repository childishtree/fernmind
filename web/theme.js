(() => {
  const root = document.documentElement;
  const toggle = document.getElementById('theme-toggle');
  if (!toggle) return;
  // 太阳/月亮图标由 CSS 依 [data-theme] 切换，这里只同步无障碍属性与提示。
  const sync = () => {
    const dark = root.dataset.theme === 'dark';
    const label = dark ? '切换到浅色模式' : '切换到深色模式';
    toggle.setAttribute('aria-pressed', String(dark));
    toggle.setAttribute('aria-label', label);
    toggle.setAttribute('title', label);
  };
  toggle.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('fernmind-theme', root.dataset.theme); } catch (_) {}
    sync();
  });
  sync();
})();
