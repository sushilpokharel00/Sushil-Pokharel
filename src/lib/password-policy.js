export function getPasswordPolicyError(password) {
  if (password.length < 8) return 'Use at least 8 characters.';
  if (!/[a-z]/.test(password)) return 'Include at least one lowercase letter.';
  if (!/[A-Z]/.test(password)) return 'Include at least one uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Include at least one number.';
  if (!/[!@#$%^&*()_+\-=\[\]{};:'"|<>?,./`~]/.test(password)) {
    return 'Include at least one special character.';
  }
  return '';
}
