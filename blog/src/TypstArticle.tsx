import { useEffect, useRef, useState } from 'react';
import { Button, Card, Tag } from 'animal-island-ui';
import {
  BookIcon,
  CalendarIcon,
  ClockIcon,
  CodeIcon,
  DownloadIcon,
  LeafIcon,
  MinusIcon,
  PlusIcon,
} from 'naive-icons';
import type { Post } from './App';
import { enhanceReading } from './reading';
import { typesetMath } from './mathjax';

type Props = {
  post: Post;
  next: Post;
  color: 'app-teal' | 'app-orange' | 'app-green';
};

export default function TypstArticle({ post, next, color }: Props) {
  const [zoom, setZoom] = useState(100);
  // 有网页正文时默认网页阅读；只支持纸面排版的文章（web: false）直接展示原版页面。
  const [view, setView] = useState<'web' | 'pages'>(post.html ? 'web' : 'pages');
  const [pendingHeading, setPendingHeading] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // 在原版页面里点目录时，先切回网页阅读，等它渲染完再滚动到目标小节。
  useEffect(() => {
    if (!pendingHeading) return;
    document.getElementById(pendingHeading)?.scrollIntoView({ block: 'start' });
    window.history.replaceState(null, '', `#${pendingHeading}`);
    setPendingHeading(null);
  }, [pendingHeading, view]);

  // 网页阅读视图里的标题锚点与代码复制按钮。
  useEffect(() => {
    if (view !== 'web' || !post.html) return;
    return enhanceReading(contentRef.current);
  }, [view, post.slug, post.html]);

  // 文章声明的公式渲染方式来自导出页面的 <html data-math>。正文是从独立页面里
  // 抽出来的，属性不会跟过来，这里在客户端补回，让相关样式规则继续生效。
  useEffect(() => {
    const root = document.documentElement;
    if (post.math !== 'mathjax' || view !== 'web' || !post.html) {
      root.dataset.math = post.math || 'native';
      return;
    }
    return typesetMath(root);
  }, [view, post.slug, post.math, post.html]);

  const toc = post.html ? post.webHeadings : post.headings;

  return (
    <>
      <div className="breadcrumb">
        <a href="/">全部手记</a>
        <span>/</span>
        <span>{post.category}</span>
      </div>

      <div className="article-layout">
        <article className="typst-article reading-paper fernmind-article">
          <header className="article-header fernmind-article-header">
            <div className="article-format">
              <Tag color={color} variant="soft">
                {post.category}
              </Tag>
              <span>
                <CodeIcon size={15} color="currentColor" />
                Typst · Fernmind
              </span>
            </div>
            <h1>{post.documentTitle || post.title}</h1>
            <p className="article-excerpt">{post.excerpt}</p>
            <div className="post-meta">
              <span>
                <CalendarIcon size={15} color="currentColor" />
                <time dateTime={post.date}>{post.date.replaceAll('-', '.')}</time>
              </span>
              <span>
                <ClockIcon size={15} color="currentColor" />约 {post.minutes} 分钟
              </span>
              <span>PDF {post.pages.length} 页</span>
            </div>
          </header>

          <div className="reader-toolbar" aria-label="阅读设置">
            {post.html && (
              <div className="reader-views" role="group" aria-label="阅读方式">
                <button type="button" aria-pressed={view === 'web'} onClick={() => setView('web')}>
                  网页阅读
                </button>
                <button type="button" aria-pressed={view === 'pages'} onClick={() => setView('pages')}>
                  原版页面
                </button>
              </div>
            )}
            {view === 'pages' && (
              <div className="reader-zoom">
                <Button
                  size="small"
                  type="text"
                  aria-label="缩小页面"
                  disabled={zoom <= 75}
                  onClick={() => setZoom((value) => Math.max(75, value - 25))}
                  icon={<MinusIcon size={17} color="currentColor" />}
                />
                <Button
                  size="small"
                  type="text"
                  aria-label="恢复页面适合宽度"
                  onClick={() => setZoom(100)}
                >
                  {zoom === 100 ? '适合宽度' : `${zoom}%`}
                </Button>
                <Button
                  size="small"
                  type="text"
                  aria-label="放大页面"
                  disabled={zoom >= 250}
                  onClick={() => setZoom((value) => Math.min(250, value + 25))}
                  icon={<PlusIcon size={17} color="currentColor" />}
                />
              </div>
            )}
            <div className="reader-links">
              {post.webUrl && (
                <a href={post.webUrl} target="_blank" rel="noopener noreferrer">
                  独立阅读
                </a>
              )}
              <a href={post.pdf} target="_blank" rel="noopener noreferrer">
                打开 PDF
              </a>
            </div>
          </div>

          {view === 'web' ? (
            <div
              className="fernmind-content"
              ref={contentRef}
              dangerouslySetInnerHTML={{ __html: post.html }}
            />
          ) : (
            <>
              <p className="reader-hint">原版页面保留 Typst 的纸面排版；可放大后横向滑动。</p>
              <div className="typst-reader" role="region" aria-label="Typst 原版页面" tabIndex={0}>
                <div className="typst-pages" style={{ width: `${zoom}%` }}>
                  {post.pages.map((page) => (
                    <figure className="typst-page" key={page.number}>
                      <div className="typst-page-image">
                        <img
                          src={page.src}
                          width={page.width}
                          height={page.height}
                          alt={`${post.title}，第 ${page.number} 页。正文文字可通过网页阅读或 PDF 选择复制。`}
                          loading={page.number === 1 ? 'eager' : 'lazy'}
                          decoding="async"
                        />
                        {post.headings
                          .filter((heading) => heading.page === page.number)
                          .map((heading) => (
                            <span
                              key={heading.id}
                              id={heading.id}
                              className="typst-heading-anchor"
                              style={{ top: `${(heading.y / page.height) * 100}%` }}
                              aria-hidden="true"
                            />
                          ))}
                      </div>
                      <figcaption>
                        第 {page.number} / {post.pages.length} 页
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            </>
          )}

          <footer className="article-footer">
            <div className="article-tags">
              {post.tags.map((tag) => (
                <Tag size="small" key={tag} variant="outlined">
                  {tag}
                </Tag>
              ))}
            </div>
            <div className="article-downloads">
              <a href={post.pdf} download>
                <DownloadIcon size={17} color="currentColor" />
                下载 PDF
              </a>
              <a href={post.source} download>
                <CodeIcon size={17} color="currentColor" />
                下载 .typ 源文件
              </a>
            </div>
            <div className="article-end">
              <LeafIcon size={23} color="currentColor" />
              <span>山林之间，文字生长。</span>
            </div>
          </footer>
        </article>

        <aside className="article-sidebar" aria-label="文章目录">
          <Card className="toc-card" style={{ padding: 24 }}>
            <h2>
              <BookIcon size={20} color="currentColor" />
              这一篇的路标
            </h2>
            <nav>
              {toc.map((heading) => (
                <a
                  key={heading.id}
                  href={`#${heading.id}`}
                  className={heading.level > 1 ? 'toc-sub' : undefined}
                  onClick={(event) => {
                    // 原版页面里没有网页正文的锚点，先切回网页阅读再定位。
                    if (post.html && view === 'pages') {
                      event.preventDefault();
                      setView('web');
                      setPendingHeading(heading.id);
                    }
                  }}
                >
                  <span>{heading.text}</span>
                </a>
              ))}
            </nav>
            <p>约 {post.minutes} 分钟，慢慢读。</p>
          </Card>
        </aside>
      </div>

      <a className="next-post" href={`/posts/${next.slug}/`}>
        <span>
          <small>下一篇手记</small>
          <strong>{next.title}</strong>
        </span>
        <BookIcon size={25} color="currentColor" />
      </a>
    </>
  );
}
