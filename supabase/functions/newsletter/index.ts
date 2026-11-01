import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigins = new Set([
  'https://sushilpokharel00.com.np',
  'https://www.sushilpokharel00.com.np',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:4174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:4174',
  'capacitor://localhost',
]);
const siteOrigin = 'https://sushilpokharel00.com.np';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function response(body: Record<string, unknown>, status: number, origin: string | null) {
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

function base64Url(value: Uint8Array) {
  return btoa(String.fromCharCode(...value))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function signToken(payload: Record<string, unknown>, secret: string) {
  const encoded = base64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encoded));
  return `${encoded}.${base64Url(new Uint8Array(signature))}`;
}

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return base64Url(new Uint8Array(digest));
}

async function verifyToken(token: string, secret: string) {
  const [encoded, signature, extra] = token.split('.');
  if (!encoded || !signature || extra) return null;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const normalized = signature.replace(/-/g, '+').replace(/_/g, '/');
  const signatureBytes = Uint8Array.from(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')), (char) => char.charCodeAt(0));
  const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, new TextEncoder().encode(encoded));
  if (!valid) return null;
  const decoded = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const payload = JSON.parse(new TextDecoder().decode(
    Uint8Array.from(atob(decoded.padEnd(Math.ceil(decoded.length / 4) * 4, '=')), (char) => char.charCodeAt(0)),
  ));
  if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
  return payload as { id: string; email: string; kind: string; exp: number };
}

async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('NEWSLETTER_FROM_EMAIL');
  if (!apiKey || !from) throw new Error('Newsletter email delivery is not configured.');

  const mailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!mailResponse.ok) {
    console.error('Newsletter provider rejected an email.', mailResponse.status);
    throw new Error('Email delivery failed. Please try again later.');
  }
}

function emailShell(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f6f5;font-family:Arial,sans-serif;color:#24312b"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #e3e9e5;border-radius:12px"><tr><td style="padding:32px"><p style="margin:0 0 12px;color:#527362;font-weight:bold;letter-spacing:1px;font-size:12px">SUSHIL POKHAREL</p><h1 style="font-size:23px;margin:0 0 18px">${title}</h1>${body}<p style="font-size:12px;line-height:1.6;color:#78837d;margin:26px 0 0">You received this message because an action was requested for ${siteOrigin}. If you did not request it, you can ignore this email.</p></td></tr></table></td></tr></table></body></html>`;
}

