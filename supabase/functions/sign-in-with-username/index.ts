import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigins = new Set([
  'https://sushilpokharel.com.np',
  'https://www.sushilpokharel.com.np',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:4174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:4174',
]);

const invalidCredentials = { error: 'Invalid username or password.' };

function jsonResponse(body: Record<string, unknown>, status: number, origin: string | null) {
  const headers = new Headers({
    'content-type': 'application/json',
    'cache-control': 'no-store',
    vary: 'Origin',
  });
  if (origin && allowedOrigins.has(origin)) {
    headers.set('access-control-allow-origin', origin);
    headers.set('access-control-allow-headers', 'authorization, apikey, x-client-info, content-type');
    headers.set('access-control-allow-methods', 'POST, OPTIONS');
  }
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin');
  if (origin && !allowedOrigins.has(origin)) {
    return jsonResponse({ error: 'Origin is not allowed.' }, 403, null);
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': origin ?? 'null',
        'access-control-allow-headers': 'authorization, apikey, x-client-info, content-type',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-max-age': '86400',
        vary: 'Origin',
      },
    });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405, origin);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('Username sign-in is missing Supabase configuration.');
    return jsonResponse({ error: 'Username sign-in is not configured.' }, 500, origin);
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 2048) {
    return jsonResponse({ error: 'Request is too large.' }, 413, origin);
  }

  let payload: { username?: unknown; password?: unknown; purpose?: unknown };
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > 2048) {
      return jsonResponse({ error: 'Request is too large.' }, 413, origin);
    }
    const parsed: unknown = JSON.parse(body);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return jsonResponse({ error: 'Invalid request.' }, 400, origin);
    }
    payload = parsed as { username?: unknown; password?: unknown; purpose?: unknown };
  } catch {
    return jsonResponse({ error: 'Invalid request.' }, 400, origin);
  }

  const identifier = typeof payload.username === 'string'
    ? payload.username.normalize('NFKC').trim().toLowerCase()
    : '';
  const emailSignIn = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
  const password = typeof payload.password === 'string' ? payload.password : '';
  const purpose = payload.purpose === 'admin' ? 'admin' : 'user';
  if ((!emailSignIn && !/^[a-z0-9][a-z0-9._-]{2,31}$/.test(identifier)) || password.length === 0) {
    return jsonResponse(invalidCredentials, 401, origin);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let email = emailSignIn ? identifier : 'username-login-placeholder@invalid.invalid';
  if (!emailSignIn) {
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('user_id')
      .eq('username', identifier)
      .maybeSingle();
    if (profileError) {
      console.error('Username sign-in could not resolve the account.');
      return jsonResponse({ error: 'Username sign-in is temporarily unavailable.' }, 503, origin);
    }
    const lookupId = profile?.user_id ?? '00000000-0000-4000-8000-000000000000';
    const { data: account, error: accountError } = await adminClient.auth.admin.getUserById(lookupId);
    if (profile && accountError) {
      console.error('Username sign-in could not load the account.');
      return jsonResponse({ error: 'Username sign-in is temporarily unavailable.' }, 503, origin);
    }
    if (profile) email = account.user.email ?? email;
  }

  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) {
    return jsonResponse(invalidCredentials, 401, origin);
  }
  if (purpose === 'admin' && data.user.app_metadata?.role !== 'super_admin') {
    return jsonResponse(invalidCredentials, 401, origin);
  }

  return jsonResponse({
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
  }, 200, origin);
});
