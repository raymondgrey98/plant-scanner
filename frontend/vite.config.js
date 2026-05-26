import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const isApp = process.env.BUILD_TARGET === 'app';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  base: isApp ? '/' : '/plant-scanner/',
  build: {
    outDir: isApp ? 'dist' : 'dist',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
