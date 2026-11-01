import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const config = await readFile(new URL('supabase/config.toml', root), 'utf8');
const authPage = await readFile(new URL('src/AuthPage.jsx', root), 'utf8');
const appTemplate = await readFile(new URL('app.html', root), 'utf8');
const confirmationTemplate = await readFile(new URL('supabase/templates/confirmation.html', root), 'utf8');
const recoveryTemplate = await readFile(new URL('supabase/templates/password-recovery.html', root), 'utf8');
const passwordChangedTemplate = await readFile(new URL('supabase/templates/password-changed-notification.html', root), 'utf8');
const capacitorConfig = JSON.parse(await readFile(new URL('capacitor.config.json', root), 'utf8'));
const androidManifest = await readFile(new URL('android/app/src/main/AndroidManifest.xml', root), 'utf8');
const cname = (await readFile(new URL('CNAME', root), 'utf8')).trim();

test('Supabase Auth uses the official production site and explicit account redirects', () => {
  assert.match(config, /site_url = "https:\/\/sushilpokharel00\.com\.np"/);
  assert.match(config, /"https:\/\/sushilpokharel00\.com\.np\/account"/);
  assert.match(config, /"https:\/\/sushilpokharel00\.com\.np\/reset-password"/);
  assert.doesNotMatch(config, /https?:\/\/(?!sushilpokharel00\.com\.np)/i);
});

test('configured email template paths resolve relative to the repository root', async () => {
  for (const templatePath of config.matchAll(/content_path = "\.\/([^"]+)"/g)) {
    await assert.doesNotReject(readFile(new URL(templatePath[1], root)));
  }
  assert.match(config, /content_path = "\.\/supabase\/templates\/confirmation\.html"/);
  assert.match(config, /content_path = "\.\/supabase\/templates\/password-recovery\.html"/);
  assert.match(config, /content_path = "\.\/supabase\/templates\/password-changed-notification\.html"/);
});

test('auth email templates use Supabase confirmation links and the production domain', () => {
  assert.match(confirmationTemplate, /href="\{\{ \.ConfirmationURL \}\}"/);
  assert.match(recoveryTemplate, /\{\{ \.Token \}\}/);
  assert.doesNotMatch(recoveryTemplate, /\.ConfirmationURL/);
  assert.match(confirmationTemplate, /https:\/\/sushilpokharel00\.com\.np\/account/);
  assert.match(recoveryTemplate, /https:\/\/sushilpokharel00\.com\.np\/reset-password/);
  assert.match(passwordChangedTemplate, /https:\/\/sushilpokharel00\.com\.np\/account/);
  for (const template of [confirmationTemplate, recoveryTemplate, passwordChangedTemplate]) {
    assert.doesNotMatch(template, /https?:\/\/(?!sushilpokharel00\.com\.np)/i);
  }
});

test('password recovery sends and verifies Supabase recovery OTPs', () => {
  assert.match(authPage, /resetPasswordForEmail\(email\.trim\(\)/);
  assert.match(
    authPage,
    /verifyOtp\(\{\s*email:\s*email\.trim\(\),\s*token:\s*recoveryOtp,\s*type:\s*'recovery'/,
  );
  assert.match(authPage, /setRecoveryResendSeconds\(60\)/);
  assert.match(authPage, /pattern="\[0-9\]\{6\}"/);
  assert.match(appTemplate, /replaceState\(null, '', `\/reset-password/);
});

test('web hosting and Android use the production domain for app links and redirects', () => {
  assert.equal(cname, 'sushilpokharel00.com.np');
  assert.equal(capacitorConfig.server.url, 'https://sushilpokharel00.com.np/');
  assert.deepEqual(capacitorConfig.server.allowNavigation, ['sushilpokharel00.com.np']);
  assert.match(androidManifest, /android:host="sushilpokharel00\.com\.np"/);
});
