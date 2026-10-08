import React, { useEffect, useState } from 'react';

const sections = [
  { id: 'agreement', title: 'Agreement to these terms' },
  { id: 'eligibility', title: 'Eligibility and your account' },
  { id: 'acceptable-use', title: 'Acceptable use' },
  { id: 'your-content', title: 'Your content' },
  { id: 'intellectual-property', title: 'Intellectual property' },
  { id: 'payments', title: 'Payments and subscriptions' },
  { id: 'third-party', title: 'Third-party services' },
  { id: 'disclaimers', title: 'Disclaimers' },
  { id: 'liability', title: 'Limitation of liability' },
  { id: 'indemnification', title: 'Indemnification' },
  { id: 'termination', title: 'Termination' },
  { id: 'changes', title: 'Changes to these terms' },
  { id: 'governing-law', title: 'Governing law' },
  { id: 'contact', title: 'Contact us' },
];

function setPageMetadata(title, description) {
  document.title = title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', description);
}

function Brand() {
  return (
    <a className="brand" href="/" aria-label="Sushil Pokharel home">
      <span className="brand-mark" aria-hidden="true">
        <span>SP</span>
      </span>
      <span>Sushil Pokharel</span>
    </a>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <path d="M4.5 10h11m-4.5-4.5 4.5 4.5-4.5 4.5" />
    </svg>
  );
}

function Header() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Brand />
        <nav className="header-nav" aria-label="Main navigation">
          <a href="/terms">Terms</a>
          <a href="/beta">Beta access</a>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <Brand />
        <a className="footer-email" href="/beta">Beta access by request</a>
        <span>Lokanthali, Bhaktapur, Nepal · © {new Date().getFullYear()} Sushil Pokharel</span>
      </div>
    </footer>
  );
}

