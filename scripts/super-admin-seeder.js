import { getPasswordPolicyError } from '../src/lib/password-policy.js';

export const DEFAULT_SUPER_ADMIN_EMAIL = 'admin@yourdomain.com';
const MAX_USERS = 5000;

function getProjectUrl(value) {
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
  return url.toString().replace(/\/$/, '');
}

function getServiceRoleKey(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Set SUPABASE_SERVICE_ROLE_KEY in the trusted seeder environment.');
  }
  return value.trim();
}

function getAdminEmail(value = DEFAULT_SUPER_ADMIN_EMAIL) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new TypeError('SUPER_ADMIN_EMAIL must be a valid email address.');
  }
  return email;
}

async function findUserByEmail(adminClient, email) {
  for (let page = 1; page <= MAX_USERS / 100; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const user = data.users.find((item) => item.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 100) return null;
  }
  throw new Error('Auth user directory exceeds the 5,000-account seeder limit.');
}

export async function seedSuperAdmin(environment, createAdminClient) {
  const projectUrl = getProjectUrl(environment.SUPABASE_URL);
  const serviceRoleKey = getServiceRoleKey(environment.SUPABASE_SERVICE_ROLE_KEY);
  const email = getAdminEmail(environment.SUPER_ADMIN_EMAIL);
  const adminClient = createAdminClient(projectUrl, serviceRoleKey);
  const existingUser = await findUserByEmail(adminClient, email);

  if (!existingUser) {
    const password = environment.SUPER_ADMIN_PASSWORD;
    if (typeof password !== 'string' || password.length < 16 || getPasswordPolicyError(password)) {
      throw new Error(
        'For a new Super Admin, set SUPER_ADMIN_PASSWORD to at least 16 characters with uppercase, lowercase, a number, and a symbol.',
      );
    }

    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: 'super_admin' },
    });
    if (error) throw new Error(`Could not create the Super Admin account: ${error.message}`);
    if (!data.user) throw new Error('Supabase Auth did not return the created Super Admin account.');
    return { action: 'created', email, role: 'super_admin' };
  }

  if (!(existingUser.email_confirmed_at ?? existingUser.confirmed_at)) {
    throw new Error('The existing Super Admin email must be confirmed before seeding its role.');
  }

  if (existingUser.app_metadata?.role === 'super_admin') {
    return { action: 'unchanged', email, role: 'super_admin' };
  }

  const { error } = await adminClient.auth.admin.updateUserById(existingUser.id, {
    app_metadata: { ...existingUser.app_metadata, role: 'super_admin' },
  });
  if (error) throw new Error(`Could not assign the Super Admin role: ${error.message}`);
  return { action: 'promoted', email, role: 'super_admin' };
}
