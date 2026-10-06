import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import 'animal-island-ui/style';
import './style.css';
import './fernmind-blog.css';
import App from './App';

const container = document.getElementById('root');
if (!container) throw new Error('找不到 #root 挂载点');

const app = (
  <React.StrictMode>
    <App pathname={window.location.pathname} search={window.location.search} />
  </React.StrictMode>
);

// 预渲染过的页面直接接管，保留静态 HTML 的可读性；
// 带查询参数的首页是纯客户端筛选，重新挂载即可。
if (container.hasChildNodes() && !window.location.search) hydrateRoot(container, app);
else createRoot(container).render(app);