function Section({ id, title, children }) {
  return (
    <section className="terms-section" id={id}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function TermsPage() {
  const [contactStatus, setContactStatus] = useState('');
  const [fallbackEmailUrl, setFallbackEmailUrl] = useState('');

  useEffect(() => {
    setPageMetadata(
      'Terms & Conditions | Sushil Pokharel',
      'Read the Terms & Conditions for the website and services provided by Sushil Pokharel.',
    );
  }, []);

  function handleContactSubmit(event) {
    event.preventDefault();
    setFallbackEmailUrl('');

    const formData = new FormData(event.currentTarget);
    const name = formData.get('name').toString().trim();
    const email = formData.get('email').toString().trim();
    const subject = formData.get('subject').toString().trim();
    const message = formData.get('message').toString().trim();
    if (!name || !email || !subject || !message) {
      setContactStatus('Please complete every field with non-blank information before composing your email.');
      return;
    }

    const body = `Name: ${name}\nEmail: ${email}\n\n${message}`;
    const gmailComposeUrl = new URL('https://mail.google.com/mail/');
    gmailComposeUrl.searchParams.set('view', 'cm');
    gmailComposeUrl.searchParams.set('fs', '1');
    gmailComposeUrl.searchParams.set('to', 'pokharelsushil242@googlemail.com');
    gmailComposeUrl.searchParams.set('su', subject);
    gmailComposeUrl.searchParams.set('body', body);
    const fallbackUrl = new URL('mailto:pokharelsushil242@googlemail.com');
    fallbackUrl.searchParams.set('subject', subject);
    fallbackUrl.searchParams.set('body', body);

    window.open(gmailComposeUrl.toString(), '_blank', 'noopener,noreferrer');
    setFallbackEmailUrl(fallbackUrl.toString());
    setContactStatus('Gmail should open in a new tab with your message addressed to Sushil. Sign in if prompted, then review and send your email.');
  }

  return (
    <>
      <Header />
      <main>
        <div className="page-shell">
          <div className="breadcrumb">
            <a href="/">Home</a>
            <span aria-hidden="true">/</span>
            <span>Terms &amp; Conditions</span>
          </div>

          <section className="page-intro">
            <span className="eyebrow"><span /> THE IMPORTANT DETAILS</span>
            <h1>Terms &amp; Conditions</h1>
            <p className="intro-copy">
              Clear, straightforward terms for using the website and services
              provided by Sushil Pokharel.
            </p>
            <div className="document-meta">
              <span className="meta-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none">
                  <rect x="3.25" y="4.25" width="13.5" height="12.5" rx="2" />
                  <path d="M6.5 2.75v3M13.5 2.75v3M3.5 8h13" />
                </svg>
              </span>
              <span>Last updated: <strong>October 8, 2026</strong></span>
              <span className="meta-divider" />
              <span>Estimated reading time: <strong>8 minutes</strong></span>
            </div>
          </section>

          <div className="legal-note">
            <span className="note-icon" aria-hidden="true">i</span>
            <p>
              <strong>Important:</strong> These terms are intended as a clear
              website-use framework for Sushil Pokharel’s online presence and
              services. They are not a substitute for legal advice, and any
              business-specific arrangement should be reviewed in light of local
              laws and applicable contracts.
            </p>
          </div>

          <div className="content-layout">
            <aside className="table-of-contents">
              <p className="toc-heading">ON THIS PAGE</p>
              <nav aria-label="Terms sections">
                {sections.map((section, index) => (
                  <a key={section.id} href={`#${section.id}`}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    {section.title}
                  </a>
                ))}
              </nav>
            </aside>

            <article className="terms-content">
              <p className="terms-lead">
                Please read these Terms &amp; Conditions (“Terms”) carefully.
                They explain the rules that apply when you access or use
                Sushil Pokharel’s website, portfolio, digital services, and any
                related client communications or work delivered through the
                platform (together, the “Services”).
              </p>

              <Section id="agreement" title="1. Agreement to these terms">
                <p>
                  These Terms form a binding agreement between you and
                  <strong> Sushil Pokharel</strong> (“we,” “us,” or “our”),
                  located in <strong>Lokanthali, Bhaktapur, Nepal</strong>.
                  By accessing or using the Services, you agree to these Terms.
                  If you do not agree, please do not use the Services.
                </p>
                <p>
                  If you use the Services on behalf of an organization, you
                  confirm that you have authority to accept these Terms for
                  that organization. In that case, “you” includes the
                  organization and any person acting for it.
                </p>
              </Section>

              <Section id="eligibility" title="2. Eligibility and your account">
                <p>
                  You must be legally able to enter into a binding agreement
                  where you live to use the Services. If a feature requires an
                  account, you agree to provide accurate information, keep your
                  sign-in details secure, and promptly tell us if you suspect
                  unauthorized access.
                </p>
                <p>
                  You are responsible for activity under your account, except
                  to the extent it results from our failure to use reasonable
                  security measures or a breach by us of these Terms.
                </p>
              </Section>

              <Section id="acceptable-use" title="3. Acceptable use">
                <p>
                  Use the Services lawfully and respectfully. You must not
                  misuse or interfere with the Services, attempt unauthorized
                  access, introduce malicious code, send abusive or unlawful
                  messages, or use the Services in a way that infringes another
                  person’s rights.
                </p>
                <p>
                  We may investigate suspected violations and take reasonable
                  steps to protect the Services, our users, and others.
                </p>
              </Section>

              <Section id="your-content" title="4. Your content">
                <p>
                  You retain ownership of content you submit or make available
                  through the Services (“Your Content”). You give us permission
                  to host, use, reproduce, and display Your Content only as
                  reasonably necessary to provide, maintain, secure, and
                  improve the Services, respond to inquiries, and perform any
                  agreed project or service work.
                </p>
                <p>
                  You confirm that you have the rights needed to provide Your
                  Content and that doing so does not violate applicable law or
                  these Terms.
                </p>
              </Section>

              <Section id="intellectual-property" title="5. Intellectual property">
                <p>
                  The Services and their original content, features, and
                  branding belong to Sushil Pokharel or its licensors and are
                  protected by intellectual property laws. Except for the
                  limited right to use the Services under these Terms, no
                  ownership rights are transferred to you.
                </p>
              </Section>

              <Section id="payments" title="6. Payments and project work">
                <p>
                  If a Service requires payment, we will show you the
                  applicable price, billing period, and any renewal,
                  cancellation, or project-stage payment details before you
                  proceed. For custom work, project scope, timeline, and fees
                  will be agreed in writing before work begins unless otherwise
                  stated in a separate agreement.
                </p>
                <p>
                  Unless a refund right is required by law or a separate
                  written agreement says otherwise, fees are generally
                  non-refundable once work has started or services have been
                  delivered. You authorize us or our payment provider to charge
                  your selected payment method for the amounts you approve.
                </p>
              </Section>

              <Section id="third-party" title="7. Third-party services">
                <p>
                  The Services may link to or work with third-party websites
                  and tools. Those services are governed by their own terms and
                  privacy policies. We are not responsible for third-party
                  services that we do not control.
                </p>
              </Section>

              <Section id="disclaimers" title="8. Disclaimers">
                <p>
                  To the extent permitted by law, the Services are provided
                  “as is” and “as available.” We do not promise that the
                  Services will always be uninterrupted, error-free, or
                  suitable for every particular purpose. Nothing in these Terms
                  limits a consumer right that cannot legally be excluded.
                </p>
              </Section>

              <Section id="liability" title="9. Limitation of liability">
                <p>
                  To the extent permitted by law, Sushil Pokharel will not be liable
                  for indirect, incidental, special, consequential, or
                  punitive losses, or loss of profits, data, or goodwill,
                  arising from your use of the Services.
                </p>
                <p>
                  Nothing in these Terms excludes or limits liability or
                  consumer rights that cannot legally be excluded or limited.
                </p>
              </Section>

              <Section id="indemnification" title="10. Indemnification">
                <p>
                  To the extent permitted by law, you agree to be responsible
                  for third-party claims arising directly from your unlawful
                  use of the Services or your material breach of these Terms.
                  This does not apply where a claim results from our own
                  conduct or where applicable law does not permit this
                  allocation.
                </p>
              </Section>

              <Section id="termination" title="11. Termination">
                <p>
                  You may stop using the Services at any time. We may suspend
                  or end access if reasonably necessary to protect the
                  Services, comply with law, or address a material breach of
                  these Terms. Where appropriate, we will provide notice and
                  an opportunity to address the issue.
                </p>
                <p>
                  Terms that by their nature should continue after termination
                  will remain in effect.
                </p>
              </Section>

              <Section id="changes" title="12. Changes to these terms">
                <p>
                  We may update these Terms as our Services or legal
                  requirements change. For material changes, we will take
                  reasonable steps to notify you before they take effect.
                  The “Last updated” date shows when the current version was
                  published. Continued use after the effective date means the
                  updated Terms apply.
                </p>
              </Section>

              <Section id="governing-law" title="13. Governing law">
                <p>
                  These Terms are governed by the laws of
                  <strong> Nepal</strong>, without regard to conflict
                  of law principles. Courts located in <strong>Bhaktapur, Nepal</strong>
                  will have jurisdiction, subject to any mandatory rights you
                  have under the laws where you live.
                </p>
              </Section>

              <Section id="contact" title="14. Contact us">
                <p>
                  Questions about these Terms? Contact us using the details
                  below:
                </p>
                <div className="contact-card">
                  <span className="contact-label">TERMS &amp; CONDITIONS</span>
                  <strong>Sushil Pokharel</strong>
                  <a href="mailto:pokharelsushil242@googlemail.com">
                    pokharelsushil242@googlemail.com
                  </a>
                  <span>Lokanthali, Bhaktapur, Nepal</span>
                </div>
                <form className="contact-form" onSubmit={handleContactSubmit}>
                  <h3>Send a message</h3>
                  <p className="form-intro">
                    Send a message to Sushil Pokharel at
                    {' '}pokharelsushil242@googlemail.com. We’ll open Gmail with
                    your details filled in so you can review and send it.
                  </p>
                  <div className="form-field">
                    <label htmlFor="contact-name">Your name</label>
                    <input
                      autoComplete="name"
                      id="contact-name"
                      name="name"
                      placeholder="Your name"
                      required
                      maxLength={100}
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="contact-email">Email address</label>
                    <input
                      autoComplete="email"
                      id="contact-email"
                      name="email"
                      placeholder="you@example.com"
                      required
                      type="email"
                      maxLength={254}
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="contact-subject">Subject</label>
                    <input
                      id="contact-subject"
                      name="subject"
                      placeholder="What is this about?"
                      required
                      maxLength={120}
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="contact-message">Message</label>
                    <textarea
                      id="contact-message"
                      name="message"
                      placeholder="Write your message here..."
                      required
                      rows={5}
                      maxLength={5000}
                    />
                  </div>
                  <button className="contact-submit" type="submit">
                    Compose in Gmail
                    <ArrowIcon />
                  </button>
                  <p className="form-status" aria-live="polite" role="status">
                    {contactStatus}
                    {fallbackEmailUrl && (
                      <>
                        {' '}If Gmail does not open,{' '}
                        <a href={fallbackEmailUrl}>try your default email app</a>.
                      </>
                    )}
                  </p>
                </form>
              </Section>

              <div className="end-note">
                <span className="end-mark" aria-hidden="true">
                  <svg viewBox="0 0 32 32" fill="none">
                    <path d="M16 3.5 18.7 13.3 28.5 16l-9.8 2.7L16 28.5l-2.7-9.8L3.5 16l9.8-2.7L16 3.5Z" />
                  </svg>
                </span>
                <p>That’s the fine print. Thanks for taking the time.</p>
              </div>
            </article>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function MaintenancePage() {
  const [activeForm, setActiveForm] = useState(null);
  const [contactStatus, setContactStatus] = useState('');
  const [betaStatus, setBetaStatus] = useState('');

  useEffect(() => {
    setPageMetadata(
      'Under maintenance | Sushil Pokharel',
      'This website is temporarily under maintenance. Request beta access or contact Sushil Pokharel.',
    );
  }, []);

  function handleContactSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = formData.get('name').toString().trim();
    const email = formData.get('email').toString().trim();
    const subject = formData.get('subject').toString().trim();
    const message = formData.get('message').toString().trim();
    const wantsNotifications = formData.get('notifications') === 'on';

    if (!name || !email || !subject || !message) {
      setContactStatus('Please complete every field before sending your message.');
      return;
    }

    const body = [
      'Name: ' + name,
      'Email: ' + email,
      wantsNotifications ? 'Notification preference: I would like email updates and release notifications.' : 'Notification preference: No update notifications requested.',
      '',
      message,
    ].join('\n');

    const gmailComposeUrl = new URL('https://mail.google.com/mail/');
    gmailComposeUrl.searchParams.set('view', 'cm');
    gmailComposeUrl.searchParams.set('fs', '1');
    gmailComposeUrl.searchParams.set('to', 'pokharelsushil242@googlemail.com');
    gmailComposeUrl.searchParams.set('su', subject);
    gmailComposeUrl.searchParams.set('body', body);

    const fallbackUrl = new URL('mailto:pokharelsushil242@googlemail.com');
    fallbackUrl.searchParams.set('subject', subject);
    fallbackUrl.searchParams.set('body', body);

    window.open(gmailComposeUrl.toString(), '_blank', 'noopener,noreferrer');
    setContactStatus('Your message is ready in Gmail. Review and send it to complete your enquiry.');
    setActiveForm('contact');
    window.sessionStorage.setItem('maintenance-contact-fallback', fallbackUrl.toString());
  }

  function handleBetaSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = formData.get('name').toString().trim();
    const email = formData.get('email').toString().trim();
    const message = formData.get('message').toString().trim();
    const wantsNotifications = formData.get('notifications') === 'on';

    if (!name || !email || !message) {
      setBetaStatus('Please complete all required fields before joining the beta waitlist.');
      return;
    }

    const body = [
      'Beta access request',
      '',
      'Name: ' + name,
      'Email: ' + email,
      wantsNotifications ? 'Notification preference: I would like beta release updates and launch notifications.' : 'Notification preference: No update notifications requested.',
      '',
      message,
    ].join('\n');

    const gmailUrl = new URL('https://mail.google.com/mail/');
    gmailUrl.searchParams.set('view', 'cm');
    gmailUrl.searchParams.set('fs', '1');
    gmailUrl.searchParams.set('to', 'pokharelsushil242@googlemail.com');
    gmailUrl.searchParams.set('su', 'Beta access request');
    gmailUrl.searchParams.set('body', body);

    const emailUrl = new URL('mailto:pokharelsushil242@googlemail.com');
    emailUrl.searchParams.set('subject', 'Beta access request');
    emailUrl.searchParams.set('body', body);

    window.open(gmailUrl.toString(), '_blank', 'noopener,noreferrer');
    setBetaStatus('Your beta request is ready in Gmail. Review and send it to confirm your interest.');
    setActiveForm('beta');
    window.sessionStorage.setItem('beta-access-email-fallback', emailUrl.toString());
  }

  return (
    <>
      <Header />
      <main className="home-maintenance">
        <section className="maintenance-message" aria-labelledby="maintenance-title">
          <div className="status-emblem" aria-hidden="true">
            <span className="status-orbit" />
            <span className="status-core" />
          </div>
          <span className="eyebrow"><span /> WEBSITE STATUS</span>
          <h1 id="maintenance-title">We’ll be back after maintenance.</h1>
          <p className="maintenance-copy">
            We’re working on the website. There is no confirmed reopening
            date. You can still contact Sushil or request beta access below.
          </p>
          <div className="maintenance-details">
            <span className="maintenance-detail-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="none">
                <path d="M10 17s5.5-4.7 5.5-9.2a5.5 5.5 0 1 0-11 0C4.5 12.3 10 17 10 17Z" />
                <circle cx="10" cy="7.8" r="1.8" />
              </svg>
            </span>
            <span>Lokanthali, Bhaktapur, Nepal</span>
          </div>
          <div className="beta-notice" role="note">
            <span className="beta-notice-icon" aria-hidden="true">i</span>
            <span>
              Choose the option that matches your goal and complete the short form.
              Sushil will review your request and follow up when appropriate.
            </span>
          </div>
          <div className="request-toggle-row" aria-label="Contact options">
            <button
              type="button"
              className={`request-toggle ${activeForm === 'contact' ? 'is-active' : ''}`}
              onClick={() => setActiveForm(activeForm === 'contact' ? null : 'contact')}
              aria-expanded={activeForm === 'contact'}
            >
              Contact Sushil
            </button>
            <button
              type="button"
              className={`request-toggle ${activeForm === 'beta' ? 'is-active' : ''}`}
              onClick={() => setActiveForm(activeForm === 'beta' ? null : 'beta')}
              aria-expanded={activeForm === 'beta'}
            >
              Request beta access
            </button>
          </div>

          <div className={`request-panel ${activeForm === 'contact' ? 'is-open' : ''}`} aria-hidden={activeForm !== 'contact'}>
            <form className="contact-form" onSubmit={handleContactSubmit}>
              <h3>Send a message</h3>
              <p className="form-intro">
                Share your inquiry and choose whether you would like email updates.
              </p>
              <div className="form-field">
                <label htmlFor="maintenance-contact-name">Your name</label>
                <input id="maintenance-contact-name" name="name" autoComplete="name" maxLength={100} required />
              </div>
              <div className="form-field">
                <label htmlFor="maintenance-contact-email">Email address</label>
                <input id="maintenance-contact-email" name="email" type="email" autoComplete="email" maxLength={254} required />
              </div>
              <div className="form-field">
                <label htmlFor="maintenance-contact-subject">Subject</label>
                <input id="maintenance-contact-subject" name="subject" maxLength={160} required />
              </div>
              <div className="form-field">
                <label htmlFor="maintenance-contact-message">Message</label>
                <textarea id="maintenance-contact-message" name="message" rows={5} maxLength={3000} required />
              </div>
              <label className="checkbox-row" htmlFor="maintenance-contact-notify">
                <input id="maintenance-contact-notify" type="checkbox" name="notifications" />
                <span>I would like to receive email updates and project notifications.</span>
              </label>
              <button className="contact-submit" type="submit">
                Send message <ArrowIcon />
              </button>
              <p className="form-status" role="status">
                {contactStatus}
              </p>
            </form>
          </div>

          <div className={`request-panel ${activeForm === 'beta' ? 'is-open' : ''}`} aria-hidden={activeForm !== 'beta'}>
            <form className="contact-form beta-form" onSubmit={handleBetaSubmit}>
              <h3>Request beta access</h3>
              <p className="form-intro">
                Tell Sushil a little about yourself and whether you’d like beta updates.
              </p>
              <div className="form-field">
                <label htmlFor="maintenance-beta-name">Your name</label>
                <input id="maintenance-beta-name" name="name" autoComplete="name" maxLength={100} required />
              </div>
              <div className="form-field">
                <label htmlFor="maintenance-beta-email">Email address</label>
                <input id="maintenance-beta-email" name="email" type="email" autoComplete="email" maxLength={254} required />
              </div>
              <div className="form-field">
                <label htmlFor="maintenance-beta-message">Why do you want beta access?</label>
                <textarea id="maintenance-beta-message" name="message" rows={5} maxLength={3000} required />
              </div>
              <label className="checkbox-row" htmlFor="maintenance-beta-notify">
                <input id="maintenance-beta-notify" type="checkbox" name="notifications" />
                <span>I would like to receive beta launch and update notifications.</span>
              </label>
              <button className="contact-submit" type="submit">
                Continue to Gmail <ArrowIcon />
              </button>
              <p className="form-status" role="status">
                {betaStatus}
              </p>
            </form>
          </div>

          <div className="maintenance-policy-link">
            <a className="maintenance-terms-link" href="/terms">
              View Terms &amp; Conditions <ArrowIcon />
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function BetaRequestPage() {
  const [formError, setFormError] = useState('');

  useEffect(() => {
    setPageMetadata(
      'Request beta access | Sushil Pokharel',
      'Contact Sushil Pokharel to request beta access.',
    );
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = formData.get('name').toString().trim();
    const email = formData.get('email').toString().trim();
    const message = formData.get('message').toString().trim();

    if (!name || !email || !message) {
      setFormError('Please complete each field before continuing.');
      return;
    }

    setFormError('');
    const body = `Beta access request\n\nName: ${name}\nEmail: ${email}\n\n${message}`;
    const gmailUrl = new URL('https://mail.google.com/mail/');
    gmailUrl.searchParams.set('view', 'cm');
    gmailUrl.searchParams.set('fs', '1');
    gmailUrl.searchParams.set('to', 'pokharelsushil242@googlemail.com');
    gmailUrl.searchParams.set('su', 'Beta access request');
    gmailUrl.searchParams.set('body', body);

    const emailUrl = new URL('mailto:pokharelsushil242@googlemail.com');
    emailUrl.searchParams.set('subject', 'Beta access request');
    emailUrl.searchParams.set('body', body);

    window.open(gmailUrl.toString(), '_blank', 'noopener,noreferrer');
    try {
      window.sessionStorage.setItem('beta-access-email-fallback', emailUrl.toString());
    } catch (error) {
      console.error('Unable to save the beta request email fallback.', error);
    }
    window.location.assign('/beta-requested?submitted=1');
  }

  return (
    <>
      <Header />
      <main className="beta-page">
        <div className="beta-shell">
          <div className="breadcrumb">
            <a href="/">Home</a>
            <span aria-hidden="true">/</span>
            <span>Beta access</span>
          </div>
          <section className="beta-card" aria-labelledby="beta-title">
            <div className="beta-layout">
              <div className="beta-overview">
                <span className="eyebrow"><span /> EARLY ACCESS</span>
                <h1 id="beta-title">Request beta access</h1>
                <p className="beta-intro">
                  Interested in trying the beta? Tell Sushil a little about
                  yourself and why you’d like to take part.
                </p>
                <div className="beta-steps" aria-label="How the request works">
                  <div className="beta-step">
                    <span>01</span>
                    <p>Complete the short request form.</p>
                  </div>
                  <div className="beta-step">
                    <span>02</span>
                    <p>Review and send your email in Gmail.</p>
                  </div>
                  <div className="beta-step">
                    <span>03</span>
                    <p>Sushil will review your request.</p>
                  </div>
                </div>
              </div>
              <form className="contact-form beta-form" onSubmit={handleSubmit}>
                <h2>Your details</h2>
                <p className="beta-form-intro">
                  All fields are required.
                </p>
                <div className="form-field">
                  <label htmlFor="beta-name">Your name</label>
                  <input id="beta-name" name="name" autoComplete="name" maxLength={100} required />
                </div>
                <div className="form-field">
                  <label htmlFor="beta-email">Email address</label>
                  <input id="beta-email" name="email" type="email" autoComplete="email" maxLength={254} required />
                </div>
                <div className="form-field">
                  <label htmlFor="beta-message">Why would you like beta access?</label>
                  <textarea id="beta-message" name="message" rows={5} maxLength={3000} required />
                </div>
                <button className="contact-submit" type="submit">
                  Continue to Gmail <ArrowIcon />
                </button>
                <p className="form-status form-error" role="alert">
                  {formError}
                </p>
                <p className="form-hint">
                  Your email is not sent automatically. Review and send the
                  prepared draft in Gmail.
                </p>
              </form>
            </div>
          </section>
          <a className="beta-back-link" href="/">Return to maintenance page</a>
        </div>
      </main>
      <Footer />
    </>
  );
}

function BetaRequestConfirmationPage() {
  const [fallbackEmail, setFallbackEmail] = useState('');

  useEffect(() => {
    setPageMetadata(
      'Complete your beta request | Sushil Pokharel',
      'Your beta request email draft is ready. Review and send it to Sushil Pokharel.',
    );

    try {
      const savedFallback = window.sessionStorage.getItem('beta-access-email-fallback');
      if (savedFallback) {
        setFallbackEmail(savedFallback);
        window.sessionStorage.removeItem('beta-access-email-fallback');
      }
    } catch (error) {
      console.error('Unable to retrieve the beta request email fallback.', error);
    }

  }, []);

  return (
    <>
      <Header />
      <main className="beta-page">
        <section className="beta-card beta-confirmation" aria-labelledby="beta-confirmation-title">
          <div className="confirmation-icon" aria-hidden="true">✓</div>
          <span className="eyebrow"><span /> ONE LAST STEP</span>
          <h1 id="beta-confirmation-title">Your email draft is ready.</h1>
          <p className="beta-intro">
            Gmail should have opened in a new tab with your beta access request.
            Review the details and press <strong>Send</strong> to deliver it to
            Sushil.
          </p>
          <p className="delivery-disclaimer">
            This website can’t confirm whether an email was sent.
          </p>
          <div className="confirmation-actions">
            {fallbackEmail && (
              <a className="contact-submit confirmation-email-link" href={fallbackEmail}>
                Open draft in your email app <ArrowIcon />
              </a>
            )}
            <a className="beta-back-link" href="/">Return to maintenance page</a>
          </div>
          <p className="confirmation-contact">
            Need help?{' '}
            <a href="mailto:pokharelsushil242@googlemail.com">Email Sushil</a>
            {!fallbackEmail && (
              <> or <a href="https://mail.google.com/mail/?view=cm&amp;fs=1&amp;to=pokharelsushil242%40googlemail.com&amp;su=Beta%20access%20request">open Gmail</a>.</>
            )}
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}

function NotFoundPage() {
  useEffect(() => {
    setPageMetadata(
      'Page not found | Sushil Pokharel',
      'The page you requested could not be found. Return to Sushil Pokharel’s home page or view the Terms & Conditions.',
    );
  }, []);

  return (
    <>
      <Header />
      <main className="error-main">
        <div className="error-orbit orbit-one" aria-hidden="true" />
        <div className="error-orbit orbit-two" aria-hidden="true" />
        <section className="error-card" aria-labelledby="error-title">
          <div className="error-art" aria-hidden="true">
            <span className="error-star star-one">✦</span>
            <span className="error-star star-two">✧</span>
            <span className="error-star star-three">✦</span>
            <div className="error-planet">
              <span className="planet-ring" />
              <span className="planet-dot" />
              <span className="planet-crater crater-one" />
              <span className="planet-crater crater-two" />
            </div>
            <span className="error-code">404</span>
          </div>
          <span className="eyebrow error-eyebrow"><span /> PAGE NOT FOUND</span>
          <h1 id="error-title">We couldn’t find<br />that page.</h1>
          <p>
            The link may be outdated, or the page may have moved. Check the
            address or return to the home page.
          </p>
          <a className="primary-button" href="/">
            Back to home <ArrowIcon />
          </a>
          <a className="secondary-link" href="/terms">Visit our Terms &amp; Conditions</a>
        </section>
      </main>
      <Footer />
    </>
  );
}

export default function App() {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  if (pathname === '/beta') return <BetaRequestPage />;
  if (pathname === '/beta-requested') {
    return new URLSearchParams(window.location.search).has('submitted')
      ? <BetaRequestConfirmationPage />
      : <BetaRequestPage />;
  }
  const isNotFound = pathname !== '/' && pathname !== '/terms';
  if (isNotFound) return <NotFoundPage />;
  if (pathname === '/') return <MaintenancePage />;
  return <TermsPage />;
}
