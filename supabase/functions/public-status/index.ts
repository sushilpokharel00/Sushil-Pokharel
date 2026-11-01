import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigins = new Set([
  'https://sushilpokharel00.com.np',
  'https://www.sushilpokharel00.com.np',
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
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Public status endpoint is missing Supabase configuration.');
    return jsonResponse({ error: 'Status metrics are not configured.' }, 503, origin);
  }

  try {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const weekStart = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const [todayResult, weekResult] = await Promise.all([
      admin.from('page_views')
        .select('id', { count: 'exact', head: true })
        .eq('viewed_on', today),
      admin.from('page_views')
        .select('id', { count: 'exact', head: true })
        .gte('viewed_on', weekStart),
    ]);

    if (todayResult.error) throw todayResult.error;
    if (weekResult.error) throw weekResult.error;
    if (!Number.isSafeInteger(todayResult.count) || !Number.isSafeInteger(weekResult.count)) {
      throw new Error('The traffic aggregate was incomplete.');
    }

    return jsonResponse({
      trafficToday: todayResult.count,
      trafficLast7Days: weekResult.count,
      checkedAt: now.toISOString(),
    }, 200, origin);
  } catch (error) {
    console.error('Could not read public traffic aggregates.', error);
    return jsonResponse({ error: 'Traffic metrics are temporarily unavailable.' }, 500, origin);
  }
});
