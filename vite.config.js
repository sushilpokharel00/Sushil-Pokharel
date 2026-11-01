import { defineConfig } from 'vite';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: '/',
  plugins: [{
    name: 'serve-app-template',
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        const requestUrl = request.url ?? '/';
        const queryIndex = requestUrl.indexOf('?');
        const pathname = queryIndex < 0 ? requestUrl : requestUrl.slice(0, queryIndex);
        const query = queryIndex < 0 ? '' : requestUrl.slice(queryIndex);
        if (!pathname.startsWith('/@') && !extname(pathname)) {
          request.url = `/app.html${query}`;
        }
        next();
      });
    },
  }],
  server: {
    port: 3000,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: {
        index: resolve(fileURLToPath(new URL('.', import.meta.url)), 'app.html'),
      },
    },
  },
});
