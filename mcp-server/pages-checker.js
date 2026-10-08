const githubPagesDomain = '.github.io';
const requestTimeoutMs = 10_000;

function parseSiteUrl(siteUrl) {
  let url;
  try {
    url = new URL(siteUrl);
  } catch {
    throw new TypeError('siteUrl must be a valid absolute URL.');
  }

  if (
    url.protocol !== 'https:' ||
    !url.hostname.endsWith(githubPagesDomain) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new TypeError('siteUrl must be an HTTPS GitHub Pages URL without credentials, query, or fragment.');
  }

  url.pathname = `${url.pathname.replace(/\/+$/, '')}/`;
  return url;
}

function parseRoute(route) {
  if (typeof route !== 'string') {
    throw new TypeError('Each route must be a relative path string.');
  }

  const normalizedRoute = route.replace(/^\/+|\/+$/g, '');
  if (
    normalizedRoute &&
    (!/^[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*$/.test(normalizedRoute) ||
      normalizedRoute.split('/').some((segment) => segment === '.' || segment === '..'))
  ) {
    throw new TypeError(`Invalid relative route: ${route}`);
  }

  return normalizedRoute;
}

function getTitle(html) {
  const match = html.match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i);
  return match?.[1]
    .replace(/&amp;/gi, '&')
    .replace(/&(?:middot|#183);/gi, '·')
    .replace(/&#39;|&apos;/gi, "'")
    .trim() || null;
}

function isGithubPagesNotFound(status, title, html) {
  return status === 404 && (
    /page not found\s*[·|—-]\s*github pages/i.test(title ?? '') ||
    /the site configured at this address does not contain/i.test(html)
  );
}

async function getPage(url, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: { accept: 'text/html' },
    signal: AbortSignal.timeout(requestTimeoutMs),
  });

  const finalUrl = new URL(response.url || url);
  if (finalUrl.origin !== new URL(url).origin) {
    throw new Error(`GitHub Pages redirected outside its origin: ${url}`);
  }

  const html = await response.text();
  const title = getTitle(html);

  return {
    status: response.status,
    title,
    html,
    githubPagesNotFound: isGithubPagesNotFound(response.status, title, html),
  };
}

export async function checkGithubPagesRoutes({ siteUrl, routes = ['terms', 'beta'] }, fetchImpl = fetch) {
  const baseUrl = parseSiteUrl(siteUrl);
  const rootPage = await getPage(baseUrl, fetchImpl);
  const normalizedRoutes = routes.map(parseRoute);
  const routeChecks = await Promise.all(normalizedRoutes.map(async (route) => {
    const url = new URL(route, baseUrl);
    const page = await getPage(url, fetchImpl);
    const spaFallback = (
      page.status === 404 &&
      !page.githubPagesNotFound &&
      page.html === rootPage.html
    );
    const result = page.githubPagesNotFound
      ? 'github-pages-404'
      : spaFallback
        ? 'spa-fallback'
        : page.status < 400
          ? 'ok'
          : 'http-error';

    return { route: route ? `/${route}` : '/', url: url.href, status: page.status, title: page.title, result };
  }));

  const rootOk = rootPage.status < 400 && !rootPage.githubPagesNotFound;
  const healthy = rootOk && routeChecks.every(({ result }) => result === 'ok' || result === 'spa-fallback');
  const hasMissingFallback = routeChecks.some(({ result }) => result === 'github-pages-404');

  return {
    siteUrl: baseUrl.href,
    root: { status: rootPage.status, title: rootPage.title, healthy: rootOk },
    routes: routeChecks,
    healthy,
    recommendation: healthy
      ? 'The site root and requested routes are serving the site successfully.'
      : !rootOk
        ? 'The site root is not serving successfully; verify the Pages deployment and published site URL.'
        : hasMissingFallback
          ? 'Publish a 404.html at the GitHub Pages site root containing the built app shell, then redeploy.'
          : 'One or more requested routes returned HTTP errors; review the route responses and deployment output.',
  };
}
