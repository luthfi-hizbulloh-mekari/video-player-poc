import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/media': 'http://localhost:3001'
    }
  },
  test: {
    environment: 'jsdom',
    globals: true
  }
});
