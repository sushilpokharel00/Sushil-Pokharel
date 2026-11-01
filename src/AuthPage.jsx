import React, { useEffect, useRef, useState } from 'react';
import {
  getAuthRedirectUrl,
  getDashboardPath,
  getUsernameError,
  isPasswordRecoveryUrl,
  normalizeUsername,
} from './lib/auth-routing.js';
import { supabase, supabaseConfigurationError } from './lib/supabase.js';
import { getPasswordPolicyError } from './lib/password-policy.js';
import { sitePath } from './site-path.js';

const authRedirectOrigin = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim()
  || 'https://sushilpokharel00.com.np';

function setPageMetadata(title, description) {
  document.title = title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', description);
}

function AuthField({ id, label, type = 'text', autoComplete, minLength, maxLength, value, onChange, required = true }) {
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        minLength={minLength}
        maxLength={maxLength}
        value={value}
        onChange={onChange}
        required={required}
      />
    </div>
  );
}

export default function AuthPage({ isAccountPage = false, isAdminPage = false }) {
  const [session, setSession] = useState(null);
  const [screen, setScreen] = useState(() => (
    isPasswordRecoveryUrl(window.location) ? 'new-password' : 'loading'
  ));
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [factorId, setFactorId] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [verifiedFactor, setVerifiedFactor] = useState(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const recoveryFlowRef = useRef(isPasswordRecoveryUrl(window.location));

  useEffect(() => {
    const titles = {
      'sign-in': 'Sign in',
      'sign-up': 'Create an account',
      'forgot-password': 'Reset your password',
      account: 'Your account',
      'new-password': 'Choose a new password',
      'mfa-challenge': 'Verify your sign-in',
      'mfa-enroll': 'Set up two-factor authentication',
      'mfa-required': 'Secure administrator sign-in',
      'mfa-disable': 'Manage two-factor authentication',
    };
    const title = isAccountPage && screen === 'sign-in' ? 'Your account' : titles[screen] || 'Your account';
    setPageMetadata(
      `${title} | Sushil Pokharel`,
      isAdminPage
        ? 'Sign in to the administrator dashboard with your administrator account.'
        : 'Create an account or sign in securely to access your dashboard.',
    );
  }, [isAccountPage, isAdminPage, screen]);

  useEffect(() => {
    if (!supabase) {
      setScreen('sign-in');
      return undefined;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === 'PASSWORD_RECOVERY') {
        recoveryFlowRef.current = true;
        setScreen('new-password');
        setNotice({ kind: 'info', text: 'Choose a new password for your account.' });
      } else if (event === 'SIGNED_OUT') {
        recoveryFlowRef.current = false;
        window.__passwordRecoveryRedirect = false;
        setScreen('sign-in');
        setVerifiedFactor(null);
      }
    });

    async function initializeSession() {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setNotice({ kind: 'error', text: error.message });
        setScreen('sign-in');
        return;
      }

      setSession(data.session);
      if (!data.session) {
        if (recoveryFlowRef.current) {
          recoveryFlowRef.current = false;
          window.__passwordRecoveryRedirect = false;
          window.history.replaceState(null, '', sitePath('/account'));
          setNotice({ kind: 'error', text: 'This password reset link is invalid or expired. Request a new one to continue.' });
        }
        setScreen('sign-in');
        return;
      }

      const isSecurityPage = window.location.pathname.replace(/\/+$/, '') === sitePath('/account/security');
      await continueWithSession({ redirectToDashboard: !isSecurityPage });
    }

    initializeSession().catch((error) => {
      setNotice({ kind: 'error', text: error.message || 'Could not restore your sign-in session.' });
      setScreen('sign-in');
    });

    return () => subscription.unsubscribe();
  }, []);

  async function continueWithSession({ redirectToDashboard = false } = {}) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('Your sign-in session is no longer valid. Sign in again.');

    const isAdmin = user.app_metadata?.role === 'admin';
    if (isAdminPage && !isAdmin) {
      await supabase.auth.signOut({ scope: 'local' });
      setSession(null);
      setScreen('sign-in');
      throw new Error('Administrator sign-in failed. Check your credentials and try again.');
    }

    const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError) throw assuranceError;

    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) throw factorsError;
    const factor = factors.totp.find((item) => item.status === 'verified') ?? null;
    setVerifiedFactor(factor);

    if (factor && assurance.nextLevel === 'aal2' && assurance.currentLevel !== 'aal2') {
      setFactorId(factor.id);
      setScreen('mfa-challenge');
      return 'mfa-challenge';
    }
    if (isAdmin && !factor) {
      setScreen('mfa-required');
      return 'mfa-required';
    }

    if (recoveryFlowRef.current) {
      setScreen('new-password');
      return 'new-password';
    }
    if (redirectToDashboard) {
      window.location.replace(sitePath(getDashboardPath(user.app_metadata?.role)));
      return 'redirected';
    }
    setScreen('account');
    return 'account';
  }

  async function refreshVerifiedFactor() {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw error;
    const factor = data.totp.find((item) => item.status === 'verified') ?? null;
    setVerifiedFactor(factor);
  }

  async function runAction(action, onSuccess) {
    setBusy(true);
    setNotice(null);
    try {
      const { error, ...result } = await action();
      if (error) throw error;
      if (onSuccess) await onSuccess(result);
    } catch (error) {
      setNotice({ kind: 'error', text: error.message || 'The request could not be completed. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleSignIn(event) {
    event.preventDefault();
    await runAction(
      async () => {
        const { data, error } = await supabase.functions.invoke('sign-in-with-username', {
          body: {
            username: normalizeUsername(username),
            password,
            purpose: isAdminPage ? 'admin' : 'user',
          },
        });
        if (error) throw error;
        if (!data?.session?.access_token || !data?.session?.refresh_token) {
          throw new Error('Invalid username or password.');
        }
        return supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      },
      async () => {
        setPassword('');
        const nextScreen = await continueWithSession({ redirectToDashboard: true });
        if (!['mfa-challenge', 'mfa-required', 'redirected'].includes(nextScreen)) {
          setNotice({ kind: 'success', text: 'You are signed in.' });
        }
      },
    );
  }

  async function handleSignUp(event) {
    event.preventDefault();
    const usernameError = getUsernameError(username);
    if (usernameError) {
      setNotice({ kind: 'error', text: usernameError });
      return;
    }
    const passwordError = getPasswordPolicyError(password);
    if (passwordError) {
      setNotice({ kind: 'error', text: passwordError });
      return;
    }
    await runAction(
      () => supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim(), username: normalizeUsername(username) },
          emailRedirectTo: getAuthRedirectUrl(sitePath('/account'), authRedirectOrigin),
        },
      }),
      async ({ data }) => {
        setPassword('');
        if (data.session) {
          setSession(data.session);
          const nextScreen = await continueWithSession({ redirectToDashboard: true });
          if (!['mfa-challenge', 'mfa-required', 'redirected'].includes(nextScreen)) {
            setNotice({ kind: 'success', text: 'Your account has been created.' });
          }
        } else {
          setScreen('sign-in');
          setNotice({ kind: 'success', text: 'Check your email to confirm your account, then sign in.' });
        }
      },
    );
  }

  async function handlePasswordReset(event) {
    event.preventDefault();
    await runAction(
      () => supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: getAuthRedirectUrl(sitePath('/account'), authRedirectOrigin),
      }),
      () => setNotice({ kind: 'success', text: 'If an account exists for that email, a password reset link is on its way.' }),
    );
  }

  async function handleSetNewPassword(event) {
    event.preventDefault();
    const passwordError = getPasswordPolicyError(newPassword);
    if (passwordError) {
      setNotice({ kind: 'error', text: passwordError });
      return;
    }
    await runAction(
      () => supabase.auth.updateUser({ password: newPassword }),
      async () => {
        setNewPassword('');
        recoveryFlowRef.current = false;
        window.__passwordRecoveryRedirect = false;
        window.history.replaceState(null, '', sitePath('/account'));
        setNotice({ kind: 'success', text: 'Your password has been updated.' });
        await continueWithSession();
      },
    );
  }

  async function handleMfaChallenge(event) {
    event.preventDefault();
    await runAction(
      () => supabase.auth.mfa.challengeAndVerify({ factorId, code: otp.trim() }),
      async () => {
        setOtp('');
        await refreshVerifiedFactor();
        await continueWithSession({ redirectToDashboard: true });
      },
    );
  }

  async function beginMfaEnrollment() {
    await runAction(
      () => supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator app' }),
      async ({ data }) => {
        const challenge = await supabase.auth.mfa.challenge({ factorId: data.id });
        if (challenge.error) throw challenge.error;
        setFactorId(data.id);
        setChallengeId(challenge.data.id);
        setQrCode(data.totp.qr_code);
        setTotpSecret(data.totp.secret);
        setScreen('mfa-enroll');
      },
    );
  }

  async function handleVerifyEnrollment(event) {
    event.preventDefault();
    await runAction(
      () => supabase.auth.mfa.verify({ factorId, challengeId, code: otp.trim() }),
      async () => {
        setOtp('');
        setQrCode('');
        setTotpSecret('');
        await refreshVerifiedFactor();
        await continueWithSession({ redirectToDashboard: true });
        setNotice({ kind: 'success', text: 'Two-factor authentication is enabled.' });
      },
    );
  }

  async function beginMfaRemoval() {
    if (!verifiedFactor) return;
    await runAction(
      () => supabase.auth.mfa.challenge({ factorId: verifiedFactor.id }),
      ({ data }) => {
        setFactorId(verifiedFactor.id);
        setChallengeId(data.id);
        setScreen('mfa-disable');
      },
    );
  }

  async function cancelMfaEnrollment() {
    if (factorId) {
      await runAction(
        () => supabase.auth.mfa.unenroll({ factorId }),
        () => setScreen(isAdminPage ? 'mfa-required' : 'account'),
      );
      return;
    }
    setScreen('account');
  }

  async function handleVerifyRemoval(event) {
    event.preventDefault();
    await runAction(
      async () => {
        const verification = await supabase.auth.mfa.verify({ factorId, challengeId, code: otp.trim() });
        if (verification.error) return verification;
        return supabase.auth.mfa.unenroll({ factorId });
      },
      async () => {
        setOtp('');
        setVerifiedFactor(null);
        setScreen('account');
        setNotice({ kind: 'success', text: 'Two-factor authentication has been disabled.' });
      },
    );
  }

  async function handleChangePassword(event) {
    event.preventDefault();
    const passwordError = getPasswordPolicyError(newPassword);
    if (passwordError) {
      setNotice({ kind: 'error', text: passwordError });
      return;
    }
    await runAction(
      () => supabase.auth.updateUser({ password: newPassword }),
      () => {
        setNewPassword('');
        setNotice({ kind: 'success', text: 'Your password has been changed.' });
      },
    );
  }

  async function handleSignOut() {
    await runAction(
      () => supabase.auth.signOut(),
      () => {
        setSession(null);
        setScreen('sign-in');
        setNotice({ kind: 'success', text: 'You have signed out.' });
      },
    );
  }

  async function handleDeleteAccount(event) {
    event.preventDefault();
    if (deleteConfirmation !== 'DELETE') {
      setNotice({ kind: 'error', text: 'Type DELETE exactly to confirm account deletion.' });
      return;
    }

    await runAction(
      () => supabase.functions.invoke('delete-account'),
      async () => {
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        setSession(null);
        setScreen('sign-in');
        setDeleteConfirmation('');
        setShowDeleteConfirmation(false);
        setNotice(error
          ? { kind: 'error', text: 'Your account was deleted, but this browser could not clear its saved session. Sign out and clear this site’s stored session.' }
          : { kind: 'success', text: 'Your account and associated support requests have been deleted.' });
      },
    );
  }

  function goTo(nextScreen) {
    setNotice(null);
    setScreen(nextScreen);
  }

  let content;

  if (!supabase) {
    content = (
      <>
        <span className="auth-eyebrow">ACCOUNT SECURITY</span>
        <h1>Sign in is not configured</h1>
        <p className="auth-description">
          {supabaseConfigurationError} For GitHub Pages, add these values as the
          <code> VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>
          {' '}GitHub Actions secrets, then redeploy. Never use a service-role key in the website.
        </p>
      </>
    );
  } else if (screen === 'loading') {
    content = (
      <div className="auth-loading" role="status">
        <span className="loading-spinner" aria-hidden="true" />
        <span>Securely checking your sign-in session…</span>
      </div>
    );
  } else if (screen === 'sign-up') {
    content = (
      <>
        <span className="auth-eyebrow">CREATE AN ACCOUNT</span>
        <h1>Sign up</h1>
        <p className="auth-description">Choose a username, provide your email address, and create a strong password.</p>
        <form className="auth-form" onSubmit={handleSignUp}>
          <AuthField id="signup-name" label="Name" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
          <AuthField id="signup-username" label="Username (3–32 characters; start with a letter or number)" autoComplete="username" minLength={3} maxLength={32} value={username} onChange={(event) => setUsername(event.target.value)} />
          <AuthField id="signup-email" label="Email address" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <AuthField id="signup-password" label="Password (8+ characters, upper/lowercase, number and symbol)" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
          <label className="auth-consent">
            <input type="checkbox" required />
            <span>
              I agree to the <a href={sitePath('/terms')}>Terms &amp; Conditions</a> and have read the{' '}
              <a href={sitePath('/privacy')}>Privacy Policy</a>.
            </span>
          </label>
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        </form>
        <p className="auth-switch">Already registered? <button type="button" onClick={() => goTo('sign-in')}>Sign in</button></p>
      </>
    );
  } else if (screen === 'forgot-password') {
    content = (
      <>
        <span className="auth-eyebrow">ACCOUNT RECOVERY</span>
        <h1>Reset your password</h1>
        <p className="auth-description">We’ll email you a secure link to choose a new password.</p>
        <form className="auth-form" onSubmit={handlePasswordReset}>
          <AuthField id="reset-email" label="Email address" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
        </form>
        <p className="auth-switch"><button type="button" onClick={() => goTo('sign-in')}>Back to sign in</button></p>
      </>
    );
  } else if (screen === 'mfa-challenge') {
    content = (
      <>
        <span className="auth-eyebrow">TWO-FACTOR SECURITY</span>
        <h1>Check your authenticator</h1>
        <p className="auth-description">Enter the current six-digit code from your authenticator app to finish signing in.</p>
        <form className="auth-form" onSubmit={handleMfaChallenge}>
          <AuthField id="login-otp" label="Authenticator code" type="text" autoComplete="one-time-code" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} />
          <button className="auth-submit" type="submit" disabled={busy || otp.length !== 6}>{busy ? 'Verifying…' : 'Verify and sign in'}</button>
        </form>
      </>
    );
  } else if (screen === 'mfa-required') {
    content = (
      <>
        <span className="auth-eyebrow">ADMINISTRATOR SECURITY</span>
        <h1>Secure your administrator account</h1>
        <p className="auth-description">Administrator access requires an authenticator app. Set it up before opening the dashboard.</p>
        <button className="auth-submit" type="button" onClick={beginMfaEnrollment} disabled={busy}>
          {busy ? 'Starting setup…' : 'Set up authenticator'}
        </button>
        <button className="auth-signout" type="button" onClick={handleSignOut} disabled={busy}>Sign out</button>
      </>
    );
  } else if (screen === 'mfa-enroll') {
    content = (
      <>
        <span className="auth-eyebrow">TWO-FACTOR SECURITY</span>
        <h1>Set up your authenticator</h1>
        <p className="auth-description">Scan this QR code with an authenticator app, then enter the six-digit code it generates.</p>
        {qrCode && <img className="auth-qr" src={qrCode} alt="Authenticator setup QR code" />}
        <p className="auth-secret"><strong>Setup key</strong><br /><code>{totpSecret}</code></p>
        <form className="auth-form" onSubmit={handleVerifyEnrollment}>
          <AuthField id="enroll-otp" label="Authenticator code" type="text" autoComplete="one-time-code" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} />
          <button className="auth-submit" type="submit" disabled={busy || otp.length !== 6}>{busy ? 'Verifying…' : 'Enable two-factor authentication'}</button>
        </form>
        <p className="auth-switch"><button type="button" onClick={cancelMfaEnrollment}>Cancel setup</button></p>
      </>
    );
  } else if (screen === 'mfa-disable') {
    content = (
      <>
        <span className="auth-eyebrow">TWO-FACTOR SECURITY</span>
        <h1>Confirm it’s you</h1>
        <p className="auth-description">Enter a current authenticator code to disable two-factor authentication.</p>
        <form className="auth-form" onSubmit={handleVerifyRemoval}>
          <AuthField id="disable-otp" label="Authenticator code" type="text" autoComplete="one-time-code" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} />
          <button className="auth-submit" type="submit" disabled={busy || otp.length !== 6}>{busy ? 'Verifying…' : 'Verify and disable'}</button>
        </form>
        <p className="auth-switch"><button type="button" onClick={() => goTo('account')}>Cancel</button></p>
      </>
    );
  } else if (screen === 'new-password') {
    content = (
      <>
        <span className="auth-eyebrow">ACCOUNT SECURITY</span>
        <h1>Choose a new password</h1>
        <p className="auth-description">Use at least 8 characters, including uppercase and lowercase letters, a number, and a special character.</p>
        <form className="auth-form" onSubmit={handleSetNewPassword}>
          <AuthField id="recovery-password" label="New password" type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
        </form>
      </>
    );
  } else if (session) {
    content = (
      <>
        <span className="auth-eyebrow">ACCOUNT SECURITY</span>
        <h1>Your account</h1>
        <p className="auth-description">Signed in as <strong>{session.user.email}</strong></p>
        <section className="auth-security">
          <div>
            <h2>Two-factor authentication</h2>
            <p>{verifiedFactor ? 'An authenticator app is protecting your account.' : 'Add an authenticator app for an extra sign-in check.'}</p>
          </div>
          {verifiedFactor
            ? <button className="auth-secondary" type="button" onClick={beginMfaRemoval} disabled={busy}>Disable authenticator</button>
            : <button className="auth-secondary" type="button" onClick={beginMfaEnrollment} disabled={busy}>Set up authenticator</button>}
        </section>
        <form className="auth-form auth-password-form" onSubmit={handleChangePassword}>
          <h2>Change password</h2>
          <AuthField id="account-new-password" label="New password (8+ characters, upper/lowercase, number and symbol)" type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Updating…' : 'Change password'}</button>
        </form>
        <button className="auth-signout" type="button" onClick={handleSignOut} disabled={busy}>Sign out</button>
        <section className="account-delete">
          <h2>Delete account</h2>
          <p>This permanently deletes your account and associated support requests. This action cannot be undone.</p>
          {!showDeleteConfirmation ? (
            <button
              className="account-delete-button"
              type="button"
              onClick={() => setShowDeleteConfirmation(true)}
              disabled={busy}
            >
              Delete my account
            </button>
          ) : (
            <form className="auth-form" onSubmit={handleDeleteAccount}>
              <div className="auth-field">
                <label htmlFor="delete-account-confirmation">Type DELETE to confirm</label>
                <input
                  id="delete-account-confirmation"
                  autoComplete="off"
                  value={deleteConfirmation}
                  onChange={(event) => setDeleteConfirmation(event.target.value)}
                  required
                />
              </div>
              <div className="account-delete-actions">
                <button className="account-delete-button" type="submit" disabled={busy || deleteConfirmation !== 'DELETE'}>
                  {busy ? 'Deleting account…' : 'Permanently delete account'}
                </button>
                <button
                  className="auth-secondary"
                  type="button"
                  onClick={() => {
                    setDeleteConfirmation('');
                    setShowDeleteConfirmation(false);
                  }}
                  disabled={busy}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      </>
    );
  } else {
    content = (
      <>
        <span className="auth-eyebrow">{isAdminPage ? 'ADMINISTRATOR ACCESS' : 'WELCOME BACK'}</span>
        <h1>{isAdminPage ? 'Administrator sign in' : 'Sign in'}</h1>
        <p className="auth-description">
          {isAdminPage
            ? 'Use the username and password for your dedicated administrator account.'
            : 'Sign in with your username and password to open your dashboard.'}
        </p>
        <form className="auth-form" onSubmit={handleSignIn}>
          <AuthField id="signin-username" label="Username or email" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} />
          <AuthField id="signin-password" label="Password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <div className="auth-links">
          <button type="button" onClick={() => goTo('forgot-password')}>Forgot password?</button>
          {!isAdminPage && <button type="button" onClick={() => goTo('sign-up')}>Create account</button>}
        </div>
      </>
    );
  }

  return (
    <>
      <main className="auth-page">
        <div className="auth-layout">
          <aside className="auth-aside">
            <span className="auth-aside-mark" aria-hidden="true">SP</span>
            <span className="auth-eyebrow">YOUR ACCOUNT, YOUR CONTROL</span>
            <h1>Good to have you here.</h1>
            <p>{isAdminPage ? 'Administrator sign-in is restricted to accounts explicitly granted the admin role.' : 'Sign in or create an account to open your secure user dashboard.'}</p>
            <ul className="auth-benefits">
              <li><span>01</span><div><strong>Secure access</strong><small>Email confirmation, usernames, and strong passwords help protect your account.</small></div></li>
              <li><span>02</span><div><strong>Extra protection</strong><small>Enable an authenticator app for two-factor verification.</small></div></li>
              <li><span>03</span><div><strong>Stay in control</strong><small>Manage your password and security preferences any time.</small></div></li>
            </ul>
          </aside>
          <section className="auth-card" aria-live="polite">
            {notice && <p className={`auth-notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
            {content}
            <a className="auth-home-link" href={sitePath('/')}>Return to home</a>
          </section>
        </div>
      </main>
    </>
  );
}
