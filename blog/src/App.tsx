import { useEffect, useMemo, useState } from 'react';
import { Avatar, BackTop, Button, Card, Input, Tabs, Tag, Title } from 'animal-island-ui';
import {
  BookIcon,
  CalendarIcon,
  ClockIcon,
  CoffeeIcon,
  CompassIcon,
  FlowerIcon,
  LeafIcon,
  PencilIcon,
  SearchIcon,
} from 'naive-icons';
import postsData from './posts.json';
import { site, topics } from './site';
import TypstArticle from './TypstArticle';

export type Post = (typeof postsData)[number];
const posts: Post[] = postsData;

const ALL = '全部';
const dateText = (date: string) => date.replaceAll('-', '.');
const postUrl = (post: Post) => `/posts/${post.slug}/`;
const topicOf = (post: Post) => topics.find((topic) => topic.name === post.category) ?? topics[0];

function PostMeta({ post }: { post: Post }) {
  return (
    <div className="post-meta">
      <span>
        <CalendarIcon size={15} color="currentColor" />
        <time dateTime={post.date}>{dateText(post.date)}</time>
      </span>
      <span>
        <ClockIcon size={15} color="currentColor" />约 {post.minutes} 分钟
      </span>
    </div>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // 实际生效的主题以 <html data-theme> 为准（index.html 的内联脚本已在首屏前解析好）。
    const read = () => setDark(document.documentElement.dataset.theme === 'dark');
    read();
    // 仍处于「跟随系统」时，系统主题变化要实时反映到按钮状态。
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (window.__fmFollowSystem) read();
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const toggle = () => {
    const next = !dark;
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    // 用户显式选择后不再跟随系统。
    window.__fmFollowSystem = false;
    try {
      localStorage.setItem('fernmind-theme', next ? 'dark' : 'light');
    } catch {
      // 隐私模式下 localStorage 可能不可用，忽略即可。
    }
    setDark(next);
  };

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      aria-label={dark ? '切换到浅色模式' : '切换到深色模式'}
      title={dark ? '切换到浅色模式' : '切换到深色模式'}
    >
      {dark ? '浅色模式' : '深色模式'}
    </button>
  );
}

function Header({ pathname }: { pathname: string }) {
  const links = [
    { href: '/', label: '手记', active: pathname === '/' || pathname.startsWith('/posts/') },
    { href: '/archive/', label: '归档', active: pathname === '/archive' },
    { href: '/about/', label: '关于', active: pathname === '/about' },
  ];
  return (
    <header className="site-header">
      <a className="brand" href="/" aria-label={`${site.name}首页`}>
        <span className="brand-icon">
          <BookIcon size={29} color="currentColor" />
        </span>
        <span>
          <strong>{site.name}</strong>
          <small>{site.latinName}</small>
        </span>
      </a>
      <div className="header-actions">
        <nav className="site-nav" aria-label="主导航">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={link.active ? 'active' : undefined}
              aria-current={link.active ? 'page' : undefined}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <LeafIcon size={20} color="currentColor" />
        <span>
          © 2026 {site.name}
          <small>{site.footerNote}</small>
        </span>
      </div>
      <p>
        主题{' '}
        <a href="https://github.com/childishtree/fernmind" target="_blank" rel="noopener noreferrer">
          Fernmind
        </a>{' '}
        © Childish_tree · <a href="/licenses/fernmind.txt">MIT</a>
        <span className="footer-separator">·</span>
        <a href="/licenses/animal-island-ui.txt">Animal Island UI</a>
      </p>
    </footer>
  );
}

function TopicLinks({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'topic-links compact' : 'topic-links'}>
      {topics.map((topic) => (
        <a href={`/?category=${encodeURIComponent(topic.name)}`} key={topic.name}>
          <topic.icon size={22} color="currentColor" />
          <span>
            <strong>{topic.name}</strong>
            {!compact && <small>{topic.description}</small>}
          </span>
          <em>{posts.filter((post) => post.category === topic.name).length}</em>
        </a>
      ))}
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="home-sidebar" aria-label="关于博客和文章分类">
      <Card className="profile-card" style={{ padding: 25 }}>
        <Avatar size={66} icon={<LeafIcon size={34} color="currentColor" />} />
        <p className="eyebrow">{site.profile.eyebrow}</p>
        <h2>{site.profile.title}</h2>
        <p>{site.profile.body}</p>
        <div className="blog-stats">
          <span>
            <strong>{String(posts.length).padStart(2, '0')}</strong>篇手记
          </span>
          <span>
            <strong>{topics.length}</strong>个方向
          </span>
        </div>
        <a className="text-link" href="/about/">
          {site.profile.link}
        </a>
      </Card>
      <Card type="dashed" className="topics-card" style={{ padding: 23 }}>
        <h2>沿着兴趣走走</h2>
        <TopicLinks compact />
      </Card>
      <div className="quiet-note">
        <CoffeeIcon size={24} color="currentColor" />
        <p>
          不赶进度。
          <br />
          只把有用的思考，认真留下。
        </p>
      </div>
    </aside>
  );
}