async function getAuthorizedUser(request: Request, supabaseUrl: string, anonKey: string) {
  const match = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i);
  if (!match) return { user: null, error: 'Sign in is required.' };
  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${match[1]}` } },
  });
  const { data: { user }, error } = await client.auth.getUser();
  return error || !user
    ? { user: null, error: 'Your sign-in session is invalid or expired.' }
    : { user, error: null };
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin');
  if (origin && !allowedOrigins.has(origin)) return response({ error: 'Origin is not allowed.' }, 403, null);
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
  if (request.method !== 'POST') return response({ error: 'Method not allowed.' }, 405, origin);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const tokenSecret = Deno.env.get('NEWSLETTER_TOKEN_SECRET');
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !tokenSecret || tokenSecret.length < 32) {
    console.error('Newsletter function is missing Supabase or token configuration.');
    return response({ error: 'Newsletter service is not configured.' }, 503, origin);
  }

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return response({ error: 'Request must contain valid JSON.' }, 400, origin);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (input.action === 'subscribe' || input.action === 'manage') {
      let email: string;
      let userId: string | null = null;
      if (input.action === 'manage') {
        const auth = await getAuthorizedUser(request, supabaseUrl, anonKey);
        if (auth.error || !auth.user) return response({ error: auth.error }, 401, origin);
        email = auth.user.email?.trim().toLowerCase() ?? '';
        userId = auth.user.id;
        if (typeof input.enabled !== 'boolean') return response({ error: 'enabled must be a boolean.' }, 400, origin);
        if (!input.enabled) {
          const now = new Date().toISOString();
          const { error } = await admin.from('newsletter_subscribers')
            .update({ status: 'unsubscribed', unsubscribed_at: now, updated_at: now })
            .eq('user_id', userId);
          if (error) throw error;
          const { error: profileError } = await admin.from('profiles')
            .update({ newsletter_enabled: false })
            .eq('user_id', userId);
          if (profileError) throw profileError;
          return response({ ok: true, subscribed: false }, 200, origin);
        }
      } else {
        if (input.consent !== true) return response({ error: 'Confirm that you want to receive email updates.' }, 400, origin);
        if (typeof input.email !== 'string') return response({ error: 'Enter a valid email address.' }, 400, origin);
        email = input.email.trim().toLowerCase();
      }

      if (!emailPattern.test(email) || email.length > 254) return response({ error: 'Enter a valid email address.' }, 400, origin);
      const { data: existing, error: lookupError } = await admin
        .from('newsletter_subscribers')
        .select('id, status, user_id, updated_at')
        .eq('email', email)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (input.action === 'subscribe' && typeof input.company === 'string' && input.company.trim()) {
        return response({ ok: true, message: 'If this address can be subscribed, a confirmation email will be sent.' }, 200, origin);
      }
      if (existing?.status === 'subscribed') {
        if (userId) {
          if (!existing.user_id) {
            const { error } = await admin.from('newsletter_subscribers')
              .update({ user_id: userId, updated_at: new Date().toISOString() })
              .eq('id', existing.id);
            if (error) throw error;
          }
          const { error } = await admin.from('profiles')
            .update({ newsletter_enabled: true })
            .eq('user_id', userId);
          if (error) throw error;
        }
        return response({ ok: true, message: 'If this address can be subscribed, a confirmation email will be sent.' }, 200, origin);
      }
      if (existing?.status === 'pending' && Date.now() - new Date(existing.updated_at).getTime() < 60_000) {
        return response({ ok: true, message: 'If this address can be subscribed, a confirmation email will be sent.' }, 200, origin);
      }

      const subscriberId = existing?.id ?? crypto.randomUUID();
      const confirmationToken = await signToken({
        id: subscriberId,
        email,
        kind: 'confirm',
        exp: Date.now() + 24 * 60 * 60 * 1000,
      }, tokenSecret);
      const { error: saveError } = await admin.from('newsletter_subscribers').upsert({
        id: subscriberId,
        user_id: userId ?? existing?.user_id ?? null,
        email,
        status: 'pending',
        confirmation_token_hash: await hashToken(confirmationToken),
        token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        confirmed_at: null,
        unsubscribed_at: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'email' });
      if (saveError) throw saveError;

      const confirmUrl = `${siteOrigin}/newsletter?token=${encodeURIComponent(confirmationToken)}&action=confirm`;
      await sendEmail({
        to: email,
        subject: 'Confirm your newsletter subscription',
        html: emailShell('Confirm your subscription', `<p style="line-height:1.7;color:#52615a">Choose the button below to confirm that you want to receive occasional website and platform updates.</p><p style="margin:24px 0"><a href="${confirmUrl}" style="display:inline-block;padding:13px 20px;background:#315648;color:#fff;text-decoration:none;border-radius:7px;font-weight:bold">Confirm subscription</a></p><p style="font-size:12px;color:#78837d">This link expires in 24 hours.</p>`),
      });
      return response({ ok: true, message: 'Check your email for a confirmation link.' }, 200, origin);
    }

    if (input.action === 'confirm' || input.action === 'unsubscribe') {
      if (typeof input.token !== 'string') return response({ error: 'This link is invalid or expired.' }, 400, origin);
      const payload = await verifyToken(input.token, tokenSecret);
      const expectedKind = input.action === 'confirm' ? 'confirm' : 'unsubscribe';
      if (!payload || payload.kind !== expectedKind || !payload.id || !emailPattern.test(payload.email)) {
        return response({ error: 'This link is invalid or expired.' }, 400, origin);
      }

      const { data: subscriber, error: lookupError } = await admin.from('newsletter_subscribers')
        .select('id, user_id, status, confirmation_token_hash, token_expires_at')
        .eq('id', payload.id)
        .eq('email', payload.email)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (!subscriber) return response({ error: 'This link is invalid or expired.' }, 400, origin);

      if (input.action === 'confirm') {
        if (subscriber.status !== 'pending' || subscriber.confirmation_token_hash !== await hashToken(input.token) ||
          !subscriber.token_expires_at || new Date(subscriber.token_expires_at).getTime() < Date.now()) {
          return response({ error: 'This link is invalid or expired.' }, 400, origin);
        }
        const { error } = await admin.from('newsletter_subscribers').update({
          status: 'subscribed',
          confirmed_at: new Date().toISOString(),
          confirmation_token_hash: null,
          token_expires_at: null,
          updated_at: new Date().toISOString(),
        }).eq('id', subscriber.id);
        if (error) throw error;
        if (subscriber.user_id) {
          const { error: profileError } = await admin.from('profiles')
            .update({ newsletter_enabled: true })
            .eq('user_id', subscriber.user_id);
          if (profileError) throw profileError;
        }
        return response({ ok: true, subscribed: true }, 200, origin);
      }

      const now = new Date().toISOString();
      const { error } = await admin.from('newsletter_subscribers').update({
        status: 'unsubscribed',
        unsubscribed_at: now,
        updated_at: now,
      }).eq('id', subscriber.id);
      if (error) throw error;
      if (subscriber.user_id) {
        const { error: profileError } = await admin.from('profiles')
          .update({ newsletter_enabled: false })
          .eq('user_id', subscriber.user_id);
        if (profileError) throw profileError;
      }
      return response({ ok: true, subscribed: false }, 200, origin);
    }

    return response({ error: 'Unsupported newsletter action.' }, 400, origin);
  } catch (error) {
    console.error('Newsletter request failed.', error);
    return response({ error: error instanceof Error ? error.message : 'Newsletter request failed.' }, 500, origin);
  }
});
