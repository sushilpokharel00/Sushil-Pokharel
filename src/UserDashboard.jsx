import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';
import { getUsernameError, normalizeUsername } from './lib/auth-routing.js';
import { sitePath } from './site-path.js';

const emptyProfile = {
  username: '',
  full_name: '',
  avatar_path: null,
  email_notifications: true,
  newsletter_enabled: false,
};

function showDate(value) {
  return value ? new Date(value).toLocaleString() : 'Not available';
}

export default function UserDashboard() {
  const [state, setState] = useState('loading');
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(emptyProfile);
  const [posts, setPosts] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [activity, setActivity] = useState([]);
  const [hasVerifiedAuthenticator, setHasVerifiedAuthenticator] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = 'User dashboard | Sushil Pokharel';
    document.querySelector('meta[name="description"]')?.setAttribute(
      'content',
      'Manage your profile, notification settings, posts, and platform updates.',
    );
  }, []);

  async function loadDashboard() {
    if (!supabase) {
      setState('unconfigured');
      return;
    }
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) {
      setState('signed-out');
      return;
    }
    const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!currentUser) {
      setState('signed-out');
      return;
    }
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) throw factorsError;
    setHasVerifiedAuthenticator(factors.totp.some((factor) => factor.status === 'verified'));
    setUser(currentUser);
    const [profileResult, postResult, announcementResult, activityResult] = await Promise.all([
      supabase.from('profiles').select('username, full_name, avatar_path, email_notifications, newsletter_enabled')
        .eq('user_id', currentUser.id).maybeSingle(),
      supabase.from('user_posts').select('id, title, content, status, moderation_note, featured, created_at, updated_at')
        .eq('user_id', currentUser.id).order('updated_at', { ascending: false }).limit(50),
      supabase.from('announcements').select('id, title, body, published_at')
        .eq('published', true).order('published_at', { ascending: false }).limit(20),
      supabase.from('user_activity').select('id, event, created_at')
        .eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(20),
    ]);
    for (const result of [profileResult, postResult, announcementResult, activityResult]) {
      if (result.error) throw result.error;
    }
    setProfile(profileResult.data ?? {
      ...emptyProfile,
      full_name: currentUser.user_metadata?.full_name ?? '',
    });
    setPosts(postResult.data);
    setAnnouncements(announcementResult.data);
    setActivity(activityResult.data);
    setState(currentUser.app_metadata?.role === 'admin' ? 'admin' : 'ready');
  }

  useEffect(() => {
    let active = true;
    loadDashboard().catch((error) => {
      if (active) {
        setState('error');
        setNotice({ kind: 'error', text: error.message || 'Could not load your dashboard.' });
      }
    });
    return () => { active = false; };
  }, []);

  function reportError(error, fallback) {
    setNotice({ kind: 'error', text: error?.message || fallback });
  }

  async function saveProfile(event) {
    event.preventDefault();
    const usernameError = getUsernameError(profile.username);
    if (usernameError) {
      setNotice({ kind: 'error', text: usernameError });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const { error } = await supabase.from('profiles').upsert({
        user_id: user.id,
        username: normalizeUsername(profile.username),
        full_name: profile.full_name.trim(),
        email_notifications: profile.email_notifications,
      }, { onConflict: 'user_id' });
      if (error) throw error;
      setNotice({ kind: 'success', text: 'Your profile and notification preferences were saved.' });
      await loadDashboard();
    } catch (error) {
      reportError(error, 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  }

  async function uploadAvatar(event) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setNotice({ kind: 'error', text: 'Choose a JPG, PNG, or WebP image smaller than 2 MB.' });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
      const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const { error: profileError } = await supabase.from('profiles').upsert({
        user_id: user.id,
        avatar_path: path,
      }, { onConflict: 'user_id' });
      if (profileError) throw profileError;
      setNotice({ kind: 'success', text: 'Your avatar was uploaded.' });
      await loadDashboard();
    } catch (error) {
      reportError(error, 'Could not upload your avatar.');
    } finally {
      setBusy(false);
    }
  }

  async function setNewsletterPreference(enabled) {
    setBusy(true);
    setNotice(null);
    try {
      const { data, error } = await supabase.functions.invoke('newsletter', {
        body: { action: 'manage', enabled },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Could not update your newsletter preference.');
      setNotice({
        kind: 'success',
        text: enabled
          ? 'Check your email to confirm the newsletter subscription.'
          : 'You have been unsubscribed.',
      });
      await loadDashboard();
    } catch (error) {
      reportError(error, 'Could not update your newsletter preference.');
    } finally {
      setBusy(false);
    }
  }

  async function savePost(event, status) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const title = formData.get('title').toString().trim();
    const content = formData.get('content').toString().trim();
    if (title.length < 3 || content.length < 20) {
      setNotice({ kind: 'error', text: 'Use a title of at least 3 characters and content of at least 20 characters.' });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const values = {
        title,
        content,
        status,
        moderation_note: null,
        reviewed_at: null,
      };
      const query = editingPost
        ? supabase.from('user_posts').update(values).eq('id', editingPost.id).eq('user_id', user.id)
        : supabase.from('user_posts').insert({ ...values, user_id: user.id, status: 'draft' });
      const { error } = await query;
      if (error) throw error;
      setEditingPost(null);
      setNotice({
        kind: 'success',
        text: status === 'pending' ? 'Your post is submitted for administrator review.' : 'Your draft was saved.',
      });
      await loadDashboard();
    } catch (error) {
      reportError(error, 'Could not save your post.');
    } finally {
      setBusy(false);
    }
  }

  async function deletePost(post) {
    if (!window.confirm(`Delete “${post.title}”?`)) return;
    setBusy(true);
    setNotice(null);
    try {
      const { error } = await supabase.from('user_posts').delete().eq('id', post.id).eq('user_id', user.id);
      if (error) throw error;
      setPosts((current) => current.filter((item) => item.id !== post.id));
      setNotice({ kind: 'success', text: 'Your post was deleted.' });
    } catch (error) {
      reportError(error, 'Could not delete the post.');
    } finally {
      setBusy(false);
    }
  }

  async function createRevision(post) {
    if (!window.confirm(`Withdraw “${post.title}” from public view and create a draft revision?`)) return;
    setBusy(true);
    setNotice(null);
    try {
      const { error } = await supabase.from('user_posts').update({
        status: 'draft',
        featured: false,
        moderation_note: null,
        reviewed_at: null,
      }).eq('id', post.id).eq('user_id', user.id);
      if (error) throw error;
      setEditingPost({ ...post, status: 'draft' });
      setNotice({ kind: 'success', text: 'The post is no longer public. Edit the draft and submit it for review when ready.' });
      await loadDashboard();
    } catch (error) {
      reportError(error, 'Could not create a revision.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      reportError(error, 'Could not sign out.');
      setBusy(false);
      return;
    }
    window.location.assign(sitePath('/account'));
  }

  let content;
  if (state === 'loading') {
    content = <p role="status">Loading your account…</p>;
  } else if (state === 'unconfigured') {
    content = <p>Account services are not configured. Contact the site administrator.</p>;
  } else if (state === 'signed-out') {
    content = <p>Sign in to access your dashboard. <a href={sitePath('/account')}>Sign in</a></p>;
  } else if (state === 'admin') {
    content = <p>Your account has the administrator role. Open the <a href={sitePath('/admin')}>admin dashboard</a>.</p>;
  } else if (state === 'error') {
    content = <p>We could not load your dashboard. Confirm the platform migration is applied and try again.</p>;
  } else {
    const avatarUrl = profile.avatar_path
      ? supabase.storage.from('avatars').getPublicUrl(profile.avatar_path).data.publicUrl
      : '';
    content = (
      <>
        <div className="dashboard-heading">
          <div>
            <span className="auth-eyebrow">YOUR ACCOUNT</span>
            <h1>Dashboard</h1>
            <p className="auth-description">Signed in as {user.email}</p>
          </div>
          <button className="auth-secondary" type="button" onClick={signOut} disabled={busy}>Sign out</button>
        </div>
        <section className="dashboard-panel" aria-labelledby="profile-title">
          <h2 id="profile-title">Profile and preferences</h2>
          <div className="avatar-row">
            {avatarUrl ? <img className="profile-avatar" src={avatarUrl} alt="Your profile avatar" /> : <div className="profile-avatar avatar-placeholder" aria-hidden="true">{profile.full_name.slice(0, 1) || 'U'}</div>}
            <label className="auth-secondary avatar-upload">
              Upload avatar
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadAvatar} disabled={busy} />
            </label>
            <span>JPG, PNG, or WebP; up to 2 MB.</span>
          </div>
          <form className="auth-form" onSubmit={saveProfile}>
            <div className="auth-field">
              <label htmlFor="profile-username">Username</label>
              <input id="profile-username" autoComplete="username" value={profile.username} minLength={3} maxLength={32} onChange={(event) => setProfile((current) => ({ ...current, username: event.target.value }))} required />
            </div>
            <div className="auth-field">
              <label htmlFor="profile-name">Display name</label>
              <input id="profile-name" value={profile.full_name} maxLength={100} onChange={(event) => setProfile((current) => ({ ...current, full_name: event.target.value }))} />
            </div>
            <label className="admin-checkbox">
              <input type="checkbox" checked={profile.email_notifications} onChange={(event) => setProfile((current) => ({ ...current, email_notifications: event.target.checked }))} />
              <span>Receive important account and support notifications</span>
            </label>
            <button className="auth-submit" type="submit" disabled={busy}>Save profile</button>
          </form>
          <label className="admin-checkbox newsletter-preference">
            <input type="checkbox" checked={profile.newsletter_enabled} disabled={busy} onChange={(event) => setNewsletterPreference(event.target.checked)} />
            <span>Subscribe to occasional website updates. New subscriptions require email confirmation; see the <a href={sitePath('/privacy')}>Privacy Policy</a>.</span>
          </label>
        </section>

        <section className="dashboard-panel" aria-labelledby="posts-title">
          <h2 id="posts-title">Your posts</h2>
          <p className="auth-description">Posts are private until an administrator approves them. Submit a draft for review when it is ready.</p>
          <form className="auth-form post-editor" key={editingPost?.id ?? 'new-post'} onSubmit={(event) => savePost(event, 'draft')}>
            <div className="auth-field">
              <label htmlFor="post-title">Title</label>
              <input id="post-title" name="title" defaultValue={editingPost?.title ?? ''} required minLength={3} maxLength={160} />
            </div>
            <div className="auth-field">
              <label htmlFor="post-content">Content</label>
              <textarea id="post-content" name="content" rows={6} defaultValue={editingPost?.content ?? ''} required minLength={20} maxLength={20000} />
            </div>
            <div className="dashboard-actions">
              <button className="auth-submit" type="submit" disabled={busy}>Save draft</button>
              {editingPost && <button className="auth-secondary" type="button" onClick={() => setEditingPost(null)}>Cancel edit</button>}
            </div>
          </form>
          <ul className="dashboard-list">
            {posts.map((post) => (
              <li key={post.id} className="dashboard-list-item">
                <div className="support-request-heading">
                  <h3>{post.title}</h3>
                  <span>{post.status}{post.featured ? ' · featured' : ''}</span>
                </div>
                <p>{post.content}</p>
                {post.moderation_note && <p className="moderation-note">Review note: {post.moderation_note}</p>}
                <time dateTime={post.updated_at}>Updated {showDate(post.updated_at)}</time>
                <div className="dashboard-actions">
                    {post.status === 'approved' ? (
                      <button className="auth-secondary" type="button" disabled={busy} onClick={() => createRevision(post)}>Withdraw and revise</button>
                    ) : (
                    <button className="auth-secondary" type="button" onClick={() => setEditingPost(post)}>Edit</button>
                    )}
                    <button className="auth-submit" type="button" disabled={busy || post.status === 'pending' || post.status === 'approved'} onClick={async () => {
                      setBusy(true);
                      setNotice(null);
                      try {
                        const { error } = await supabase.from('user_posts')
                          .update({ status: 'pending', moderation_note: null, reviewed_at: null })
                          .eq('id', post.id).eq('user_id', user.id);
                        if (error) throw error;
                        setNotice({ kind: 'success', text: 'Your post is submitted for review.' });
                        await loadDashboard();
                      } catch (error) {
                        reportError(error, 'Could not submit your post.');
                      } finally {
                        setBusy(false);
                      }
                    }}>{post.status === 'pending' ? 'Awaiting review' : post.status === 'approved' ? 'Published' : 'Submit for review'}</button>
                    <button className="account-delete-button" type="button" disabled={busy} onClick={() => deletePost(post)}>Delete</button>
                  </div>
              </li>
            ))}
            {posts.length === 0 && <li className="support-empty">You have not created any posts.</li>}
          </ul>
        </section>

        <section className="dashboard-panel" aria-labelledby="announcements-title">
          <h2 id="announcements-title">Platform updates</h2>
          {announcements.length ? (
            <ul className="dashboard-list">
              {announcements.map((announcement) => (
                <li key={announcement.id} className="dashboard-list-item">
                  <h3>{announcement.title}</h3>
                  <p>{announcement.body}</p>
                  <time dateTime={announcement.published_at}>{showDate(announcement.published_at)}</time>
                </li>
              ))}
            </ul>
          ) : <p className="support-empty">There are no published updates.</p>}
        </section>

        <section className="dashboard-panel" aria-labelledby="activity-title">
          <h2 id="activity-title">Account activity and security</h2>
          <p className="auth-description">Last successful sign-in: {showDate(user.last_sign_in_at)}. This list records profile and post changes; historical authentication events are managed by Supabase and are not exposed in this dashboard.</p>
          <p className="auth-description">Authenticator MFA: {hasVerifiedAuthenticator ? 'enabled' : 'not enabled'} · <a href={sitePath('/account/security')}>Manage password and account security</a>.</p>
          {activity.length ? (
            <ul className="dashboard-list activity-list">
              {activity.map((item) => <li key={item.id}><span>{item.event.replaceAll('_', ' ')}</span><time dateTime={item.created_at}>{showDate(item.created_at)}</time></li>)}
            </ul>
          ) : <p className="support-empty">No profile or post activity has been recorded yet.</p>}
        </section>
      </>
    );
  }

  return (
    <main className="auth-page dashboard-page">
      <section className="dashboard-card" aria-live="polite">
        {notice && <p className={`auth-notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
        {content}
        <a className="auth-home-link" href={sitePath('/')}>Return to website</a>
      </section>
    </main>
  );
}
