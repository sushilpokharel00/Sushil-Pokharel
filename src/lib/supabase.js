import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || import.meta.env.VITE_SUPABASE_ANON_KEY
  || ''
).trim();

function isServiceRoleKey(key) {
  if (key.startsWith('sb_secret_')) return true;
  const segments = key.split('.');
  if (segments.length !== 3) return false;

  try {
    const payload = JSON.parse(atob(segments[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.role === 'service_role';
  } catch {
    return false;
  }
}

function validateConfiguration(urlValue, key) {
  if (!urlValue || !key) {
    return 'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your Supabase project URL and public publishable key.';
  }

  let url;
  try {
    url = new URL(urlValue);
  } catch {
    return 'VITE_SUPABASE_URL must be a valid Supabase project URL.';
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
    return 'VITE_SUPABASE_URL must be an HTTPS Supabase project URL (HTTP is allowed for localhost development).';
  }

  if (isServiceRoleKey(key)) {
    return 'VITE_SUPABASE_PUBLISHABLE_KEY must be the public key, never a service-role or secret key.';
  }

  return '';
}

export const supabaseConfigurationError = validateConfiguration(supabaseUrl, supabaseAnonKey);

export const supabase = !supabaseConfigurationError
  ? createClient(new URL(supabaseUrl).origin, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  })
  : null;