function PostCard({ post }: { post: Post }) {
  const topic = topicOf(post);
  const index = posts.indexOf(post);
  return (
    <Card className="post-card" style={{ padding: 25 }}>
      <div className="post-card-icon" aria-hidden="true">
        <topic.icon size={30} color="currentColor" />
        <small>{String(index + 1).padStart(2, '0')}</small>
      </div>
      <div className="post-card-body">
        <div className="post-card-top">
          <Tag color={topic.color} variant="soft" size="small">
            {post.category}
          </Tag>
          {post.featured && (
            <span className="featured-label">
              <FlowerIcon size={15} color="currentColor" />
              开篇手记
            </span>
          )}
        </div>
        <h3>
          <a href={postUrl(post)}>{post.title}</a>
        </h3>
        <p className="post-excerpt">{post.excerpt}</p>
        <div className="post-card-bottom">
          <PostMeta post={post} />
          <a className="read-link" href={postUrl(post)}>
            阅读全文
            <BookIcon size={16} color="currentColor" />
          </a>
        </div>
      </div>
    </Card>
  );
}

function PostList({ items, reset }: { items: Post[]; reset: () => void }) {
  if (!items.length) {
    return (
      <div className="post-list">
        <Card className="empty-state" style={{ padding: 40 }}>
          <SearchIcon size={40} color="currentColor" />
          <h3>还没有找到这篇手记</h3>
          <p>试试更短的关键词，或回到全部文章。</p>
          <Button onClick={reset}>查看全部手记</Button>
        </Card>
      </div>
    );
  }
  return (
    <div className="post-list">
      {items.map((post) => (
        <PostCard key={post.slug} post={post} />
      ))}
    </div>
  );
}

function Home({ search }: { search: string }) {
  const params = new URLSearchParams(search);
  const requested = params.get('category') ?? ALL;
  const [category, setCategory] = useState(topics.some((topic) => topic.name === requested) ? requested : ALL);
  const [query, setQuery] = useState(params.get('q') ?? '');

  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return posts;
    // 正文纯文本也参与检索，因此能搜到文章里的具体内容。
    return posts.filter((post) =>
      [post.title, post.excerpt, post.content, ...post.tags].join(' ').toLocaleLowerCase().includes(needle),
    );
  }, [query]);

  // 把筛选状态同步到地址栏，方便分享与刷新后保留。
  useEffect(() => {
    const next = new URLSearchParams();
    if (category !== ALL) next.set('category', category);
    if (query.trim()) next.set('q', query.trim());
    window.history.replaceState(null, '', `/${next.size ? `?${next.toString()}` : ''}`);
  }, [category, query]);

  const reset = () => {
    setQuery('');
    setCategory(ALL);
  };
  const visibleCount = matches.filter((post) => category === ALL || post.category === category).length;

  return (
    <>
      <section className="home-intro" aria-labelledby="home-title">
        <div>
          <p className="eyebrow intro-eyebrow">
            <PencilIcon size={17} color="currentColor" />
            {site.eyebrow}
          </p>
          <h1 id="home-title">
            {site.home.title}
            <br />
            <span>{site.home.titleAccent}</span>
          </h1>
          <p className="intro-description">{site.description}</p>
          <div className="intro-caption">
            <LeafIcon size={18} color="currentColor" />
            <span>{site.home.caption}</span>
          </div>
        </div>
        <div className="intro-art" aria-hidden="true">
          <img src="/fernmind/cover.png" alt="" />
          <span>{site.home.artCaption}</span>
        </div>
      </section>

      <div className="home-layout">
        <section className="notes-section" aria-labelledby="notes-title">
          <div className="section-heading">
            <h2 id="notes-title">
              <Title color="app-teal" size="middle">
                最新手记
              </Title>
            </h2>
            <div className="search-wrap">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onClear={() => setQuery('')}
                prefix={<SearchIcon size={19} color="currentColor" />}
                allowClear
                placeholder="找一篇手记…"
                aria-label="搜索文章"
              />
            </div>
          </div>
          <div className="filter-summary" aria-live="polite">
            {query.trim() ? `“${query.trim()}” · ` : ''}
            {visibleCount} 篇手记
          </div>
          <Tabs
            shadow={false}
            aria-label="文章分类"
            className="post-tabs"
            activeKey={category}
            onChange={setCategory}
            items={[ALL, ...topics.map((topic) => topic.name)].map((name) => ({
              key: name,
              label: name,
              children: (
                <PostList
                  items={matches.filter((post) => name === ALL || post.category === name)}
                  reset={reset}
                />
              ),
            }))}
          />
        </section>
        <Sidebar />
      </div>
    </>
  );
}

