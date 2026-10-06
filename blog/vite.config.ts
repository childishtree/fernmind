import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 默认只监听本机。需要让同一局域网的设备访问时，把 host 改成 '0.0.0.0'。
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5180, strictPort: true },
  preview: { host: '127.0.0.1', port: 5181, strictPort: true },
});
