import React, { useEffect, useState } from 'react';
import { openExternalUrl } from './native-app.js';
import { supabase } from './lib/supabase.js';
import { sitePath } from './site-path.js';

const contactEmail = 'pokharelsushil242@googlemail.com';
const siteOrigin = 'https://sushilpokharel00.com.np';

function setPageMetadata(title, description, path) {
  document.title = title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', description);
  const canonical = document.querySelector('link[rel="canonical"]');
  canonical?.setAttribute('href', `${siteOrigin}${path}`);
}

function PageIntro({ eyebrow, title, description, updated }) {
  return (
    <header className="info-intro">
      <span className="eyebrow"><span /> {eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
      {updated && <p className="info-updated">Last updated: {updated}</p>}
    </header>
  );
}

function PolicySection({ title, children }) {
  return (
    <section className="info-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function InfoLayout({ Header, Footer, eyebrow, title, description, updated, path, children }) {
  useEffect(() => {
    setPageMetadata(`${title} | Sushil Pokharel`, description, path);
  }, [description, path, title]);

  return (
    <>
      <Header />
      <main className="info-page">
        <div className="info-shell">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <a href={sitePath('/')}>Home</a>
            <span aria-hidden="true">/</span>
            <span>{title}</span>
          </nav>
          <PageIntro eyebrow={eyebrow} title={title} description={description} updated={updated} />
          <article className="info-content">{children}</article>
        </div>
      </main>
      <Footer />
    </>
  );
}

export function PrivacyPage({ Header, Footer }) {
  return (
    <InfoLayout
      Header={Header}
      Footer={Footer}
      eyebrow="YOUR INFORMATION"
      title="Privacy Policy"
      description="Learn what information this website handles, why it is used, and the choices available to you."
      updated="November 1, 2026"
      path="/privacy"
    >
      <p>
        This Privacy Policy explains how Sushil Pokharel (“I,” “me,” or “my”)
        handles information when you visit sushilpokharel00.com.np, use its
        account and support features, or download the Android app. It should be
        read with the <a href={sitePath('/terms')}>Terms &amp; Conditions</a>.
      </p>
      <PolicySection title="Information you provide">
        <ul>
          <li>
            <strong>Account information:</strong> your email address and, if you
            choose to provide it, your name. Supabase Auth handles account
            registration, sign-in, password recovery, and authentication
            factors. I do not receive or store your account password in
            readable form.
          </li>
          <li>
            <strong>Support requests:</strong> the subject and message you
            submit while signed in, along with your account ID and email
            address, so I can respond through your support inbox.
          </li>
          <li>
            <strong>Contact and beta emails:</strong> these forms prepare an
            email draft in your email app. The website does not send or store
            the draft; information is shared with the recipient only if you
            choose to send it.
          </li>
          <li>
            <strong>Profile and posts:</strong> your display name, optional
            avatar, and content you choose to save or submit for review. Only
            administrator-approved posts are publicly visible.
          </li>
          <li>
            <strong>Newsletter:</strong> if you subscribe, your email address
            is stored to send occasional updates after you confirm your
            subscription. Emails include an unsubscribe link.
          </li>
        </ul>
      </PolicySection>
      <PolicySection title="Information handled by the website">
        <p>
          Your browser stores the Supabase authentication session so account
          features can work between visits. The site may also receive
          operational information such as the page requested, browser
          information, and network information through the hosting, security,
          and service providers needed to deliver the site.
        </p>
      </PolicySection>
      <PolicySection title="Privacy-preserving site analytics">
        <p>
          If configured, the site records daily visits by page using a keyed
          hash derived from the request IP address. The raw address is not
          stored in the analytics table. The records help estimate traffic and
          are not a live-session tracker or an audited uptime service.
        </p>
      </PolicySection>
      <PolicySection title="Advertising, cookies, and similar technologies">
        <p>
          This website loads Google AdSense. Google and its advertising
          partners may use cookies, local storage, web beacons, or similar
          technologies to provide, measure, and personalize ads, subject to
          your location, consent choices, and Google’s settings. Advertising
          partners may receive information such as your browser, device, and
          visits to this site.
        </p>
        <p>
          You can manage ad personalization in{' '}
          <a href="https://adssettings.google.com/" target="_blank" rel="noreferrer">
            Google Ads Settings
          </a>
          . You can also manage cookies in your browser. Blocking them may
          affect some site or advertising features. Where applicable, Google’s
          consent choices or messaging may be presented for advertising
          technologies.
        </p>
        <p>
          For more details about how Google uses data from sites and apps that
          use its services, see{' '}
          <a
            href="https://policies.google.com/technologies/partner-sites"
            target="_blank"
            rel="noreferrer"
          >
            Google’s partner-site privacy information
          </a>
          .
        </p>
      </PolicySection>
      <PolicySection title="Why information is used">
        <p>
          Information is used to provide and secure account features, respond
          to support requests, maintain the website, operate advertising where
          enabled, and meet legal obligations. Information is not sold by me.
        </p>
      </PolicySection>
      <PolicySection title="Service providers and international processing">
        <p>
          Supabase provides authentication, database, and storage services.
          Resend delivers newsletter emails. Google provides advertising
          services. Website hosting and delivery providers may process
          technical request data. These providers handle information under
          their own privacy notices and service terms and may process it in
          countries other than Nepal.
        </p>
      </PolicySection>
      <PolicySection title="Retention and account deletion">
        <p>
          Account and support information is kept while it is needed to provide
          the relevant features, meet legal obligations, and protect the
          service. You can request deletion of your account from the account
          page. Deleting your account also removes its associated support
          requests from the active database; limited copies may remain
          temporarily in provider backups or records retained where required by
          law.
        </p>
      </PolicySection>
      <PolicySection title="Your choices and rights">
        <p>
          Depending on where you live, you may have rights to access, correct,
          delete, or restrict certain personal information. You can manage your
          account from the <a href={sitePath('/account/security')}>account security page</a> or
          contact me at <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
          You may also stop using the site and manage browser or advertising
          settings as described above.
        </p>
      </PolicySection>
      <PolicySection title="Children’s privacy and security">
        <p>
          The website is not designed to collect personal information from
          children under 13, and I do not knowingly seek such information.
          Reasonable measures are used to protect information, but no internet
          transmission or storage method can be guaranteed completely secure.
        </p>
      </PolicySection>
      <PolicySection title="Changes and contact">
        <p>
          This policy may be updated as the site or its services change. The
          date above identifies the current version. Questions or privacy
          requests can be sent to <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
        </p>
      </PolicySection>
    </InfoLayout>
  );
}

export function DisclaimerPage({ Header, Footer }) {
  return (
    <InfoLayout
      Header={Header}
      Footer={Footer}
      eyebrow="IMPORTANT INFORMATION"
      title="Disclaimer"
      description="Important information about this website, third-party advertising, and the Android app."
      updated="November 1, 2026"
      path="/disclaimer"
    >
      <PolicySection title="General information">
        <p>
          Content on this website is provided for general information about
          Sushil Pokharel, the website, its support features, and the Android
          app. It is not legal, financial, medical, or other professional
          advice. Obtain advice from a qualified professional for decisions
          that require it.
        </p>
      </PolicySection>
      <PolicySection title="Third-party advertising">
        <p>
          This site uses Google AdSense. Ads may be selected and delivered by
          Google or its partners. Their appearance does not mean I endorse or
          verify an advertiser, product, or service. Advertisers are
          responsible for their own claims, products, services, and linked
          pages. Review their terms and privacy information before interacting
          with them.
        </p>
        <p>
          Ads are separate from the site’s content. Please use the site
          normally; I do not ask visitors to click ads, and ad clicks are not a
          way to contact me or obtain support. Report advertising concerns
          through the appropriate Google controls.
        </p>
      </PolicySection>
      <PolicySection title="Third-party services and links">
        <p>
          The website may link to or rely on services operated by others,
          including Google and Supabase. Those services have their own
          availability, content, terms, and privacy practices. I do not control
          third-party services and am not responsible for changes to them.
        </p>
      </PolicySection>
      <PolicySection title="Android app">
        <p>
          The Android app packages website content for convenient access.
          Account, support, and other connected features require an internet
          connection and may depend on third-party services. The app is not
          intended for emergency or safety-critical use. Keep a copy of
          important information outside the app.
        </p>
      </PolicySection>
      <PolicySection title="Availability, accuracy, and liability">
        <p>
          I work to keep information useful and current, but do not guarantee
          that every page is complete, error-free, or available without
          interruption. To the extent allowed by applicable law, use of this
          website and app is at your discretion and risk. Nothing here limits
          rights or liability that cannot legally be excluded.
        </p>
      </PolicySection>
      <PolicySection title="Contact">
        <p>
          Questions about this disclaimer? Email{' '}
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a> or use the{' '}
          <a href={sitePath('/contact')}>contact page</a>.
        </p>
      </PolicySection>
    </InfoLayout>
  );
}

export function ContactPage({ Header, Footer }) {
  const [notice, setNotice] = useState('');
  const [fallbackUrl, setFallbackUrl] = useState('');

  useEffect(() => {
    setPageMetadata(
      'Contact | Sushil Pokharel',
      'Contact Sushil Pokharel with a question about the website, privacy, or Android app.',
      '/contact',
    );
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = formData.get('name').toString().trim();
    const email = formData.get('email').toString().trim();
    const subject = formData.get('subject').toString().trim();
    const message = formData.get('message').toString().trim();
    if (!name || !email || !subject || !message) {
      setNotice('Complete each field before preparing your email.');
      return;
    }

    const body = `Name: ${name}\nEmail: ${email}\n\n${message}`;
    const emailUrl = new URL(`mailto:${contactEmail}`);
    emailUrl.searchParams.set('subject', subject);
    emailUrl.searchParams.set('body', body);
    setFallbackUrl(emailUrl.toString());
    setNotice('Your email app should open with this message. Review and send it there; this form does not send or save your message.');
    void openExternalUrl(emailUrl.toString());
  }

  return (
    <>
      <Header />
      <main className="info-page">
        <div className="info-shell">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <a href={sitePath('/')}>Home</a><span aria-hidden="true">/</span><span>Contact</span>
          </nav>
          <PageIntro
            eyebrow="GET IN TOUCH"
            title="Contact"
            description="For a general question, privacy request, or app feedback, send a message using the form or email directly."
          />
          <div className="contact-page-layout">
            <section className="contact-card" aria-labelledby="contact-details-title">
              <span className="contact-label">CONTACT DETAILS</span>
              <h2 id="contact-details-title">Sushil Pokharel</h2>
              <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
              <p>Lokanthali, Bhaktapur, Nepal</p>
              <p>
                For private account support, sign in and use the{' '}
                <a href={sitePath('/support')}>support inbox</a>.
              </p>
            </section>
            <form className="contact-form info-contact-form" onSubmit={handleSubmit}>
              <h2>Send a message</h2>
              <p className="form-intro">
                Submitting prepares an email in your email app. Nothing is sent
                until you review and send it.
              </p>
              <div className="form-field">
                <label htmlFor="public-contact-name">Your name</label>
                <input id="public-contact-name" name="name" autoComplete="name" maxLength={100} required />
              </div>
              <div className="form-field">
                <label htmlFor="public-contact-email">Email address</label>
                <input id="public-contact-email" name="email" type="email" autoComplete="email" maxLength={254} required />
              </div>
              <div className="form-field">
                <label htmlFor="public-contact-subject">Subject</label>
                <input id="public-contact-subject" name="subject" maxLength={120} required />
              </div>
              <div className="form-field">
                <label htmlFor="public-contact-message">Message</label>
                <textarea id="public-contact-message" name="message" rows={6} maxLength={5000} required />
              </div>
              <button className="contact-submit" type="submit">Prepare email</button>
              <p className="form-status" role="status" aria-live="polite">
                {notice}
                {fallbackUrl && <> <a href={fallbackUrl}>Open the email draft</a>.</>}
              </p>
            </form>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

export function AndroidAppPage({ Header, Footer }) {
  useEffect(() => {
    setPageMetadata(
      'Android App | Sushil Pokharel',
      'Learn what the Sushil Pokharel Android app includes and download the latest APK.',
      '/android',
    );
  }, []);

  return (
    <InfoLayout
      Header={Header}
      Footer={Footer}
      eyebrow="ANDROID APP"
      title="The website on Android"
      description="A lightweight Android app that packages this website for convenient access on your device."
      path="/app"
    >
      <PolicySection title="What the app includes">
        <ul>
          <li>Access to the website and Terms &amp; Conditions from the installed app.</li>
          <li>Offline access to bundled website pages after installation.</li>
          <li>Online account, authentication, and support features when connected to the internet.</li>
          <li>External links and email drafts open through compatible apps on your device.</li>
        </ul>
      </PolicySection>
      <PolicySection title="Download the Android app">
        <p>
          Download the latest Android package from this website. The current
          website build workflow publishes the APK at the link below.
        </p>
        <a
          className="app-download-link android-download-button"
          href={sitePath('/downloads/Sushil-Pokharel.apk')}
          download="Sushil-Pokharel.apk"
        >
          Download APK
        </a>
        <p>
          This is an APK distributed directly from this website, not an app
          store listing. Android may ask you to allow installation from your
          browser or file manager. Only install it if you trust this source.
          Availability depends on your device and Android version.
        </p>
      </PolicySection>
      <PolicySection title="Privacy and support">
        <p>
          The app uses the same account and support services as the website.
          Review the <a href={sitePath('/privacy')}>Privacy Policy</a> before
          using connected features. For help, visit{' '}
          <a href={sitePath('/contact')}>Contact</a> or the signed-in{' '}
          <a href={sitePath('/support')}>support inbox</a>.
        </p>
      </PolicySection>
    </InfoLayout>
  );
}

function NewsletterSignup() {
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (data.get('company')) return;
    const email = data.get('email').toString().trim();
    if (!email) {
      setNotice('Enter your email address to continue.');
      return;
    }
    if (!supabase) {
      setNotice('Newsletter subscriptions are temporarily unavailable. Please try again later.');
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      const { data: result, error } = await supabase.functions.invoke('newsletter', {
        body: {
          action: 'subscribe',
          email,
          company: data.get('company')?.toString() ?? '',
          consent: true,
        },
      });
      if (error) throw error;
      if (!result?.ok) throw new Error(result?.error || 'Could not request your subscription.');
      form.reset();
      setNotice(result.message || 'Check your email for a confirmation link.');
    } catch (error) {
      setNotice(error.message || 'Could not request your subscription. Please try again later.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="newsletter-card" aria-labelledby="newsletter-title">
      <div>
        <span className="eyebrow"><span /> OCCASIONAL UPDATES</span>
        <h2 id="newsletter-title">Get the launch note.</h2>
        <p>Subscribe for occasional website and platform updates. Confirm your email before the subscription becomes active.</p>
      </div>
      <form className="newsletter-form" onSubmit={handleSubmit}>
        <label htmlFor="newsletter-email">Email address</label>
        <div className="newsletter-input-row">
          <input id="newsletter-email" name="email" type="email" autoComplete="email" maxLength={254} required />
          <button className="app-download-link" type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Subscribe'}
          </button>
        </div>
        <label className="newsletter-consent">
          <input type="checkbox" required />
          <span>I agree to receive occasional email updates. I can unsubscribe at any time. See the <a href={sitePath('/privacy')}>Privacy Policy</a>.</span>
        </label>
        <div className="newsletter-honeypot" aria-hidden="true">
          <label htmlFor="newsletter-company">Leave this field empty</label>
          <input id="newsletter-company" name="company" tabIndex={-1} autoComplete="off" />
        </div>
        <p className="form-status" role="status" aria-live="polite">{notice}</p>
      </form>
    </section>
  );
}

export function NewsletterActionPage({ Header, Footer }) {
  const [state, setState] = useState('ready');
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') ?? '';
  const action = params.get('action') === 'unsubscribe' ? 'unsubscribe' : 'confirm';

  useEffect(() => {
    setPageMetadata('Newsletter | Sushil Pokharel', 'Confirm or manage your email update subscription.', '/newsletter');
    if (!token) setState('invalid');
  }, [token]);

  async function handleAction() {
    if (!supabase || !token) {
      setState('error');
      return;
    }
    setState('working');
    try {
      const { data, error } = await supabase.functions.invoke('newsletter', {
        body: { action, token },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'The newsletter request could not be completed.');
      setState(action === 'confirm' ? 'confirmed' : 'unsubscribed');
    } catch (error) {
      setState('error');
      setNotice(error.message || 'The newsletter request could not be completed.');
    }
  }

  const [notice, setNotice] = useState('');
  const message = {
    ready: action === 'confirm' ? 'Confirm your email subscription' : 'Unsubscribe from email updates',
    working: 'Updating your subscription…',
    confirmed: 'Your email subscription is confirmed.',
    unsubscribed: 'You have been unsubscribed.',
    invalid: 'This subscription link is missing or invalid.',
    error: notice || 'This link may have expired. Request a new subscription link or contact support.',
  }[state];

  return (
    <>
      <Header />
      <main className="auth-page">
        <section className="auth-card" aria-live="polite">
          <span className="auth-eyebrow">EMAIL PREFERENCES</span>
          <h1>Newsletter</h1>
          <p className="auth-description">{message}</p>
          {['ready', 'error'].includes(state) && (
            <button className="auth-submit" type="button" onClick={handleAction}>
              {state === 'error' ? 'Try again' : action === 'confirm' ? 'Confirm subscription' : 'Unsubscribe'}
            </button>
          )}
          {state === 'working' && <p role="status">{message}</p>}
          <a className="auth-home-link" href={sitePath('/')}>Return to website</a>
        </section>
      </main>
      <Footer />
    </>
  );
}

export function PublicPostsPage({ Header, Footer }) {
  const [posts, setPosts] = useState([]);
  const [state, setState] = useState('loading');

  useEffect(() => {
    setPageMetadata(
      'Community posts | Sushil Pokharel',
      'Read posts approved for publication by the site administrator.',
      '/posts',
    );
    if (!supabase) {
      setState('unconfigured');
      return;
    }
    let active = true;
    supabase.from('user_posts')
      .select('id, title, content, featured, updated_at')
      .eq('status', 'approved')
      .order('featured', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setState('error');
          return;
        }
        setPosts(data);
        setState('ready');
      })
      .catch(() => {
        if (active) setState('error');
      });
    return () => { active = false; };
  }, []);

  return (
    <InfoLayout
      Header={Header}
      Footer={Footer}
      eyebrow="COMMUNITY"
      title="Published posts"
      description="Posts submitted by users and approved by the site administrator."
      path="/posts"
    >
      {state === 'loading' && <p role="status">Loading published posts…</p>}
      {state === 'unconfigured' && <p>Published posts are temporarily unavailable.</p>}
      {state === 'error' && <p role="alert">Published posts could not be loaded. Please try again later.</p>}
      {state === 'ready' && posts.length === 0 && <p>There are no published posts yet.</p>}
      {posts.map((post) => (
        <PolicySection key={post.id} title={post.title}>
          {post.featured && <p className="post-featured-label">Featured post</p>}
          <p className="public-post-content">{post.content}</p>
          <p className="info-updated">Updated {new Date(post.updated_at).toLocaleDateString()}</p>
        </PolicySection>
      ))}
    </InfoLayout>
  );
}

export function HomeContent() {
  const [siteSettings, setSiteSettings] = useState({
    is_maintenance: true,
    maintenance_title: 'We’re making improvements.',
    maintenance_message: 'The website is temporarily under maintenance while I prepare updated project information, account tools, and app resources.',
    site_name: 'Sushil Pokharel',
    site_description: 'Website information, account and support tools, policies, and Android app details from Sushil Pokharel in Bhaktapur, Nepal.',
  });
  const [settingsWarning, setSettingsWarning] = useState('');

  useEffect(() => {
    setPageMetadata(
      `${siteSettings.site_name} | Home`,
      siteSettings.site_description,
      '/',
    );
  }, [siteSettings.site_description, siteSettings.site_name]);

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    supabase.from('site_settings')
      .select('is_maintenance, maintenance_title, maintenance_message, site_name, site_description')
      .eq('id', 1)
      .single()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setSettingsWarning('The latest website status is temporarily unavailable; the default status is shown.');
          return;
        }
        setSiteSettings(data);
      })
      .catch(() => {
        if (active) setSettingsWarning('The latest website status is temporarily unavailable; the default status is shown.');
      });
    return () => { active = false; };
  }, []);

  return (
    <main className="home-content">
      <section className="home-intro" aria-labelledby="home-title">
        <div className="home-intro-inner">
          <span className="eyebrow"><span /> {siteSettings.is_maintenance ? 'WEBSITE STATUS' : 'NOW OPEN'} · BHAKTAPUR, NEPAL</span>
          <span className="home-status-pill">{siteSettings.is_maintenance ? 'Website refresh in progress' : 'Website is open'}</span>
          <h1 id="home-title">{siteSettings.maintenance_title}</h1>
          <p>
            {siteSettings.maintenance_message} Essential information, account
            tools, and support remain available here.
          </p>
          {settingsWarning && <p className="maintenance-settings-warning" role="status">{settingsWarning}</p>}
          <div className="home-quick-links">
            <a className="app-download-link" href={sitePath('/app')}>Explore the Android app</a>
            <a className="home-secondary-link" href={sitePath('/contact')}>Contact me</a>
          </div>
        </div>
        <NewsletterSignup />
        <div className="home-topic-grid">
          <article>
            <h2>Website policies</h2>
            <p>Find practical information about site use, privacy, and third-party advertising.</p>
            <a href={sitePath('/terms')}>Read the Terms &amp; Conditions</a>
            <a href={sitePath('/privacy')}>Read the Privacy Policy</a>
            <a href={sitePath('/disclaimer')}>Read the Disclaimer</a>
          </article>
          <article>
            <h2>Accounts and support</h2>
            <p>Manage your sign-in, use two-factor security, or send a private support request.</p>
            <a href={sitePath('/account/security')}>Manage your account</a>
            <a href={sitePath('/posts')}>Read community posts</a>
            <a href={sitePath('/support')}>Open the support inbox</a>
          </article>
          <article>
            <h2>App and beta access</h2>
            <p>Read about the Android app or send an email to request beta access.</p>
            <a href={sitePath('/app')}>Android app information</a>
            <a href={sitePath('/beta')}>Request beta access</a>
            <a href={sitePath('/status')}>Website status and updates</a>
          </article>
        </div>
      </section>
    </main>
  );
}
