import './load-env.js';

const requestTimeoutMs = 10_000;

function getProjectUrl(value = process.env.SUPABASE_URL) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Set SUPABASE_URL to your Supabase project URL.');
  }

  if (
    url.protocol !== 'https:' ||
    !/^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new TypeError('SUPABASE_URL must be an HTTPS Supabase project URL.');
  }
  return url;
}

function getServiceRoleKey(value = process.env.SUPABASE_SERVICE_ROLE_KEY) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Set SUPABASE_SERVICE_ROLE_KEY in the trusted local MCP server environment.');
  }
  return value.trim();
}

async function adminRequest({ projectUrl, serviceRoleKey, path, method = 'GET', body, fetchImpl }) {
  const headers = {
    accept: 'application/json',
    apikey: serviceRoleKey,
    authorization: ['Bearer ', serviceRoleKey].join(''),
  };
  if (body) headers['content-type'] = 'application/json';

  const response = await fetchImpl(new URL(path, projectUrl), {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
    redirect: 'manual',
    signal: AbortSignal.timeout(requestTimeoutMs),
  });

  if (response.status >= 300 && response.status < 400) {
    throw new Error('Supabase redirected an authenticated admin request; redirects are not allowed.');
  }
  if (!response.ok) {
    throw new Error(`Supabase Auth Admin API rejected the request (HTTP ${response.status}). Check the local service-role key and project permissions.`);
  }
  return response.json();
}

export async function grantSiteAdmin(
  { email, confirmationEmail },
  { supabaseUrl, serviceRoleKey } = {},
  fetchImpl = fetch,
) {
  const projectUrl = getProjectUrl(supabaseUrl);
  const key = getServiceRoleKey(serviceRoleKey);
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new TypeError('email must be a valid account email address.');
  }
  if (typeof confirmationEmail !== 'string' || confirmationEmail.trim().toLowerCase() !== email.trim().toLowerCase()) {
    throw new TypeError('confirmationEmail must exactly match email to confirm the administrator change.');
  }

  const normalizedEmail = email.trim().toLowerCase();
  let targetUser = null;
  for (let page = 1; page <= 100; page += 1) {
    const result = await adminRequest({
      projectUrl,
      serviceRoleKey: key,
      path: `/auth/v1/admin/users?page=${page}&per_page=100`,
      fetchImpl,
    });
    if (!Array.isArray(result.users)) {
      throw new Error('Supabase Auth Admin API returned an unexpected users response.');
    }
    targetUser = result.users.find((user) => user.email?.toLowerCase() === normalizedEmail) ?? null;
    if (targetUser || result.users.length < 100) break;
  }

  if (!targetUser) throw new Error('No Supabase account with that email was found.');
  if (!targetUser.email_confirmed_at && !targetUser.confirmed_at) {
    throw new Error('Confirm this account email before granting administrator access.');
  }
  const hasVerifiedTotp = Array.isArray(targetUser.factors) && targetUser.factors.some(
    (factor) => factor.factor_type === 'totp' && factor.status === 'verified',
  );
  if (!hasVerifiedTotp) {
    throw new Error('This account must enroll and verify an authenticator before it can become an administrator.');
  }

  const appMetadata = targetUser.app_metadata && typeof targetUser.app_metadata === 'object'
    ? targetUser.app_metadata
    : {};
  const result = await adminRequest({
    projectUrl,
    serviceRoleKey: key,
    path: `/auth/v1/admin/users/${encodeURIComponent(targetUser.id)}`,
    method: 'PUT',
    body: {
      app_metadata: { ...appMetadata, role: 'admin' },
    },
    fetchImpl,
  });

  return {
    updated: true,
    userId: result.user?.id ?? targetUser.id,
    email: result.user?.email ?? targetUser.email,
    role: result.user?.app_metadata?.role ?? 'admin',
    note: 'Sign out and sign back in to receive an updated administrator token.',
  };
}
