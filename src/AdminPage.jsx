import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';
import { sitePath } from './site-path.js';

const defaultSettings = {
  is_maintenance: true,
  maintenance_title: 'We’re making improvements.',
  maintenance_message: 'The website is temporarily under maintenance while we work on updates. There’s no confirmed reopening date yet. In the meantime, contact Sushil or request beta access.',
  support_online: false,
};

export default function AdminPage() {
  const [access, setAccess] = useState('checking');
  const [settings, setSettings] = useState(defaultSettings);
  const [requests, setRequests] = useState([]);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  async function loadSupportRequests() {
    setRequestsLoading(true);
    try {
      const { data, error } = await supabase
        .from('support_requests')
        .select('id, requester_email, subject, message, admin_reply, created_at, replied_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setRequests(data);
    } finally {
      setRequestsLoading(false);
    }
  }

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
        .select('is_maintenance, maintenance_title, maintenance_message, support_online, updated_at')
        .eq('id', 1)
        .single();
      if (error) throw error;
      await loadSupportRequests();

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
          support_online: settings.support_online,
        })
        .eq('id', 1)
        .select('is_maintenance, maintenance_title, maintenance_message, support_online, updated_at')
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

  async function handleReply(event, request) {
    event.preventDefault();
    const reply = (replyDrafts[request.id] ?? '').trim();
    if (!reply) {
      setNotice({ kind: 'error', text: 'Enter a reply before sending it.' });
      return;
    }

    setReplyingTo(request.id);
    setNotice(null);
    try {
      const { data, error } = await supabase
        .from('support_requests')
        .update({ admin_reply: reply, replied_at: new Date().toISOString() })
        .eq('id', request.id)
        .select('id, admin_reply, replied_at')
        .single();
      if (error) throw error;

      setRequests((current) => current.map((item) => (
        item.id === data.id ? { ...item, ...data } : item
      )));
      setReplyDrafts((current) => ({ ...current, [request.id]: '' }));
      setNotice({ kind: 'success', text: 'Your reply has been sent and is visible in the user’s support inbox.' });
    } catch (error) {
      setNotice({ kind: 'error', text: error.message || 'Could not send your reply.' });
    } finally {
      setReplyingTo('');
    }
  }

  let content;
  if (access === 'checking') {
    content = (
      <div className="auth-loading" role="status">
        <span className="loading-spinner" aria-hidden="true" />
        <span>Checking administrator access…</span>
      </div>
    );
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
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={settings.support_online}
              onChange={(event) => setSettings((current) => ({ ...current, support_online: event.target.checked }))}
            />
            <span>Support team is online and available</span>
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
        <section className="admin-support-inbox" aria-labelledby="admin-support-title">
          <div className="admin-inbox-heading">
            <div>
              <span className="auth-eyebrow">CUSTOMER SUPPORT</span>
              <h2 id="admin-support-title">Support requests</h2>
            </div>
            <button className="auth-secondary" type="button" onClick={() => loadSupportRequests().catch((error) => setNotice({ kind: 'error', text: error.message || 'Could not refresh support requests.' }))} disabled={requestsLoading}>
              {requestsLoading ? 'Refreshing…' : 'Refresh inbox'}
            </button>
          </div>
          <p className="auth-description">Review each request and reply here. Replies appear in the requester’s signed-in support inbox. The MCP inbox tools are also available for trusted local administration.</p>
          {requests.length === 0 ? (
            <p className="support-empty">There are no support requests yet.</p>
          ) : (
            <ul className="support-request-list">
              {requests.map((request) => (
                <li className="support-request" key={request.id}>
                  <div className="support-request-heading">
                    <h3>{request.subject}</h3>
                    <span>{request.admin_reply ? 'Replied' : 'Awaiting reply'}</span>
                  </div>
                  <p className="support-request-email">{request.requester_email}</p>
                  <p className="support-request-message">{request.message}</p>
                  {request.admin_reply && (
                    <div className="support-reply">
                      <strong>Latest reply · {request.replied_at ? new Date(request.replied_at).toLocaleString() : 'sent'}</strong>
                      <p>{request.admin_reply}</p>
                    </div>
                  )}
                  <time dateTime={request.created_at}>{new Date(request.created_at).toLocaleString()}</time>
                  <form className="admin-reply-form" onSubmit={(event) => handleReply(event, request)}>
                    <label htmlFor={`admin-reply-${request.id}`}>
                      {request.admin_reply ? 'Update reply' : 'Write a reply'}
                    </label>
                    <textarea
                      id={`admin-reply-${request.id}`}
                      value={replyDrafts[request.id] ?? ''}
                      onChange={(event) => setReplyDrafts((current) => ({ ...current, [request.id]: event.target.value }))}
                      rows={3}
                      maxLength={3000}
                      required
                    />
                    <button className="auth-submit" type="submit" disabled={replyingTo === request.id || !replyDrafts[request.id]?.trim()}>
                      {replyingTo === request.id ? 'Sending reply…' : request.admin_reply ? 'Update and send reply' : 'Send reply'}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
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
