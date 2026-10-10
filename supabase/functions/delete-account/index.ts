import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigins = new Set([
  'https://sushilpokharel00.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:4174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:4174',
]);

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

  const authorization = request.headers.get('authorization');
  const tokenMatch = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch) {
    return jsonResponse({ error: 'Sign in before requesting account deletion.' }, 401, origin);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('Account deletion function is missing Supabase configuration.');
    return jsonResponse({ error: 'Account deletion is not configured. Contact the site administrator.' }, 500, origin);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${tokenMatch[1]}` } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser(tokenMatch[1]);
  if (userError || !user) {
    return jsonResponse({ error: 'Your sign-in session is invalid or expired. Sign in again and retry.' }, 401, origin);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error('Supabase rejected an authenticated account deletion request.', deleteError);
    return jsonResponse({ error: 'Supabase could not delete this account. Please try again or contact support.' }, 502, origin);
  }

  return jsonResponse({ deleted: true }, 200, origin);
});
