import { createClient } from '@supabase/supabase-js';
import { seedSuperAdmin } from './super-admin-seeder.js';

try {
  const result = await seedSuperAdmin(process.env, (url, key) => createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }));
  console.log(`Super Admin ${result.action}: ${result.email} (${result.role}).`);
  if (result.action === 'created') {
    console.log('The initial password was set through Supabase Auth. Enroll and verify TOTP MFA before accessing /admin.');
  } else {
    console.log('Existing password was not changed. Sign out and back in to refresh the role claim.');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Super Admin seeding failed.');
  process.exitCode = 1;
}
