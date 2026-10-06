(() => {
  const root = document.documentElement;
  const toggle = document.getElementById('theme-toggle');
  if (!toggle) return;
  const sync = () => {
    const dark = root.dataset.theme === 'dark';
    toggle.textContent = dark ? '浅色模式' : '深色模式';
    toggle.setAttribute('aria-pressed', String(dark));
    toggle.setAttribute('aria-label', dark ? '切换到浅色模式' : '切换到深色模式');
  };
  toggle.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('fernmind-theme', root.dataset.theme); } catch (_) {}
    sync();
  });
  sync();
})();
