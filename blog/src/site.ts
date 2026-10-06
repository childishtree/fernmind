// 站点配置。改这个文件就能换名字、简介和分类，不必动组件。
import { BookIcon, CompassIcon, CodeIcon } from 'naive-icons';

export const site = {
  name: 'Fernmind 博客',
  latinName: 'FERNWIND NOTES',
  author: 'Fernmind',
  description:
    '用 Typst 写作、由 Fernmind 排版的静态博客：一次写作，同时得到可选择的网页正文、保留纸面版式的原版页面与可下载的 PDF。',
  intro: '把想明白的事，慢慢写下来。',
  eyebrow: '技术与研究笔记',
  footerNote: '记录技术，保存思考。',
  home: {
    title: '把想明白的事，',
    titleAccent: '慢慢写下来。',
    caption: '用 Typst 写作，把思考和排版一起留下。',
    artCaption: '山林之间，文字生长。',
  },
  profile: {
    eyebrow: 'A LITTLE CORNER OF THE WEB',
    title: '你好，欢迎上岛。',
    body: '这里收纳排版实验、公式推导与工具笔记。把遇到的问题写清楚，让下一次探索有迹可循。',
    link: '认识这个博客',
  },
  archive: {
    eyebrow: 'EVERY NOTE HAS A PLACE',
    title: '文章归档',
    lead: '按时间整理的全部手记。每一篇，都是一次探索留下的脚印。',
    bottom: '写一点，再往前走一点。',
  },
  about: {
    eyebrow: 'HELLO, THIS IS FERNWIND',
    title: '关于这个博客',
    lead: '记录技术，保存思考。\n给还在生长的想法，留一处落脚的地方。',
    sections: [
      {
        title: '这里会写些什么？',
        paragraphs: [
          '文章用 Typst 编写，由 Fernmind 主题排版。一次排版尝试、一份模型记录，或一个让工作顺畅一点的小工具，都可以成为一篇手记的起点。',
          '文章不必面面俱到，但希望说清楚：问题是什么，尝试了什么，结果如何，还有什么值得再想一想。',
        ],
      },
      {
        title: '写下来的意义',
        paragraphs: [
          '记忆会淡，细节会散。把当时的判断、走过的弯路与有效的做法留下来，未来回头看时，就能少一点猜测，多一点依据。',
          '同一份 Typst 源文件会同时导出网页正文、原版页面与 PDF：网页里文字可以选中复制，原版页面保留纸面版式，PDF 适合存档与打印。',
        ],
      },
    ],
    action: '去读一篇手记',
  },
  missing: {
    title: '这条小路，暂时没有手记。',
    body: '文章可能换了位置，回首页继续逛逛吧。',
  },
};

// 分类。新增分类时在这里加一项，并让文章的 category 与之对应。
export const topics = [
  {
    name: 'Typst 排版',
    icon: BookIcon,
    description: '从内容到版式，让表达更清楚。',
    color: 'app-teal' as const,
  },
  {
    name: '排版笔记',
    icon: CompassIcon,
    description: '记录公式、表格与图表里的取舍。',
    color: 'app-orange' as const,
  },
  {
    name: '工具与工作流',
    icon: CodeIcon,
    description: '整理小工具，也整理工作的节奏。',
    color: 'app-green' as const,
  },
];

export type Topic = (typeof topics)[number];
