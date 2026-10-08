import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';
import { sitePath } from './site-path.js';

const defaultSettings = {
  is_maintenance: true,
  maintenance_title: 'We’re making improvements.',
  maintenance_message: 'The website is temporarily under maintenance while we work on updates. There’s no confirmed reopening date yet. In the meantime, contact Sushil or request beta access.',
};

export default function AdminPage() {
  const [access, setAccess] = useState('checking');
  const [settings, setSettings] = useState(defaultSettings);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadAdminSettings() {
      if (!supabase) {
        if (isMounted) setAccess('unconfigured');
        return;
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        if (isMounted) setAccess('signed-out');
        return;
      }
      if (user.app_metadata?.role !== 'admin') {
        if (isMounted) setAccess('forbidden');
        return;
      }

      const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError) throw assuranceError;
      if (assurance.currentLevel !== 'aal2') {
        if (isMounted) setAccess('mfa-required');
        return;
      }

      const { data, error } = await supabase
        .from('site_settings')
        .select('is_maintenance, maintenance_title, maintenance_message, updated_at')
        .eq('id', 1)
        .single();
      if (error) throw error;

      if (isMounted) {
        setSettings(data);
        setAccess('ready');
      }
    }

    loadAdminSettings().catch((error) => {
      if (isMounted) {
        setAccess('error');
        setNotice({ kind: 'error', text: error.message || 'Could not load site settings.' });
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSave(event) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);

    try {
      const { data, error } = await supabase
        .from('site_settings')
        .update({
          is_maintenance: settings.is_maintenance,
          maintenance_title: settings.maintenance_title.trim(),
          maintenance_message: settings.maintenance_message.trim(),
        })
        .eq('id', 1)
        .select('is_maintenance, maintenance_title, maintenance_message, updated_at')
        .single();
      if (error) throw error;
      setSettings(data);
      setNotice({ kind: 'success', text: 'Your website status and message are saved.' });
    } catch (error) {
      setNotice({ kind: 'error', text: error.message || 'Could not save site settings.' });
    } finally {
      setBusy(false);
    }
  }

  let content;
  if (access === 'checking') {
    content = <p className="auth-description" role="status">Checking administrator access…</p>;
  } else if (access === 'unconfigured') {
    content = (
      <>
        <h1>Admin access is not configured</h1>
        <p className="auth-description">Configure Supabase Auth and apply the site settings migration before using the admin dashboard.</p>
      </>
    );
  } else if (access === 'signed-out') {
    content = (
      <>
        <h1>Sign in required</h1>
        <p className="auth-description">Sign in with your administrator account and authenticator to continue.</p>
        <a className="auth-submit admin-inline-link" href={sitePath('/account')}>Go to sign in</a>
      </>
    );
  } else if (access === 'forbidden') {
    content = (
      <>
        <h1>Administrator access required</h1>
        <p className="auth-description">This account is not an administrator. Only an account granted the admin role in Supabase can edit the public website status.</p>
        <a className="auth-submit admin-inline-link" href={sitePath('/account')}>Go to account security</a>
      </>
    );
  } else if (access === 'mfa-required') {
    content = (
      <>
        <h1>Authenticator verification required</h1>
        <p className="auth-description">Admin actions require a verified authenticator and a fresh two-factor sign-in. Enable MFA or sign in again through your account page.</p>
        <a className="auth-submit admin-inline-link" href={sitePath('/account')}>Go to account security</a>
      </>
    );
  } else if (access === 'ready') {
    content = (
      <>
        <span className="auth-eyebrow">SITE ADMINISTRATION</span>
        <h1>Website status</h1>
        <p className="auth-description">Edit the public home-page notice and choose whether the site is marked as under maintenance.</p>
        <form className="auth-form" onSubmit={handleSave}>
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={settings.is_maintenance}
              onChange={(event) => setSettings((current) => ({ ...current, is_maintenance: event.target.checked }))}
            />
            <span>Website is under maintenance</span>
          </label>
          <div className="auth-field">
            <label htmlFor="admin-maintenance-title">Home-page heading</label>
            <input
              id="admin-maintenance-title"
              value={settings.maintenance_title}
              onChange={(event) => setSettings((current) => ({ ...current, maintenance_title: event.target.value }))}
              maxLength={120}
              required
            />
          </div>
          <div className="auth-field">
            <label htmlFor="admin-maintenance-message">Home-page message</label>
            <textarea
              id="admin-maintenance-message"
              value={settings.maintenance_message}
              onChange={(event) => setSettings((current) => ({ ...current, maintenance_message: event.target.value }))}
              maxLength={500}
              rows={5}
              required
            />
          </div>
          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save website status'}
          </button>
        </form>
        {settings.updated_at && <p className="admin-updated">Last saved: {new Date(settings.updated_at).toLocaleString()}</p>}
      </>
    );
  } else {
    content = (
      <>
        <h1>Could not check administrator access</h1>
        <p className="auth-description">Try again after confirming that Supabase is available and the site settings migration has been applied.</p>
      </>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-live="polite">
        {notice && <p className={`auth-notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
        {content}
        <a className="auth-home-link" href={sitePath('/')}>Return to website</a>
      </section>
    </main>
  );
}
