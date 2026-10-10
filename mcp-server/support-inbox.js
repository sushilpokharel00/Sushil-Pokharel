import './load-env.js';

const supportFields = 'id,user_id,requester_email,subject,message,admin_reply,created_at,replied_at';

export class SupportInboxError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SupportInboxError';
    this.code = code;
  }
}

function getProjectUrl(value = process.env.SUPABASE_URL) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new SupportInboxError('configuration_missing', 'Set SUPABASE_URL to your Supabase project URL.');
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
    throw new SupportInboxError('configuration_invalid', 'SUPABASE_URL must be an HTTPS Supabase project URL.');
  }
  return url;
}

function getServiceRoleKey(value = process.env.SUPABASE_SERVICE_ROLE_KEY) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new SupportInboxError('write_key_missing', 'Set SUPABASE_SERVICE_ROLE_KEY in the trusted local MCP server environment to manage support requests.');
  }
  return value.trim();
}

async function requestSupportRows({ projectUrl, key, method, requestId, body, fetchImpl }) {
  const endpoint = new URL('/rest/v1/support_requests', projectUrl);
  endpoint.searchParams.set('select', supportFields);
  endpoint.searchParams.set('order', 'created_at.desc');
  if (requestId) endpoint.searchParams.set('id', `eq.${requestId}`);
  if (method === 'GET') endpoint.searchParams.set('limit', '100');

  const response = await fetchImpl(endpoint, {
    method,
    headers: {
      accept: 'application/json',
      apikey: key,
      authorization: `Bearer ${key}`,
      ...(body ? { 'content-type': 'application/json', prefer: 'return=representation' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
  });

  if (response.status >= 300 && response.status < 400) {
    throw new SupportInboxError('redirect_rejected', 'Supabase redirected a support-inbox request; redirects are not allowed for authenticated calls.');
  }
  if (!response.ok) {
    if (response.status === 404) {
      throw new SupportInboxError('migration_missing', 'Supabase support_requests table was not found. Apply the support requests migration.');
    }
    if (response.status === 401 || response.status === 403) {
      throw new SupportInboxError('access_rejected', `Supabase rejected the MCP service-role key (HTTP ${response.status}).`);
    }
    throw new SupportInboxError('storage_unavailable', `Could not ${method === 'GET' ? 'read' : 'update'} support requests in Supabase (HTTP ${response.status}).`);
  }

  return response.json();
}

export async function listSupportRequests(
  { supabaseUrl = process.env.SUPABASE_URL, serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY } = {},
  fetchImpl = fetch,
) {
  const rows = await requestSupportRows({
    projectUrl: getProjectUrl(supabaseUrl),
    key: getServiceRoleKey(serviceRoleKey),
    method: 'GET',
    fetchImpl,
  });
  if (!Array.isArray(rows)) throw new Error('Supabase returned an unexpected support-inbox response.');
  return {
    configured: true,
    requests: rows,
    limit: 100,
  };
}

export async function replyToSupportRequest(
  { requestId, reply },
  {
    supabaseUrl = process.env.SUPABASE_URL,
    serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY,
  } = {},
  fetchImpl = fetch,
) {
  if (typeof requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    throw new TypeError('requestId must be a valid UUID.');
  }
  if (typeof reply !== 'string' || reply.trim().length < 1 || reply.trim().length > 3000) {
    throw new TypeError('reply must contain between 1 and 3000 characters.');
  }

  const rows = await requestSupportRows({
    projectUrl: getProjectUrl(supabaseUrl),
    key: getServiceRoleKey(serviceRoleKey),
    method: 'PATCH',
    requestId,
    body: {
      admin_reply: reply.trim(),
      replied_at: new Date().toISOString(),
    },
    fetchImpl,
  });
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error('No support request was updated. Check the request ID and apply the support requests migration.');
  }
  return {
    configured: true,
    updated: true,
    request: rows[0],
  };
}