function Archive() {
  const months = [...new Set(posts.map((post) => post.date.slice(0, 7)))];
  return (
    <div className="simple-page archive-page">
      <header className="page-heading">
        <p className="eyebrow">{site.archive.eyebrow}</p>
        <h1>
          <Title color="app-orange" size="large">
            {site.archive.title}
          </Title>
        </h1>
        <p>
          按时间整理的 {posts.length} 篇手记。{site.archive.lead}
        </p>
      </header>
      {months.map((month) => {
        const items = posts.filter((post) => post.date.startsWith(month));
        return (
          <section className="archive-month" key={month}>
            <h2>
              {month.replace('-', ' 年 ')} 月<span>{items.length} 篇</span>
            </h2>
            <Card style={{ padding: '8px 25px' }}>
              {items.map((post) => (
                <a className="archive-row" href={postUrl(post)} key={post.slug}>
                  <time dateTime={post.date}>{post.date.slice(5).replace('-', '.')}</time>
                  <span>
                    <strong>{post.title}</strong>
                    <small>
                      {post.category} · 约 {post.minutes} 分钟
                    </small>
                  </span>
                  <BookIcon size={22} color="currentColor" />
                </a>
              ))}
            </Card>
          </section>
        );
      })}
      <div className="archive-bottom">
        <LeafIcon size={24} color="currentColor" />
        <span>{site.archive.bottom}</span>
      </div>
    </div>
  );
}

function About() {
  const { about } = site;
  return (
    <div className="simple-page about-page">
      <div className="about-banner" aria-hidden="true">
        <img src="/fernmind/cover.png" alt="" />
      </div>
      <div className="about-avatar">
        <Avatar size={86} icon={<LeafIcon size={45} color="currentColor" />} />
      </div>
      <article className="about-content">
        <p className="eyebrow">{about.eyebrow}</p>
        <h1>{about.title}</h1>
        <p className="about-lead">
          {about.lead.split('\n').map((line, index) => (
            <span key={line}>
              {index > 0 && <br />}
              {line}
            </span>
          ))}
        </p>
        {about.sections.map((section, index) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {index === 0 && <TopicLinks />}
          </section>
        ))}
        <div className="about-action">
          <Button type="primary" size="large" icon={<BookIcon size={21} color="currentColor" />} onClick={() => window.location.assign('/')}>
            {about.action}
          </Button>
        </div>
      </article>
    </div>
  );
}

function Missing() {
  return (
    <div className="missing-page">
      <CompassIcon size={70} color="currentColor" />
      <h1>{site.missing.title}</h1>
      <p>{site.missing.body}</p>
      <Button type="primary" onClick={() => window.location.assign('/')}>
        回到首页
      </Button>
    </div>
  );
}

function Article({ post }: { post: Post }) {
  const next = posts[(posts.indexOf(post) + 1) % posts.length];
  return <TypstArticle post={post} next={next} color={topicOf(post).color} />;
}

export default function App({ pathname = '/', search = '' }: { pathname?: string; search?: string }) {
  const path = pathname.replace(/\/+$/, '') || '/';
  const post = path.startsWith('/posts/') ? posts.find((item) => path === `/posts/${item.slug}`) : undefined;
  const title =
    post?.title ??
    (path === '/archive'
      ? site.archive.title
      : path === '/about'
        ? site.about.title
        : path === '/'
          ? site.eyebrow
          : site.missing.title);

  useEffect(() => {
    document.title = `${title} · ${site.name}`;
  }, [title]);

  return (
    <>
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <div className="site">
        <Header pathname={path} />
        <main id="main-content">
          {path === '/' ? (
            <Home search={search} />
          ) : path === '/archive' ? (
            <Archive />
          ) : path === '/about' ? (
            <About />
          ) : post ? (
            <Article post={post} />
          ) : (
            <Missing />
          )}
        </main>
        <Footer />
      </div>
      <BackTop
        duration={
          typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300
        }
      />
    </>
  );
}
