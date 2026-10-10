import React, { useEffect, useState } from 'react';
import { sitePath } from './site-path.js';
import { supabase } from './lib/supabase.js';

function setPageMetadata(title, description) {
  document.title = title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', description);
}

function LoadingState({ children }) {
  return (
    <div className="support-loading" role="status">
      <span className="loading-spinner" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export default function SupportPage() {
  const [state, setState] = useState('loading');
  const [requests, setRequests] = useState([]);
  const [supportOnline, setSupportOnline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    setPageMetadata('Support | Sushil Pokharel', 'Contact the support team and follow replies to your requests.');
    let isMounted = true;

    async function loadSupport() {
      if (!supabase) {
        setState('unconfigured');
        return;
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        setState('signed-out');
        return;
      }

      const [requestResult, settingsResult] = await Promise.all([
        supabase
          .from('support_requests')
          .select('id, subject, message, admin_reply, created_at, replied_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('site_settings')
          .select('support_online')
          .eq('id', 1)
          .single(),
      ]);
      if (requestResult.error) throw requestResult.error;
      if (settingsResult.error) throw settingsResult.error;

      if (isMounted) {
        setRequests(requestResult.data);
        setSupportOnline(settingsResult.data.support_online);
        setState('ready');
      }
    }

    loadSupport().catch((error) => {
      if (isMounted) {
        setState('error');
        setNotice({ kind: 'error', text: error.message || 'Could not load support requests.' });
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const subject = formData.get('subject').toString().trim();
    const message = formData.get('message').toString().trim();
    if (!subject || !message) {
      setNotice({ kind: 'error', text: 'Enter a subject and message before submitting.' });
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        setState('signed-out');
        return;
      }

      const { error } = await supabase.from('support_requests').insert({
        user_id: user.id,
        requester_email: user.email,
        subject,
        message,
      });
      if (error) throw error;

      const { data, error: refreshError } = await supabase
        .from('support_requests')
        .select('id, subject, message, admin_reply, created_at, replied_at')
        .order('created_at', { ascending: false });
      if (refreshError) throw refreshError;
      setRequests(data);
      form.reset();
      setNotice({ kind: 'success', text: 'Your request has been sent. Replies will appear here.' });
    } catch (error) {
      setNotice({ kind: 'error', text: error.message || 'Could not submit your support request.' });
    } finally {
      setBusy(false);
    }
  }

  let content;
  if (state === 'loading') {
    content = <LoadingState>Loading your support inbox…</LoadingState>;
  } else if (state === 'unconfigured') {
    content = <p className="auth-description">Account support is unavailable because sign-in has not been configured.</p>;
  } else if (state === 'signed-out') {
    content = (
      <>
        <p className="auth-description">Sign in to send a private support request and see replies from the support team.</p>
        <a className="auth-submit admin-inline-link" href={sitePath('/account')}>Sign in to continue</a>
      </>
    );
  } else if (state === 'error') {
    content = <p className="auth-description">The support inbox could not be loaded. Check that the support-request migration has been applied, then try again.</p>;
  } else {
    content = (
      <>
        <div className="support-status">
          <span className={`support-status-dot ${supportOnline ? 'is-online' : ''}`} aria-hidden="true" />
          Support team is {supportOnline ? 'online' : 'offline'}
        </div>
        <p className="auth-description">
          {supportOnline
            ? 'Send us a message. The team is online and will reply as soon as possible.'
            : 'The team is currently away. You can still send a request and read the reply here when it is ready.'}
        </p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="support-subject">Subject</label>
            <input id="support-subject" name="subject" maxLength={120} required />
          </div>
          <div className="auth-field">
            <label htmlFor="support-message">How can we help?</label>
            <textarea id="support-message" name="message" rows={5} maxLength={3000} required />
          </div>
          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? 'Sending request…' : 'Send support request'}
          </button>
        </form>
        <section className="support-inbox" aria-labelledby="support-inbox-title">
          <h2 id="support-inbox-title">Your requests</h2>
          {requests.length === 0 ? (
            <p className="support-empty">Your submitted requests and replies will appear here.</p>
          ) : (
            <ul className="support-request-list">
              {requests.map((request) => (
                <li className="support-request" key={request.id}>
                  <div className="support-request-heading">
                    <h3>{request.subject}</h3>
                    <span>{request.admin_reply ? 'Replied' : 'Awaiting reply'}</span>
                  </div>
                  <p className="support-request-message">{request.message}</p>
                  {request.admin_reply && (
                    <div className="support-reply">
                      <strong>Support team reply</strong>
                      <p>{request.admin_reply}</p>
                    </div>
                  )}
                  <time dateTime={request.created_at}>{new Date(request.created_at).toLocaleString()}</time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </>
    );
  }

  return (
    <main className="auth-page support-page">
      <section className="auth-card support-card" aria-live="polite">
        <span className="auth-eyebrow">SUPPORT</span>
        <h1>How can we help?</h1>
        {notice && <p className={`auth-notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
        {content}
        <a className="auth-home-link" href={sitePath('/')}>Return to website</a>
      </section>
    </main>
  );
}
