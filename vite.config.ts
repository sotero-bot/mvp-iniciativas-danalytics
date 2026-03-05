import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'apps/web', // Set root to apps/web where index.html is
  build: {
    outDir: '../../dist/web',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    open: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
