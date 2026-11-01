export const COOKIE_PREFERENCES_KEY = 'sushil-pokharel-cookie-preferences-v1';

export const DEFAULT_COOKIE_PREFERENCES = {
  essential: true,
  analytics: false,
  advertising: false,
};

export function parseCookiePreferences(value) {
  if (!value) return null;

  let preferences;
  try {
    preferences = JSON.parse(value);
  } catch {
    return null;
  }

  if (
    !preferences ||
    preferences.version !== 1 ||
    typeof preferences.analytics !== 'boolean' ||
    typeof preferences.advertising !== 'boolean'
  ) {
    return null;
  }

  return {
    essential: true,
    analytics: preferences.analytics,
    advertising: preferences.advertising,
  };
}

export function serializeCookiePreferences(preferences) {
  return JSON.stringify({
    version: 1,
    essential: true,
    analytics: preferences.analytics === true,
    advertising: preferences.advertising === true,
  });
}
