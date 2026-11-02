export function sitePath(path = '/') {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}

export function navigateTo(path, { replace = false } = {}) {
  const destination = new URL(path, window.location.href);
  if (destination.origin !== window.location.origin) {
    throw new Error('Internal navigation must stay on the current origin.');
  }

  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const nextUrl = `${destination.pathname}${destination.search}${destination.hash}`;
  if (currentUrl === nextUrl) return false;

  const historyMethod = replace ? 'replaceState' : 'pushState';
  window.history[historyMethod]({}, '', nextUrl);
  window.dispatchEvent(new PopStateEvent('popstate'));
  return true;
}
