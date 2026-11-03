import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['favicon.svg'],
    manifest: {
      name: 'NikahFund — Wedding Savings Tracker', short_name: 'NikahFund',
      description: 'Tabungan pernikahan pribadi dengan penyimpanan lokal.',
      theme_color: '#205447', background_color: '#faf7f1', display: 'standalone',
      start_url: '/', scope: '/', orientation: 'portrait',
      icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }]
    },
    workbox: { navigateFallback: '/index.html', globPatterns: ['**/*.{js,css,html,svg,woff2}'] }
  })]
});
