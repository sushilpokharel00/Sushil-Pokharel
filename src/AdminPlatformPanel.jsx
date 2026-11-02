import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';

const emptyMetrics = {
  totalUsers: 0,
  activeSessionsEstimate: 0,
  pendingPosts: 0,
  approvedPosts: 0,
  newsletterSubscribers: 0,
  uniquePageViewsLast30Days: 0,
  activeSessionsNote: '',
  uptimeNote: '',
  dailyTraffic: [],
};

export default function AdminPlatformPanel() {
  const [metrics, setMetrics] = useState(emptyMetrics);
  const [users, setUsers] = useState([]);
  const [pendingPosts, setPendingPosts] = useState([]);
  const [postEdits, setPostEdits] = useState({});
  const [announcements, setAnnouncements] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [hasMoreUsers, setHasMoreUsers] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [newsletterSubject, setNewsletterSubject] = useState('');
  const [newsletterBody, setNewsletterBody] = useState('');
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const invokeAdmin = useCallback(async (body) => {
    const { data, error } = await supabase.functions.invoke('admin-platform', { body });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboard, usersResult, postsResult, announcementsResult, campaignsResult, auditResult] = await Promise.all([
        invokeAdmin({ action: 'dashboard' }),
        invokeAdmin({ action: 'users', page: 1 }),
        supabase.from('user_posts')
          .select('id, user_id, title, content, category, featured_image_path, status, moderation_note, featured, created_at')
          .eq('status', 'pending').order('created_at', { ascending: true }).limit(100),
        supabase.from('announcements')
          .select('id, title, body, published, published_at, created_at')
          .order('created_at', { ascending: false }).limit(50),
        invokeAdmin({ action: 'newsletter-campaigns' }),
        invokeAdmin({ action: 'audit-log' }),
      ]);
      if (postsResult.error) throw postsResult.error;
      if (announcementsResult.error) throw announcementsResult.error;
      const postsWithImages = await Promise.all(postsResult.data.map(async (post) => {
        if (!post.featured_image_path) return { ...post, featured_image_url: '' };
        const { data, error } = await supabase.storage
          .from('user-post-images')
          .createSignedUrl(post.featured_image_path, 3600);
        if (error) throw error;
        return { ...post, featured_image_url: data.signedUrl };
      }));
      setMetrics(dashboard.metrics);
      setUsers(usersResult.users);
      setUserPage(1);
      setHasMoreUsers(usersResult.hasMore);
      setPendingPosts(postsWithImages);
      setAnnouncements(announcementsResult.data);
      setCampaigns(campaignsResult.campaigns);
      setAuditLog(auditResult.events);
    } catch (error) {
      setNotice({ kind: 'error', text: error.message || 'Could not load platform data.' });
    } finally {
      setLoading(false);
    }
  }, [invokeAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!supabase) return undefined;
    const channel = supabase.channel('admin-dashboard-audit-log')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'admin_audit_log',
      }, (payload) => {
        if (!payload.new?.id) return;
        setAuditLog((current) => [
          payload.new,
          ...current.filter((event) => event.id !== payload.new.id),
        ].slice(0, 100));
      })
      .subscribe((status, error) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Live administrator audit updates are unavailable.', error);
          setNotice({ kind: 'error', text: 'Live audit updates are unavailable. Use Refresh dashboard to load recent events.' });
        }
      });

    return () => {
      supabase.removeChannel(channel).catch((error) => {
        console.error('Could not close the administrator audit subscription.', error);
      });
    };
  }, []);

  async function run(action, successMessage) {
    setBusy(true);
    setNotice(null);
    try {
      const result = await action();
      setNotice(result?.auditWarning
        ? { kind: 'error', text: `${successMessage} ${result.auditWarning}` }
        : { kind: 'success', text: successMessage });
      await loadData();
    } catch (error) {
      setNotice({ kind: 'error', text: error.message || 'The administrator action failed.' });
    } finally {
      setBusy(false);
    }
  }

  async function moderatePost(post, status, featured = false) {
    const note = status === 'rejected' ? window.prompt('Optional review note for the author:', '') : '';
    if (note === null) return;
    await run(async () => {
      const { error } = await supabase.from('user_posts').update({
        status,
        featured,
        moderation_note: note.trim() || null,
        reviewed_at: new Date().toISOString(),
      }).eq('id', post.id);
      if (error) throw error;
    }, status === 'approved' ? 'Post approved.' : 'Post rejected with a review note.');
  }

  async function savePostEdit(post) {
    const values = postEdits[post.id] ?? {
      title: post.title,
      content: post.content,
      category: post.category,
    };
    const title = values.title.trim();
    const content = values.content.trim();
    if (title.length < 3 || title.length > 160 || content.length < 20 || content.length > 20000) {
      setNotice({ kind: 'error', text: 'Use a title of 3-160 characters and content of 20-20,000 characters.' });
      return;
    }
    await run(async () => {
      const { error } = await supabase.from('user_posts')
        .update({ title, content, category: values.category })
        .eq('id', post.id)
        .eq('status', 'pending');
      if (error) throw error;
    }, 'Post edits saved.');
  }

  async function handleAnnouncement(event) {
    event.preventDefault();
    await run(async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Sign in again before publishing an announcement.');
      const { error } = await supabase.from('announcements').insert({
        title: announcementTitle.trim(),
        body: announcementBody.trim(),
        published: true,
        published_at: new Date().toISOString(),
        created_by: user.id,
      });
      if (error) throw error;
      setAnnouncementTitle('');
      setAnnouncementBody('');
    }, 'Announcement published.');
  }

  async function deleteAnnouncement(id) {
    if (!window.confirm('Delete this announcement?')) return;
    await run(async () => {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
    }, 'Announcement deleted.');
  }

  async function handleNewsletter(event) {
    event.preventDefault();
    if (!window.confirm(`Send this newsletter to ${metrics.newsletterSubscribers} confirmed subscribers?`)) return;
    await run(async () => {
      const result = await invokeAdmin({
        action: 'send-newsletter',
        campaignId: selectedCampaignId || undefined,
        subject: newsletterSubject.trim(),
        body: newsletterBody.trim(),
      });
      setNewsletterSubject('');
      setNewsletterBody('');
      setSelectedCampaignId('');
      return result;
    }, 'Newsletter sent to the confirmed subscriber list.');
  }

  async function saveNewsletterDraft() {
    await run(async () => {
      const result = await invokeAdmin({
        action: 'save-newsletter-draft',
        campaignId: selectedCampaignId || undefined,
        subject: newsletterSubject.trim(),
        body: newsletterBody.trim(),
      });
      setNewsletterSubject('');
      setNewsletterBody('');
      setSelectedCampaignId('');
      return result;
    }, 'Newsletter draft saved.');
  }

  async function loadMoreUsers() {
    setBusy(true);
    setNotice(null);
    try {
      const result = await invokeAdmin({ action: 'users', page: userPage + 1 });
      setUsers((current) => [...current, ...result.users]);
      setUserPage(result.page);
      setHasMoreUsers(result.hasMore);
    } catch (error) {
      setNotice({ kind: 'error', text: error.message || 'Could not load more accounts.' });
    } finally {
      setBusy(false);
    }
  }

  async function manageUser(user, operation) {
    const verb = operation === 'delete' ? 'permanently delete' : operation;
    if (!window.confirm(`Are you sure you want to ${verb} ${user.email}?`)) return;
    await run(async () => {
      return invokeAdmin({ action: 'user-management', targetUserId: user.id, operation });
    }, `User account ${operation} action completed.`);
  }

  return (
    <section className="admin-platform" aria-labelledby="admin-platform-title">
      <header className="admin-inbox-heading">
        <div>
          <span className="auth-eyebrow">PLATFORM MANAGEMENT</span>
          <h2 id="admin-platform-title">Platform dashboard</h2>
        </div>
        <button className="auth-secondary" type="button" onClick={loadData} disabled={loading || busy}>
          {loading ? 'Refreshing…' : 'Refresh dashboard'}
        </button>
      </header>
      {notice && <p className={`auth-notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
      {loading ? <p role="status">Loading platform metrics…</p> : (
        <>
          <div className="admin-metric-grid">
            {[
              ['Total users', metrics.totalUsers],
              ['Recent sign-ins', metrics.activeSessionsEstimate],
              ['Posts awaiting review', metrics.pendingPosts],
              ['Approved posts', metrics.approvedPosts],
              ['Confirmed subscribers', metrics.newsletterSubscribers],
              ['Visitor-page visits · 30 days', metrics.uniquePageViewsLast30Days],
              ['System uptime', 'Not configured'],
            ].map(([label, value]) => (
              <article className="admin-metric" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
          <p className="admin-updated">
            {metrics.activeSessionsNote} {metrics.uptimeNote} Visitor counts are approximate privacy-preserving daily uniques, not audited analytics.
          </p>
          <p className="admin-updated">Device and regional breakdowns are not collected. This dashboard avoids fingerprinting and precise visitor location.</p>
          <section className="admin-platform-section" aria-labelledby="admin-traffic-title">
            <h3 id="admin-traffic-title">Daily unique visitors · last 30 days</h3>
            {metrics.dailyTraffic.length ? (
              <div className="traffic-chart" role="img" aria-label="Daily unique visitor totals for pages on this site">
                {metrics.dailyTraffic.map((day) => {
                  const peak = Math.max(...metrics.dailyTraffic.map((item) => item.uniqueVisitors), 1);
                  const height = Math.max((day.uniqueVisitors / peak) * 100, day.uniqueVisitors ? 4 : 0);
                  return (
                    <div className="traffic-day" key={day.date} title={`${day.date}: ${day.uniqueVisitors} unique visitors`}>
                      <span className="traffic-bar" style={{ height: `${height}%` }} />
                      <time dateTime={day.date}>{day.date.slice(5)}</time>
                    </div>
                  );
                })}
              </div>
            ) : <p className="support-empty">No visitor data has been recorded yet.</p>}
            <p className="admin-updated">No uptime history is available because an uptime-monitoring provider is not configured.</p>
          </section>

          <section className="admin-platform-section" aria-labelledby="admin-audit-title">
            <div className="admin-inbox-heading">
              <div><h3 id="admin-audit-title">Security and administration log</h3></div>
              <span className="admin-audit-live"><i aria-hidden="true" /> Recent events</span>
            </div>
            {auditLog.length ? (
              <div className="admin-audit-table-wrap">
                <table className="admin-audit-table">
                  <thead><tr><th scope="col">Event</th><th scope="col">Resource</th><th scope="col">Administrator</th><th scope="col">When</th></tr></thead>
                  <tbody>
                    {auditLog.map((event) => (
                      <tr key={event.id}>
                        <td><span className="admin-audit-action">{event.action.replaceAll('_', ' ')}</span></td>
                        <td>{event.resource_type}{event.resource_id ? ` · ${event.resource_id.slice(0, 8)}` : ''}</td>
                        <td>{event.actor_id ? `${event.actor_id.slice(0, 8)}…` : 'System'}</td>
                        <td><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="support-empty">No administrator actions have been recorded yet.</p>}
            <p className="admin-updated">Edge Function errors and runtime logs are available in <a href="https://supabase.com/dashboard/project/afbyphuozsdsajzngndq/logs" target="_blank" rel="noreferrer">Supabase Logs</a>.</p>
          </section>

          <section className="admin-platform-section" aria-labelledby="admin-user-management-title">
            <h3 id="admin-user-management-title">User accounts</h3>
            {users.length ? (
              <ul className="admin-platform-list">
                {users.map((user) => (
                  <li key={user.id}>
                    <div>
                      <strong>{user.email}</strong>
                      <span>{user.role} · {user.confirmed ? 'email confirmed' : 'unconfirmed'} · {user.banned ? 'banned' : 'active'}</span>
                    </div>
                    <div className="dashboard-actions">
                      {!user.confirmed && <span>Confirm email and verify MFA before granting Super Admin access.</span>}
                      {user.role === 'user'
                        ? <button className="auth-secondary" type="button" disabled={busy || !user.confirmed} onClick={() => manageUser(user, 'promote')}>Grant Super Admin</button>
                        : <button className="auth-secondary" type="button" disabled={busy} onClick={() => manageUser(user, 'demote')}>Remove Super Admin</button>}
                      {user.banned
                        ? <button className="auth-secondary" type="button" disabled={busy} onClick={() => manageUser(user, 'unban')}>Unban</button>
                        : <button className="account-delete-button" type="button" disabled={busy} onClick={() => manageUser(user, 'ban')}>Ban</button>}
                      <button className="account-delete-button" type="button" disabled={busy} onClick={() => manageUser(user, 'delete')}>Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="support-empty">No user accounts were found.</p>}
            {hasMoreUsers && <button className="auth-secondary" type="button" disabled={busy} onClick={loadMoreUsers}>Load more accounts</button>}
          </section>

          <section className="admin-platform-section" aria-labelledby="admin-post-review-title">
            <h3 id="admin-post-review-title">Post moderation</h3>
            {pendingPosts.length ? (
              <ul className="admin-platform-list">
                {pendingPosts.map((post) => (
                  <li key={post.id} className="admin-post-review">
                    <div className="admin-post-edit-fields">
                      <label>
                        <span>Title</span>
                        <input
                          value={(postEdits[post.id] ?? post).title}
                          maxLength={160}
                          onChange={(event) => setPostEdits((current) => ({
                            ...current,
                            [post.id]: { ...(current[post.id] ?? post), title: event.target.value },
                          }))}
                        />
                      </label>
                      <label>
                        <span>Category</span>
                        <select
                          value={(postEdits[post.id] ?? post).category}
                          onChange={(event) => setPostEdits((current) => ({
                            ...current,
                            [post.id]: { ...(current[post.id] ?? post), category: event.target.value },
                          }))}
                        >
                          {['announcement', 'story', 'question', 'project', 'other'].map((category) => <option key={category} value={category}>{category}</option>)}
                        </select>
                      </label>
                      <label>
                        <span>Content</span>
                        <textarea
                          value={(postEdits[post.id] ?? post).content}
                          maxLength={20000}
                          rows={5}
                          onChange={(event) => setPostEdits((current) => ({
                            ...current,
                            [post.id]: { ...(current[post.id] ?? post), content: event.target.value },
                          }))}
                        />
                      </label>
                    </div>
                    {post.featured_image_url && <img className="post-image-preview admin-post-image" src={post.featured_image_url} alt={`Featured image for ${post.title}`} />}
                    <span>Submitted {new Date(post.created_at).toLocaleString()}</span>
                    <div className="dashboard-actions">
                      <button className="auth-secondary" type="button" disabled={busy} onClick={() => savePostEdit(post)}>Save edits</button>
                      <button className="auth-submit" type="button" disabled={busy} onClick={() => moderatePost(post, 'approved')}>Approve</button>
                      <button className="auth-secondary" type="button" disabled={busy} onClick={() => moderatePost(post, 'rejected')}>Reject</button>
                      <button className="auth-secondary" type="button" disabled={busy} onClick={() => moderatePost(post, 'approved', true)}>Approve and feature</button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="support-empty">There are no posts awaiting review.</p>}
          </section>

          <section className="admin-platform-section" aria-labelledby="admin-announcements-title">
            <h3 id="admin-announcements-title">Platform announcements</h3>
            <form className="auth-form" onSubmit={handleAnnouncement}>
              <div className="auth-field">
                <label htmlFor="announcement-title">Title</label>
                <input id="announcement-title" value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} minLength={3} maxLength={160} required />
              </div>
              <div className="auth-field">
                <label htmlFor="announcement-body">Announcement</label>
                <textarea id="announcement-body" value={announcementBody} onChange={(event) => setAnnouncementBody(event.target.value)} maxLength={10000} rows={4} required />
              </div>
              <button className="auth-submit" type="submit" disabled={busy}>Publish announcement</button>
            </form>
            <ul className="admin-platform-list">
              {announcements.map((announcement) => (
                <li key={announcement.id}>
                  <div><strong>{announcement.title}</strong><span>{announcement.published ? 'Published' : 'Draft'}</span></div>
                  <button className="account-delete-button" type="button" disabled={busy} onClick={() => deleteAnnouncement(announcement.id)}>Delete</button>
                </li>
              ))}
            </ul>
          </section>

          <section className="admin-platform-section" aria-labelledby="admin-newsletter-title">
            <h3 id="admin-newsletter-title">Send a newsletter</h3>
            <p className="auth-description">Only confirmed, subscribed addresses are included. Every message includes an unsubscribe link.</p>
            <form className="auth-form" onSubmit={handleNewsletter}>
              <div className="auth-field">
                <label htmlFor="newsletter-subject">Subject</label>
                <input id="newsletter-subject" value={newsletterSubject} onChange={(event) => setNewsletterSubject(event.target.value)} minLength={3} maxLength={200} required />
              </div>
              <div className="auth-field">
                <label htmlFor="newsletter-body">Message</label>
                <textarea id="newsletter-body" value={newsletterBody} onChange={(event) => setNewsletterBody(event.target.value)} maxLength={20000} rows={6} required />
              </div>
              <div className="dashboard-actions">
                <button className="auth-secondary" type="button" disabled={busy || newsletterSubject.trim().length < 3 || !newsletterBody.trim()} onClick={saveNewsletterDraft}>Save draft</button>
                <button className="auth-submit" type="submit" disabled={busy || metrics.newsletterSubscribers === 0}>Send to {metrics.newsletterSubscribers} subscribers</button>
              </div>
            </form>
            <h4>Recent campaigns and drafts</h4>
            {campaigns.length ? (
              <ul className="admin-platform-list">
                {campaigns.map((campaign) => (
                  <li key={campaign.id}>
                    <div>
                      <strong>{campaign.subject}</strong>
                      <span>{campaign.status} · {campaign.recipient_count} recipients · {new Date(campaign.created_at).toLocaleDateString()}</span>
                    </div>
                    {campaign.status === 'draft' && (
                      <button className="auth-secondary" type="button" disabled={busy} onClick={() => {
                        setNewsletterSubject(campaign.subject);
                        setNewsletterBody(campaign.body);
                        setSelectedCampaignId(campaign.id);
                      }}>Edit draft</button>
                    )}
                  </li>
                ))}
              </ul>
            ) : <p className="support-empty">No campaigns have been saved or sent.</p>}
          </section>
        </>
      )}
    </section>
  );
}
