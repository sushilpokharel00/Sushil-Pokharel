import assert from 'node:assert/strict';
import test from 'node:test';
import { checkGithubPagesRoutes } from './pages-checker.js';

const siteUrl = 'https://example.github.io/project/';
const appShell = '<!doctype html><html><head><title>Site</title></head><body><div id="root"></div></body></html>';
const github404 = '<html><head><title>Page not found &middot; GitHub Pages</title></head><body>Not found</body></html>';

function response(url, status, html) {
  return { url, status, text: async () => html };
}

test('recognizes the app shell served as the client-side route fallback', async () => {
  const result = await checkGithubPagesRoutes({ siteUrl, routes: ['terms'] }, async (url) => {
    const href = String(url);
    return href.endsWith('/project/')
      ? response(href, 200, appShell)
      : response(href, 404, appShell);
  });

  assert.equal(result.healthy, true);
  assert.equal(result.routes[0].result, 'spa-fallback');
  assert.equal(result.routes[0].expectedClientPage, 'terms');
});

test('checks the unknown-route fallback and expects the app 404 page', async () => {
  const result = await checkGithubPagesRoutes(
    { siteUrl, routes: ['__mcp_not_found_probe__'] },
    async (url) => {
      const href = String(url);
      return href.endsWith('/project/')
        ? response(href, 200, appShell)
        : response(href, 404, appShell);
    },
  );

  assert.equal(result.healthy, true);
  assert.equal(result.routes[0].expectedClientPage, 'not-found');
  assert.equal(result.routes[0].status, 404);
  assert.equal(result.routes[0].result, 'spa-fallback');
});

test('labels the account route for the sign-in and security UI', async () => {
  const result = await checkGithubPagesRoutes(
    { siteUrl, routes: ['account'] },
    async (url) => {
      const href = String(url);
      return href.endsWith('/project/')
        ? response(href, 200, appShell)
        : response(href, 404, appShell);
    },
  );

  assert.equal(result.routes[0].expectedClientPage, 'account');
  assert.equal(result.routes[0].result, 'spa-fallback');
});

test('labels the admin route for the protected website settings dashboard', async () => {
  const result = await checkGithubPagesRoutes(
    { siteUrl, routes: ['admin'] },
    async (url) => {
      const href = String(url);
      return href.endsWith('/project/')
        ? response(href, 200, appShell)
        : response(href, 404, appShell);
    },
  );

  assert.equal(result.routes[0].expectedClientPage, 'admin');
  assert.equal(result.routes[0].result, 'spa-fallback');
});

test('identifies GitHub Pages generic 404 pages and recommends publishing the fallback', async () => {
  const result = await checkGithubPagesRoutes({ siteUrl, routes: ['terms'] }, async (url) => {
    const href = String(url);
    return href.endsWith('/project/')
      ? response(href, 200, appShell)
      : response(href, 404, github404);
  });

  assert.equal(result.healthy, false);
  assert.equal(result.routes[0].result, 'github-pages-404');
  assert.match(result.recommendation, /404\.html/);
});

test('rejects non-GitHub Pages URLs before making requests', async () => {
  await assert.rejects(
    checkGithubPagesRoutes({ siteUrl: 'http://localhost:3000/' }, async () => {
      throw new Error('fetch must not be called');
    }),
    /HTTPS GitHub Pages URL/,
  );
});

test('rejects route traversal', async () => {
  await assert.rejects(
    checkGithubPagesRoutes({ siteUrl, routes: ['../private'] }, async (url) => response(String(url), 200, appShell)),
    /Invalid relative route/,
  );
});
