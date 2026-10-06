import { renderToString } from 'react-dom/server';
import postsData from './posts.json';
import App from './App';
import { site } from './site';

export { site, topics } from './site';

/** 构建时把同一条 React 路由渲染成 HTML 字符串，交给 scripts/routes.mjs 写入 dist。 */
export function renderPage(pathname: string, search = ''): string {
  return renderToString(<App pathname={pathname} search={search} />);
}

export type RouteMeta = {
  path: string;
  title: string;
  description: string;
  /** 文章声明的公式渲染方式；非文章页为 undefined。 */
  math?: 'native' | 'mathjax';
};

/**
 * posts.json 里的 math 是普通字符串。用带返回类型的函数收窄，而不是写三元表达式：
 * 三元里的字符串字面量在数组展开这种没有上下文类型的位置会被拓宽成 string。
 */
function mathRenderer(value: string): 'native' | 'mathjax' {
  return value === 'mathjax' ? 'mathjax' : 'native';
}

/**
 * 需要预渲染的路由及其 <title> / <meta name="description">。
 * 文案全部取自 src/site.ts 与文章元数据，避免与页面内容脱节。
 */
export function buildRoutes(): { pages: RouteMeta[]; notFound: RouteMeta } {
  return {
    pages: [
      { path: '', title: site.eyebrow, description: site.description },
      { path: 'archive', title: site.archive.title, description: site.archive.lead },
      { path: 'about', title: site.about.title, description: site.about.lead.replace(/\n/g, '') },
      ...postsData.map((post) => ({
        path: `posts/${post.slug}`,
        title: post.title,
        description: post.excerpt,
        math: mathRenderer(post.math),
      })),
    ],
    notFound: { path: '404', title: site.missing.title, description: site.missing.body },
  };
}
