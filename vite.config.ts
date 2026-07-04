import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/child-math-app/',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '数学夜航',
        short_name: '数学夜航',
        lang: 'zh-CN',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#12333E',
        theme_color: '#12333E',
        start_url: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          // maskable：安全区留白由 icon 背景铺满整块，可作 any + maskable。
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // 预缓存壳 + 字体分片 + 图标，实现离线可用。
      workbox: { globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'] },
    }),
  ],
});
