import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigins = new Set([
  'https://sushilpokhrel00.com.np',
  'https://www.sushilpokhrel00.com.np',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:4174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:4174',
  'capacitor://localhost',
]);
const allowedPagePaths = new Set([
  '/',
  '/terms',
  '/privacy',
  '/privacy-policy',
  '/disclaimer',
  '/contact',
  '/support',
  '/app',
  '/android',
  '/android-app',
  '/user',
  '/dashboard',
  '/account',
  '/login',
  '/newsletter',
  '/posts',
  '/beta',
  '/beta-requested',
  '/status',
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
  if (origin && !allowedOrigins.has(origin)) return jsonResponse({ error: 'Origin is not allowed.' }, 403, null);
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
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405, origin);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const hashSecret = Deno.env.get('ANALYTICS_HASH_SECRET');
  if (!supabaseUrl || !serviceRoleKey || !hashSecret || hashSecret.length < 32) {
    console.error('Page-view endpoint is missing Supabase or analytics configuration.');
    return jsonResponse({ error: 'Analytics endpoint is not configured.' }, 503, origin);
  }

  let pagePath: unknown;
  try {
    ({ pagePath } = await request.json());
  } catch {
    return jsonResponse({ error: 'Request must contain valid JSON.' }, 400, origin);
  }
  if (typeof pagePath !== 'string' || !allowedPagePaths.has(pagePath) || pagePath.length > 200 ||
    !/^\/[A-Za-z0-9._~/-]*$/.test(pagePath) ||
    pagePath.split('/').some((segment) => segment === '.' || segment === '..')) {
    return jsonResponse({ error: 'Invalid page path.' }, 400, origin);
  }

  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (!forwardedFor) return jsonResponse({ error: 'Visitor network information is unavailable.' }, 400, origin);
  const day = new Date().toISOString().slice(0, 10);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(hashSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${day}:${forwardedFor}`),
  );
  const visitorHash = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await admin.from('page_views').upsert({
    visitor_hash: visitorHash,
    page_path: pagePath,
    viewed_on: day,
  }, {
    onConflict: 'visitor_hash,page_path,viewed_on',
    ignoreDuplicates: true,
  });
  if (error) {
    console.error('Could not store a page-view event.', error);
    return jsonResponse({ error: 'Could not record this visit.' }, 500, origin);
  }
  return jsonResponse({ ok: true }, 200, origin);
});
