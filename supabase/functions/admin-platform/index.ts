import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigins = new Set([
  'https://sushilpokharel00.com.np',
]);
const siteOrigin = 'https://sushilpokharel00.com.np';

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

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char] ?? char);
}

function base64Url(value: Uint8Array) {
  return btoa(String.fromCharCode(...value))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function signNewsletterToken(email: string, id: string, secret: string) {
  const payload = base64Url(new TextEncoder().encode(JSON.stringify({
    id,
    email,
    kind: 'unsubscribe',
    exp: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
  })));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return `${payload}.${base64Url(new Uint8Array(signature))}`;
}

async function authenticateAdmin(request: Request, supabaseUrl: string, anonKey: string) {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return { error: 'Sign in as an administrator to continue.' };

  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const [{ data: { user }, error: userError }, { data: assurance, error: assuranceError }] = await Promise.all([
    client.auth.getUser(),
    client.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (userError || !user) return { error: 'Your sign-in session is invalid or expired.' };
  if (user.app_metadata?.role !== 'super_admin') return { error: 'Super Admin access is required.' };
  if (assuranceError || assurance.currentLevel !== 'aal2') {
    return { error: 'Verify your authenticator before using administrator features.' };
  }
  return { user };
}

async function listAllUsers(adminClient: ReturnType<typeof createClient>) {
  const users = [];
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 100) return users;
  }
  throw new Error('User directory exceeds the 5,000-account management limit.');
}

async function auditAdminAction(
  adminClient: ReturnType<typeof createClient>,
  actorId: string,
  action: string,
  resourceType: string,
  resourceId?: string,
) {
  const { error } = await adminClient.from('admin_audit_log').insert({
    actor_id: actorId,
    action,
    resource_type: resourceType,
    resource_id: resourceId ?? null,
  });
  if (error) {
    console.error('Could not write an administrator audit event.', error);
    return false;
  }
  return true;
}

function auditWarning(audited: boolean) {
  return audited ? undefined : 'The action completed, but its audit event could not be saved. Check the Supabase logs.';
}

function emailShell(subject: string, body: string, unsubscribeUrl: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f6f5;font-family:Arial,sans-serif;color:#24312b"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #e3e9e5;border-radius:12px"><tr><td style="padding:32px"><p style="margin:0 0 12px;color:#527362;font-weight:bold;letter-spacing:1px;font-size:12px">SUSHIL POKHAREL</p><h1 style="font-size:23px;margin:0 0 18px">${escapeHtml(subject)}</h1><div style="font-size:15px;line-height:1.75;color:#52615a">${body}</div><p style="font-size:12px;line-height:1.6;color:#78837d;margin:26px 0 0">You received this update because you subscribed to emails from ${siteOrigin}. <a href="${unsubscribeUrl}" style="color:#315648">Unsubscribe</a>.</p></td></tr></table></td></tr></table></body></html>`;
}

async function sendNewsletter(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  subject: string,
  body: string,
  campaignId?: string,
) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('NEWSLETTER_FROM_EMAIL');
  const tokenSecret = Deno.env.get('NEWSLETTER_TOKEN_SECRET');
  if (!apiKey || !from || !tokenSecret || tokenSecret.length < 32) {
    throw new Error('Newsletter delivery is not configured with a sufficiently long token secret.');
  }

  const { data: subscribers, error: subscriberError } = await adminClient
    .from('subscribers')
    .select('id, email')
    .eq('status', 'subscribed')
    .order('created_at', { ascending: true })
    .limit(5000);
  if (subscriberError) throw subscriberError;
  if (subscribers.length === 0) return { sent: 0 };

  const campaignQuery = campaignId
    ? adminClient.from('newsletter_campaigns')
      .update({ subject, body, status: 'sending', recipient_count: 0, sent_by: userId })
      .eq('id', campaignId).eq('status', 'draft')
    : adminClient.from('newsletter_campaigns')
      .insert({ subject, body, status: 'sending', recipient_count: 0, sent_by: userId });
  const { data: campaign, error: campaignError } = await campaignQuery.select('id').single();
  if (campaignError) throw campaignError;

  let sent = 0;
  try {
    const htmlBody = body.split(/\r?\n/).map((line) => escapeHtml(line) || '&nbsp;').join('<br>');
    for (let start = 0; start < subscribers.length; start += 100) {
      const batch = await Promise.all(subscribers.slice(start, start + 100).map(async (subscriber) => {
        const token = await signNewsletterToken(subscriber.email, subscriber.id, tokenSecret);
        const unsubscribeUrl = `${siteOrigin}/newsletter?token=${encodeURIComponent(token)}&action=unsubscribe`;
        return {
          from,
          to: [subscriber.email],
          subject,
          html: emailShell(subject, htmlBody, unsubscribeUrl),
        };
      }));
      const providerResponse = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(20_000),
      });
      if (!providerResponse.ok) {
        console.error('Newsletter provider rejected a campaign batch.', providerResponse.status);
        throw new Error('Email provider rejected a newsletter batch.');
      }
      sent += batch.length;
    }

    const { error: updateError } = await adminClient.from('newsletter_campaigns')
      .update({ status: 'sent', recipient_count: sent, sent_at: new Date().toISOString() })
      .eq('id', campaign.id);
    if (updateError) throw updateError;
    return { sent };
  } catch (error) {
    const { error: updateError } = await adminClient.from('newsletter_campaigns')
      .update({ status: 'failed', recipient_count: sent })
      .eq('id', campaign.id);
    if (updateError) console.error('Could not mark the newsletter campaign as failed.', updateError);
    throw error;
  }
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
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('Admin platform function is missing Supabase configuration.');
    return jsonResponse({ error: 'Admin service is not configured.' }, 503, origin);
  }

  const auth = await authenticateAdmin(request, supabaseUrl, anonKey);
  if ('error' in auth) return jsonResponse({ error: auth.error }, 403, origin);
  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ error: 'Request must contain valid JSON.' }, 400, origin);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (input.action === 'dashboard') {
      const [
        users,
        pendingPosts,
        approvedPosts,
        subscribers,
        views,
        dailyViews,
      ] = await Promise.all([
        listAllUsers(adminClient),
        adminClient.from('user_posts').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        adminClient.from('user_posts').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
        adminClient.from('subscribers').select('id', { count: 'exact', head: true }).eq('status', 'subscribed'),
        adminClient.from('page_views').select('id', { count: 'exact', head: true })
          .gte('viewed_on', new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
        adminClient.from('page_views').select('visitor_hash, viewed_on')
          .gte('viewed_on', new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
          .limit(10000),
      ]);
      for (const result of [pendingPosts, approvedPosts, subscribers, views, dailyViews]) {
        if (result.error) throw result.error;
      }
      const activeSince = Date.now() - 15 * 60 * 1000;
      const trafficByDay = new Map<string, Set<string>>();
      for (const view of dailyViews.data) {
        if (!trafficByDay.has(view.viewed_on)) trafficByDay.set(view.viewed_on, new Set());
        trafficByDay.get(view.viewed_on)?.add(view.visitor_hash);
      }
      return jsonResponse({
        metrics: {
          totalUsers: users.length,
          activeSessionsEstimate: users.filter((item) => item.last_sign_in_at && new Date(item.last_sign_in_at).getTime() >= activeSince).length,
          pendingPosts: pendingPosts.count ?? 0,
          approvedPosts: approvedPosts.count ?? 0,
          newsletterSubscribers: subscribers.count ?? 0,
          uniquePageViewsLast30Days: views.count ?? 0,
          dailyTraffic: Array.from(trafficByDay, ([date, visitors]) => ({
            date,
            uniqueVisitors: visitors.size,
          })).sort((left, right) => left.date.localeCompare(right.date)),
          activeSessionsNote: 'Estimate based on sign-ins in the last 15 minutes; not a live session count.',
          uptimeNote: 'No uptime-monitoring provider is configured.',
        },
      }, 200, origin);
    }

    if (input.action === 'audit-log') {
      const { data, error } = await adminClient.from('admin_audit_log')
        .select('id, actor_id, action, resource_type, resource_id, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return jsonResponse({ events: data }, 200, origin);
    }

    if (input.action === 'users') {
      const page = Number.isInteger(input.page) && Number(input.page) >= 1 ? Number(input.page) : 1;
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 100 });
      if (error) throw error;
      return jsonResponse({
        users: data.users.map((item) => ({
          id: item.id,
          email: item.email ?? '',
          role: item.app_metadata?.role === 'super_admin' ? 'super_admin' : 'user',
          confirmed: Boolean(item.email_confirmed_at ?? item.confirmed_at),
          banned: Boolean(item.banned_until && new Date(item.banned_until).getTime() > Date.now()),
          createdAt: item.created_at,
          lastSignInAt: item.last_sign_in_at,
        })),
        page,
        hasMore: data.users.length === 100,
      }, 200, origin);
    }

    if (input.action === 'newsletter-campaigns') {
      const { data, error } = await adminClient.from('newsletter_campaigns')
        .select('id, subject, body, status, recipient_count, sent_at, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return jsonResponse({ campaigns: data }, 200, origin);
    }

    if (input.action === 'save-newsletter-draft') {
      const subject = typeof input.subject === 'string' ? input.subject.trim() : '';
      const body = typeof input.body === 'string' ? input.body.trim() : '';
      if (subject.length < 3 || subject.length > 200 || body.length < 1 || body.length > 20_000) {
        return jsonResponse({ error: 'Enter a subject (3-200 characters) and message (up to 20,000 characters).' }, 400, origin);
      }
      const campaignId = typeof input.campaignId === 'string' ? input.campaignId : undefined;
      if (campaignId && !/^[0-9a-f-]{36}$/i.test(campaignId)) {
        return jsonResponse({ error: 'Choose a valid newsletter draft.' }, 400, origin);
      }
      const campaignQuery = campaignId
        ? adminClient.from('newsletter_campaigns')
          .update({ subject, body, sent_by: auth.user.id })
          .eq('id', campaignId).eq('status', 'draft')
        : adminClient.from('newsletter_campaigns')
          .insert({ subject, body, status: 'draft', sent_by: auth.user.id });
      const { data, error } = await campaignQuery.select('id').single();
      if (error) throw error;
      const audited = await auditAdminAction(adminClient, auth.user.id, 'newsletter_draft_saved', 'newsletter_campaign', data.id);
      return jsonResponse({
        ok: true,
        campaignId: data.id,
        auditWarning: auditWarning(audited),
      }, 200, origin);
    }

    if (input.action === 'user-management') {
      const { targetUserId, operation } = input;
      if (typeof targetUserId !== 'string' || !/^[0-9a-f-]{36}$/i.test(targetUserId) ||
        !['promote', 'demote', 'ban', 'unban', 'delete'].includes(String(operation))) {
        return jsonResponse({ error: 'Choose a valid user and management action.' }, 400, origin);
      }
      if (targetUserId === auth.user.id) return jsonResponse({ error: 'You cannot change or delete your own administrator account here.' }, 400, origin);
      const { data: target, error: targetError } = await adminClient.auth.admin.getUserById(targetUserId);
      if (targetError || !target.user) return jsonResponse({ error: 'The selected account was not found.' }, 404, origin);
      const targetIsSuperAdmin = target.user.app_metadata?.role === 'super_admin';
      if ((operation === 'demote' || operation === 'delete' || operation === 'ban') && targetIsSuperAdmin) {
        const users = await listAllUsers(adminClient);
        const now = Date.now();
        const otherAvailableSuperAdmins = users.filter((item) =>
          item.id !== targetUserId &&
          item.app_metadata?.role === 'super_admin' &&
          (!item.banned_until || new Date(item.banned_until).getTime() <= now),
        );
        if (otherAvailableSuperAdmins.length === 0) {
          return jsonResponse({ error: 'At least one available Super Admin must remain.' }, 409, origin);
        }
      }
      if (operation === 'promote') {
        const verifiedTotp = target.user.factors?.some((factor) => factor.factor_type === 'totp' && factor.status === 'verified');
        if (!(target.user.email_confirmed_at ?? target.user.confirmed_at) || !verifiedTotp) {
          return jsonResponse({ error: 'Promote only an email-confirmed account with verified authenticator MFA.' }, 400, origin);
        }
      }
      if (operation === 'delete') {
        const { error } = await adminClient.auth.admin.deleteUser(targetUserId);
        if (error) throw error;
      } else if (operation === 'ban' || operation === 'unban') {
        const { error } = await adminClient.auth.admin.updateUserById(targetUserId, {
          ban_duration: operation === 'ban' ? '876000h' : 'none',
        });
        if (error) throw error;
      } else {
        const appMetadata = target.user.app_metadata ?? {};
        const { error } = await adminClient.auth.admin.updateUserById(targetUserId, {
          app_metadata: { ...appMetadata, role: operation === 'promote' ? 'super_admin' : 'user' },
        });
        if (error) throw error;
      }
      const audited = await auditAdminAction(
        adminClient,
        auth.user.id,
        `user_${operation}`,
        'user',
        targetUserId,
      );
      return jsonResponse({ ok: true, auditWarning: auditWarning(audited) }, 200, origin);
    }

    if (input.action === 'send-newsletter') {
      const subject = typeof input.subject === 'string' ? input.subject.trim() : '';
      const body = typeof input.body === 'string' ? input.body.trim() : '';
      if (subject.length < 3 || subject.length > 200 || body.length < 1 || body.length > 20_000) {
        return jsonResponse({ error: 'Enter a subject (3-200 characters) and message (up to 20,000 characters).' }, 400, origin);
      }
      const campaignId = typeof input.campaignId === 'string' ? input.campaignId : undefined;
      if (campaignId && !/^[0-9a-f-]{36}$/i.test(campaignId)) {
        return jsonResponse({ error: 'Choose a valid newsletter draft.' }, 400, origin);
      }
      const result = await sendNewsletter(adminClient, auth.user.id, subject, body, campaignId);
      const audited = await auditAdminAction(
        adminClient,
        auth.user.id,
        'newsletter_sent',
        'newsletter_campaign',
        campaignId,
      );
      return jsonResponse({ ok: true, sent: result.sent, auditWarning: auditWarning(audited) }, 200, origin);
    }

    return jsonResponse({ error: 'Unsupported admin action.' }, 400, origin);
  } catch (error) {
    console.error('Admin platform request failed.', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Admin request failed.' }, 500, origin);
  }
});
