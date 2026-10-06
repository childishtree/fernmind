// 按需加载本地打包的 MathJax，把正文里的原生 MathML 重新排版成 SVG。
//
// 与独立页面（web/theme.typ 里的内联脚本）保持同一套约定：
//   data-math="mathjax" + data-math-state="loading" 时隐藏原生公式，
//   避免「原生 MathML → SVG」两步渲染的闪动；
//   排版完成后置为 "ready"；定时器兜底，加载失败也不会永久藏住内容。
//
// 这些属性挂在 <html> 上而不是正文容器上，因为生成的文章样式里
// [data-math="mathjax"][data-math-state="loading"] .fernmind-content math
// 就是按这个层级写的。

const BUNDLE = '/fernmind/assets/vendor/mathjax/mml-svg.js';
const REVEAL_TIMEOUT = 3000;

/** MathJax 主脚本暴露的全局对象。 */
type MathJaxGlobal = {
  typesetPromise?: (elements?: Element[]) => Promise<void>;
};

/** 插入主脚本之前需要先写好的配置。 */
type MathJaxConfig = {
  svg?: { fontCache?: string };
  options?: { enableMenu?: boolean };
};

type MathJaxWindow = { MathJax?: MathJaxGlobal & MathJaxConfig };

let loading: Promise<void> | null = null;

function loadBundle(): Promise<void> {
  const globalWindow = window as unknown as MathJaxWindow;
  // 配置必须先于主脚本写入，故在插入 <script> 之前设置。
  globalWindow.MathJax = {
    ...globalWindow.MathJax,
    svg: { fontCache: 'global' },
    options: { enableMenu: false },
  };
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = BUNDLE;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`无法加载 ${BUNDLE}`));
    document.head.appendChild(script);
  });
}

/**
 * 让 root 下的公式改用 MathJax 排版。
 * 返回清理函数，会把 <html> 上的属性还原，便于切换到别的文章。
 */
export function typesetMath(root: HTMLElement): () => void {
  root.dataset.math = 'mathjax';
  root.dataset.mathState = 'loading';

  let done = false;
  const reveal = () => {
    if (done) return;
    done = true;
    root.dataset.mathState = 'ready';
  };
  const timer = window.setTimeout(reveal, REVEAL_TIMEOUT);

  loading = loading ?? loadBundle();
  loading
    .then(async () => {
      const mathJax = (window as unknown as MathJaxWindow).MathJax;
      await mathJax?.typesetPromise?.();
      reveal();
    })
    .catch(reveal);

  return () => {
    window.clearTimeout(timer);
    done = true;
    if (root.dataset.math === 'mathjax') {
      root.dataset.math = 'native';
      delete root.dataset.mathState;
    }
  };
}
