import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: '/Sushil-Pokharel/',
  build: {
    rollupOptions: {
      input: {
        index: resolve(fileURLToPath(new URL('.', import.meta.url)), 'app.html'),
      },
    },
  },
});
