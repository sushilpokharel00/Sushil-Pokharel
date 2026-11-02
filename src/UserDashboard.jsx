import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';
import { getUsernameError, normalizeUsername } from './lib/auth-routing.js';
import { getActivityWeek, getPersonalMetrics } from './lib/dashboard-metrics.js';
import { sitePath } from './site-path.js';

const postCategories = [
  ['announcement', 'Announcement'],
  ['story', 'Story'],
  ['question', 'Question'],
  ['project', 'Project'],
  ['other', 'Other'],
];

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
  const [selectedPostImage, setSelectedPostImage] = useState(null);
  const [postImagePreview, setPostImagePreview] = useState('');
  const [removePostImage, setRemovePostImage] = useState(false);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = 'User dashboard | Sushil Pokharel';
    document.querySelector('meta[name="description"]')?.setAttribute(
      'content',
      'Manage your profile, notification settings, posts, and platform updates.',
    );
  }, []);

  useEffect(() => {
    if (!selectedPostImage) {
      setPostImagePreview(editingPost?.featured_image_url ?? '');
      return undefined;
    }
    const previewUrl = URL.createObjectURL(selectedPostImage);
    setPostImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [editingPost?.featured_image_url, selectedPostImage]);

  async function loadDashboard() {
    if (!supabase) {
      setState('unconfigured');
      return;
    }
    if (!['draft', 'pending'].includes(status)) {
      setNotice({ kind: 'error', text: 'Choose a valid post action.' });
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
      supabase.from('user_posts').select('id, title, content, category, featured_image_path, status, moderation_note, featured, created_at, updated_at')
        .eq('user_id', currentUser.id).order('updated_at', { ascending: false }).limit(50),
      supabase.from('announcements').select('id, title, body, published_at')
        .eq('published', true).order('published_at', { ascending: false }).limit(20),
      supabase.from('user_activity').select('id, event, created_at')
        .eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(100),
    ]);
    for (const result of [profileResult, postResult, announcementResult, activityResult]) {
      if (result.error) throw result.error;
    }
    const postsWithImages = await Promise.all(postResult.data.map(async (post) => {
      if (!post.featured_image_path) return { ...post, featured_image_url: '' };
      const { data, error } = await supabase.storage
        .from('user-post-images')
        .createSignedUrl(post.featured_image_path, 3600);
      if (error) throw error;
      return { ...post, featured_image_url: data.signedUrl };
    }));
    setProfile(profileResult.data ?? {
      ...emptyProfile,
      full_name: currentUser.user_metadata?.full_name ?? '',
    });
    setPosts(postsWithImages);
    setAnnouncements(announcementResult.data);
    setActivity(activityResult.data);
    setState(currentUser.app_metadata?.role === 'super_admin' ? 'admin' : 'ready');
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
    const category = formData.get('category').toString();
    if (title.length < 3 || content.length < 20) {
      setNotice({ kind: 'error', text: 'Use a title of at least 3 characters and content of at least 20 characters.' });
      return;
    }
    if (!postCategories.some(([value]) => value === category)) {
      setNotice({ kind: 'error', text: 'Choose a valid post category.' });
      return;
    }
    if (selectedPostImage && (
      !['image/jpeg', 'image/png', 'image/webp'].includes(selectedPostImage.type)
      || selectedPostImage.size > 5 * 1024 * 1024
    )) {
      setNotice({ kind: 'error', text: 'Choose a JPG, PNG, or WebP image smaller than 5 MB.' });
      return;
    }
    setBusy(true);
    setNotice(null);
    let uploadedImagePath = null;
    let postSaved = false;
    let imageCleanupWarning = '';
    try {
      let featuredImagePath = editingPost?.featured_image_path ?? null;
      if (selectedPostImage) {
        const extension = selectedPostImage.type === 'image/jpeg' ? 'jpg' : selectedPostImage.type.split('/')[1];
        uploadedImagePath = `${user.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from('user-post-images').upload(
          uploadedImagePath,
          selectedPostImage,
          { contentType: selectedPostImage.type, upsert: false },
        );
        if (uploadError) throw uploadError;
        featuredImagePath = uploadedImagePath;
      } else if (removePostImage) {
        featuredImagePath = null;
      }

      const values = {
        title,
        content,
        category,
        featured_image_path: featuredImagePath,
        status,
        moderation_note: null,
        reviewed_at: null,
      };
      if (editingPost) {
        const { error } = await supabase.from('user_posts')
          .update(values)
          .eq('id', editingPost.id)
          .eq('user_id', user.id);
        if (error) throw error;
        postSaved = true;
      } else {
        const { data, error } = await supabase.from('user_posts')
          .insert({ ...values, user_id: user.id, status: 'draft' })
          .select('id')
          .single();
        if (error) throw error;
        postSaved = true;
        if (status === 'pending') {
          const { error: submitError } = await supabase.from('user_posts')
            .update({ status: 'pending', moderation_note: null, reviewed_at: null })
            .eq('id', data.id)
            .eq('user_id', user.id);
          if (submitError) throw submitError;
        }
      }
      const previousImagePath = editingPost?.featured_image_path;
      if (previousImagePath && previousImagePath !== featuredImagePath) {
        const { error: removeError } = await supabase.storage.from('user-post-images').remove([previousImagePath]);
        if (removeError) {
          imageCleanupWarning = `Your post was saved, but its previous image could not be removed: ${removeError.message}`;
        }
      }
      setEditingPost(null);
      setSelectedPostImage(null);
      setRemovePostImage(false);
      setNotice(imageCleanupWarning
        ? { kind: 'error', text: imageCleanupWarning }
        : {
          kind: 'success',
          text: status === 'pending' ? 'Your post is submitted for administrator review.' : 'Your draft was saved.',
        });
      await loadDashboard();
    } catch (error) {
      if (uploadedImagePath && !postSaved) {
        const { error: cleanupError } = await supabase.storage.from('user-post-images').remove([uploadedImagePath]);
        if (cleanupError) {
          console.error('Could not clean up a post image after a failed save.', cleanupError);
        }
      }
      reportError(error, 'Could not save your post.');
    } finally {
      setBusy(false);
    }
  }

  async function deletePost(post) {
    if (!window.confirm(`Delete “${post.title}”?`)) return;
    setBusy(true);
    setNotice(null);
    let imageCleanupWarning = '';
    try {
      const { error } = await supabase.from('user_posts').delete().eq('id', post.id).eq('user_id', user.id);
      if (error) throw error;
      if (post.featured_image_path) {
        const { error: imageError } = await supabase.storage.from('user-post-images').remove([post.featured_image_path]);
        if (imageError) {
          imageCleanupWarning = `Your post was deleted, but its image could not be removed: ${imageError.message}`;
        }
      }
      setPosts((current) => current.filter((item) => item.id !== post.id));
      setNotice(imageCleanupWarning
        ? { kind: 'error', text: imageCleanupWarning }
        : { kind: 'success', text: 'Your post was deleted.' });
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
    content = <p>Your account has the Super Admin role. Open the <a href={sitePath('/admin')}>admin dashboard</a>.</p>;
  } else if (state === 'error') {
    content = <p>We could not load your dashboard. Confirm the platform migration is applied and try again.</p>;
  } else {
    const metrics = getPersonalMetrics(posts, activity);
    const activityWeek = getActivityWeek(activity);
    const activityPeak = Math.max(...activityWeek.map((day) => day.count), 1);
    const displayName = profile.full_name.trim() || user.user_metadata?.full_name || user.email?.split('@')[0] || 'there';
    const avatarUrl = profile.avatar_path
      ? supabase.storage.from('avatars').getPublicUrl(profile.avatar_path).data.publicUrl
      : '';
    content = (
      <>
        <div className="user-dashboard-header">
          <div className="user-welcome-banner">
            <div className="user-welcome-copy">
              <span className="auth-eyebrow">YOUR WORKSPACE</span>
              <h1>Welcome back, {displayName}</h1>
              <p>Keep your profile current and turn your next idea into a community post.</p>
            </div>
            <div className="user-welcome-avatar" aria-hidden="true">
              {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{displayName.slice(0, 1).toUpperCase()}</span>}
            </div>
          </div>
          <div className="user-dashboard-toolbar">
            <span className="user-account-email">{user.email}</span>
            <button className="auth-secondary" type="button" onClick={signOut} disabled={busy}>Sign out</button>
          </div>
        </div>
        <div className="user-metric-grid" aria-label="Your post statistics">
          <article><span>Total posts</span><strong>{metrics.totalPosts}</strong><small>Across your workspace</small></article>
          <article><span>Published</span><strong>{metrics.publishedPosts}</strong><small>Visible to the community</small></article>
          <article><span>Under review</span><strong>{metrics.inReviewPosts}</strong><small>Awaiting an administrator</small></article>
          <article><span>Drafts</span><strong>{metrics.drafts}</strong><small>Ready when you are</small></article>
        </div>
        <section className="user-activity-chart" aria-labelledby="activity-chart-title">
          <div className="user-section-heading">
            <div><span className="auth-eyebrow">YOUR MOMENTUM</span><h2 id="activity-chart-title">Activity this week</h2></div>
            <span>{metrics.recentActivity} recent events · chart uses up to 100 account events</span>
          </div>
          <div className="user-week-chart" role="img" aria-label="Your account activity across the last seven days">
            {activityWeek.map((day) => (
              <div className="user-week-day" key={day.date} title={`${day.date}: ${day.count} activities`}>
                <span className="user-week-bar-track"><span style={{ height: `${day.count ? Math.max(day.count / activityPeak * 100, 8) : 0}%` }} /></span>
                <strong>{day.count}</strong>
                <time dateTime={day.date}>{day.label}</time>
              </div>
            ))}
          </div>
        </section>
        <section className="dashboard-panel" aria-labelledby="profile-title">
          <div className="user-section-heading"><div><span className="auth-eyebrow">PERSONAL DETAILS</span><h2 id="profile-title">Profile and preferences</h2></div></div>
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
          <div className="user-section-heading"><div><span className="auth-eyebrow">CREATE &amp; SHARE</span><h2 id="posts-title">Your posts</h2></div><span>{posts.length} saved</span></div>
          <p className="auth-description">Posts are private until an administrator approves them. Submit a draft for review when it is ready.</p>
          <form className="auth-form post-editor" key={editingPost?.id ?? 'new-post'} onSubmit={(event) => {
            const action = event.nativeEvent.submitter?.value ?? 'draft';
            return savePost(event, action);
          }}>
            <div className="auth-field">
              <label htmlFor="post-title">Title</label>
              <input id="post-title" name="title" defaultValue={editingPost?.title ?? ''} required minLength={3} maxLength={160} />
            </div>
            <div className="auth-field">
              <label htmlFor="post-content">Content</label>
              <textarea id="post-content" name="content" rows={6} defaultValue={editingPost?.content ?? ''} required minLength={20} maxLength={20000} />
            </div>
            <div className="auth-field">
              <label htmlFor="post-category">Category</label>
              <select id="post-category" name="category" defaultValue={editingPost?.category ?? 'other'}>
                {postCategories.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </div>
            <div className="auth-field">
              <label htmlFor="post-featured-image">Featured image <span>Optional · JPG, PNG, or WebP · up to 5 MB</span></label>
              <input
                id="post-featured-image"
                name="featuredImage"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  setSelectedPostImage(event.currentTarget.files?.[0] ?? null);
                  setRemovePostImage(false);
                }}
                disabled={busy}
              />
              {postImagePreview && <img className="post-image-preview" src={postImagePreview} alt="Featured image preview" />}
              {editingPost?.featured_image_path && (
                <label className="admin-checkbox">
                  <input
                    type="checkbox"
                    name="removeImage"
                    checked={removePostImage}
                    onChange={(event) => {
                      setRemovePostImage(event.target.checked);
                      if (event.target.checked) setSelectedPostImage(null);
                    }}
                  />
                  <span>Remove the current featured image</span>
                </label>
              )}
            </div>
            <div className="dashboard-actions">
              <button className="auth-secondary" type="submit" name="postAction" value="draft" disabled={busy}>Save draft</button>
              <button className="auth-submit" type="submit" name="postAction" value="pending" disabled={busy}>Submit for review</button>
              {editingPost && <button className="auth-secondary" type="button" onClick={() => { setEditingPost(null); setSelectedPostImage(null); setRemovePostImage(false); }}>Cancel edit</button>}
            </div>
          </form>
          <ul className="dashboard-list">
            {posts.map((post) => (
              <li key={post.id} className="dashboard-list-item">
                <div className="support-request-heading">
                  <h3>{post.title}</h3>
                  <span className={`post-status-badge post-status-${post.status}`}>{post.status === 'approved' ? 'Published' : post.status === 'pending' ? 'Under review' : post.status === 'rejected' ? 'Needs changes' : 'Draft'}{post.featured ? ' · featured' : ''}</span>
                </div>
                <span className="post-category-label">{postCategories.find(([value]) => value === post.category)?.[1] ?? 'Other'}</span>
                {post.featured_image_url && <img className="post-image-preview" src={post.featured_image_url} alt={`Featured image for ${post.title}`} />}
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
      <section className="dashboard-card modern-user-dashboard" aria-live="polite">
        {notice && <p className={`auth-notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
        {content}
        <a className="auth-home-link" href={sitePath('/')}>Return to website</a>
      </section>
    </main>
  );
}
