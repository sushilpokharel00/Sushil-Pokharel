export function normalizeUsername(username) {
  return username.normalize('NFKC').trim().toLowerCase();
}

export function getUsernameError(username) {
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(normalizeUsername(username))) {
    return 'Use 3–32 letters, numbers, dots, underscores, or hyphens; start with a letter or number.';
  }
  return '';
}

export function getDashboardPath(role) {
  return role === 'admin' ? '/admin' : '/user';
}

function hasRecoveryType(location) {
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
  const queryParams = new URLSearchParams(location.search);
  return hashParams.get('type') === 'recovery' || queryParams.get('type') === 'recovery';
}

export function getAuthRedirectUrl(path, origin) {
  let url;
  try {
    url = new URL(origin);
  } catch {
    throw new Error('VITE_AUTH_REDIRECT_URL must be a valid HTTPS origin (HTTP is allowed for localhost development).');
  }

  const isLocalHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
  if (
    (url.protocol !== 'https:' && !isLocalHttp) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('VITE_AUTH_REDIRECT_URL must be an HTTPS origin (HTTP is allowed for localhost development).');
  }

  return new URL(path, url.origin).toString();
}

export function isPasswordRecoveryUrl(location) {
  return (
    (typeof window !== 'undefined' && window.__passwordRecoveryRedirect === true)
    || hasRecoveryType(location)
  );
}
