import React, { useEffect, useRef, useState } from 'react';
import { supabase } from './lib/supabase.js';
import { sitePath } from './site-path.js';

function setPageMetadata(title, description) {
  document.title = title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', description);
}

function AuthField({ id, label, type = 'text', autoComplete, minLength, value, onChange, required = true }) {
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        minLength={minLength}
        value={value}
        onChange={onChange}
        required={required}
      />
    </div>
  );
}

export default function AuthPage({ isAccountPage = false }) {
  const [session, setSession] = useState(null);
  const [screen, setScreen] = useState('loading');
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [factorId, setFactorId] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [verifiedFactor, setVerifiedFactor] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const recoveryFlowRef = useRef(false);

  useEffect(() => {
    setPageMetadata(
      isAccountPage ? 'Your account | Sushil Pokharel' : 'Sign in | Sushil Pokharel',
      'Sign in or create an account, manage your password, and set up authenticator-based two-factor authentication.',
    );
  }, [isAccountPage]);

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
        setScreen('sign-in');
        return;
      }

      await continueWithSession();
    }

    initializeSession().catch((error) => {
      setNotice({ kind: 'error', text: error.message || 'Could not restore your sign-in session.' });
      setScreen('sign-in');
    });

    return () => subscription.unsubscribe();
  }, []);

  async function continueWithSession() {
    const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError) throw assuranceError;

    if (assurance.nextLevel === 'aal2' && assurance.currentLevel !== 'aal2') {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const factor = data.totp.find((item) => item.status === 'verified');
      if (factor) {
        setFactorId(factor.id);
        setScreen('mfa-challenge');
        return 'mfa-challenge';
      }
    }

    await refreshVerifiedFactor();
    setScreen(recoveryFlowRef.current ? 'new-password' : 'account');
    return recoveryFlowRef.current ? 'new-password' : 'account';
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
      () => supabase.auth.signInWithPassword({ email: email.trim(), password }),
      async () => {
        setPassword('');
        const nextScreen = await continueWithSession();
        if (nextScreen !== 'mfa-challenge') {
          setNotice({ kind: 'success', text: 'You are signed in.' });
        }
      },
    );
  }

  async function handleSignUp(event) {
    event.preventDefault();
    await runAction(
      () => supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: new URL(sitePath('/account'), window.location.origin).toString(),
        },
      }),
      async ({ data }) => {
        setPassword('');
        if (data.session) {
          setSession(data.session);
          const nextScreen = await continueWithSession();
          if (nextScreen !== 'mfa-challenge') {
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
        redirectTo: new URL(sitePath('/account'), window.location.origin).toString(),
      }),
      () => setNotice({ kind: 'success', text: 'If an account exists for that email, a password reset link is on its way.' }),
    );
  }

  async function handleSetNewPassword(event) {
    event.preventDefault();
    await runAction(
      () => supabase.auth.updateUser({ password: newPassword }),
      async () => {
        setNewPassword('');
        recoveryFlowRef.current = false;
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
        setScreen('account');
        setNotice({ kind: 'success', text: 'Two-factor verification complete.' });
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
        setScreen('account');
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
        () => setScreen('account'),
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
          Add the Supabase project URL and public anon key as GitHub Actions secrets, then redeploy this site.
        </p>
      </>
    );
  } else if (screen === 'loading') {
    content = <p className="auth-description" role="status">Checking your sign-in session…</p>;
  } else if (screen === 'sign-up') {
    content = (
      <>
        <span className="auth-eyebrow">CREATE AN ACCOUNT</span>
        <h1>Sign up</h1>
        <p className="auth-description">Create an account with your email address and a strong password.</p>
        <form className="auth-form" onSubmit={handleSignUp}>
          <AuthField id="signup-name" label="Name" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
          <AuthField id="signup-email" label="Email address" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <AuthField id="signup-password" label="Password (at least 12 characters)" type="password" autoComplete="new-password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} />
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
        <p className="auth-description">Use at least 12 characters. A password manager can help you create and store a unique password.</p>
        <form className="auth-form" onSubmit={handleSetNewPassword}>
          <AuthField id="recovery-password" label="New password" type="password" autoComplete="new-password" minLength={12} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
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
          <AuthField id="account-new-password" label="New password (at least 12 characters)" type="password" autoComplete="new-password" minLength={12} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Updating…' : 'Change password'}</button>
        </form>
        <button className="auth-signout" type="button" onClick={handleSignOut} disabled={busy}>Sign out</button>
      </>
    );
  } else {
    content = (
      <>
        <span className="auth-eyebrow">WELCOME BACK</span>
        <h1>Sign in</h1>
        <p className="auth-description">Sign in to manage your account and security settings.</p>
        <form className="auth-form" onSubmit={handleSignIn}>
          <AuthField id="signin-email" label="Email address" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <AuthField id="signin-password" label="Password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <div className="auth-links">
          <button type="button" onClick={() => goTo('forgot-password')}>Forgot password?</button>
          <button type="button" onClick={() => goTo('sign-up')}>Create account</button>
        </div>
      </>
    );
  }

  return (
    <>
      <main className="auth-page">
        <section className="auth-card" aria-live="polite">
          {notice && <p className={`auth-notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
          {content}
          <a className="auth-home-link" href={sitePath('/')}>Return to home</a>
        </section>
      </main>
    </>
  );
}
