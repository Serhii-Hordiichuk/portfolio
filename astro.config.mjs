import { defineConfig } from 'astro/config';

export default defineConfig({
  outDir: 'dist',
  publicDir: 'public',
  build: {
    inlineStylesheets: 'auto',
  },
  server: {
    port: 8787,
  },
  vite: {
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:8788',
          changeOrigin: true,
        },
      },
    },
  },
});
