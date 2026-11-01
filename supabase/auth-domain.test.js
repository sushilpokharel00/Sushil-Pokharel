import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const config = await readFile(new URL('supabase/config.toml', root), 'utf8');
const confirmationTemplate = await readFile(new URL('supabase/templates/confirmation.html', root), 'utf8');
const recoveryTemplate = await readFile(new URL('supabase/templates/password-recovery.html', root), 'utf8');
const passwordChangedTemplate = await readFile(new URL('supabase/templates/password-changed-notification.html', root), 'utf8');
const capacitorConfig = JSON.parse(await readFile(new URL('capacitor.config.json', root), 'utf8'));
const androidManifest = await readFile(new URL('android/app/src/main/AndroidManifest.xml', root), 'utf8');
const cname = (await readFile(new URL('CNAME', root), 'utf8')).trim();

test('Supabase Auth uses only the production site and account redirect', () => {
  assert.match(config, /site_url = "https:\/\/sushilpokhrel00\.com\.np"/);
  assert.match(config, /additional_redirect_urls = \["https:\/\/sushilpokhrel00\.com\.np\/account"\]/);
  assert.doesNotMatch(config, /localhost|127\.0\.0\.1/i);
  assert.doesNotMatch(config, /sushilpokharel\.com\.np|sushilpokharel00\.com\.np/i);
});

test('configured email template paths resolve relative to the Supabase directory', async () => {
  for (const templatePath of config.matchAll(/content_path = "\.\/([^"]+)"/g)) {
    await assert.doesNotReject(readFile(new URL(`supabase/${templatePath[1]}`, root)));
  }
  assert.match(config, /content_path = "\.\/templates\/confirmation\.html"/);
  assert.match(config, /content_path = "\.\/templates\/password-recovery\.html"/);
  assert.match(config, /content_path = "\.\/templates\/password-changed-notification\.html"/);
});

test('auth email templates use Supabase confirmation links and the production domain', () => {
  assert.match(confirmationTemplate, /href="\{\{ \.ConfirmationURL \}\}"/);
  assert.match(recoveryTemplate, /href="\{\{ \.ConfirmationURL \}\}"/);
  for (const template of [confirmationTemplate, recoveryTemplate, passwordChangedTemplate]) {
    assert.match(template, /https:\/\/sushilpokhrel00\.com\.np\/account/);
    assert.doesNotMatch(template, /localhost|sushilpokharel\.com\.np|sushilpokharel00\.com\.np/i);
  }
});

test('web hosting and Android use the production domain for app links and redirects', () => {
  assert.equal(cname, 'sushilpokhrel00.com.np');
  assert.equal(capacitorConfig.server.url, 'https://sushilpokhrel00.com.np/');
  assert.deepEqual(capacitorConfig.server.allowNavigation, [
    'sushilpokhrel00.com.np',
    'www.sushilpokhrel00.com.np',
  ]);
  assert.match(androidManifest, /android:host="sushilpokhrel00\.com\.np"/);
  assert.match(androidManifest, /android:host="www\.sushilpokhrel00\.com\.np"/);
  assert.doesNotMatch(androidManifest, /sushilpokharel\.com\.np/i);
});
