import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const config = await readFile(new URL('supabase/config.toml', root), 'utf8');
const confirmationTemplate = await readFile(new URL('supabase/templates/confirmation.html', root), 'utf8');
const recoveryTemplate = await readFile(new URL('supabase/templates/password-recovery.html', root), 'utf8');
const passwordChangedTemplate = await readFile(new URL('supabase/templates/password-changed-notification.html', root), 'utf8');

test('Supabase Auth uses only the production site and account redirect', () => {
  assert.match(config, /site_url = "https:\/\/sushilpokharel\.com\.np"/);
  assert.match(config, /additional_redirect_urls = \["https:\/\/sushilpokharel\.com\.np\/account"\]/);
  assert.doesNotMatch(config, /localhost|127\.0\.0\.1/i);
});

test('auth email templates use Supabase confirmation links and the production domain', () => {
  assert.match(confirmationTemplate, /href="\{\{ \.ConfirmationURL \}\}"/);
  assert.match(recoveryTemplate, /href="\{\{ \.ConfirmationURL \}\}"/);
  for (const template of [confirmationTemplate, recoveryTemplate, passwordChangedTemplate]) {
    assert.match(template, /https:\/\/sushilpokharel\.com\.np\/account/);
    assert.doesNotMatch(template, /localhost|sushilpokharel00\.com\.np/i);
  }
});
