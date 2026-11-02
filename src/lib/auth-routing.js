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
  return role === 'super_admin' ? '/admin/dashboard' : '/user/dashboard';
}

export function getAuthScreen(pathname) {
  if (pathname === '/admin/login') return 'admin';
  if (pathname === '/signup' || pathname === '/register') return 'sign-up';
  if (
    pathname === '/account'
    || pathname === '/login'
    || pathname === '/account/security'
    || pathname === '/reset-password'
  ) return 'sign-in';
  return null;
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
    throw new Error('VITE_AUTH_REDIRECT_URL must be the official HTTPS site origin.');
  }

  if (
    url.origin !== 'https://sushilpokharel00.com.np' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('VITE_AUTH_REDIRECT_URL must be https://sushilpokharel00.com.np.');
  }

  return new URL(path, url.origin).toString();
}

export function isPasswordRecoveryUrl(location) {
  return (
    (typeof window !== 'undefined' && window.__passwordRecoveryRedirect === true)
    || hasRecoveryType(location)
  );
}
