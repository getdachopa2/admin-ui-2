import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// vite.config.ts
export default defineConfig({
  plugins: [react()],
  server: { 
    proxy: { 
      '/webhook': { target: 'http://127.0.0.1:5701', changeOrigin: true },
      '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true }
    } 
  },
  resolve:{ alias:{ '@': resolve(__dirname,'src') } }
});
