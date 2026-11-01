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
