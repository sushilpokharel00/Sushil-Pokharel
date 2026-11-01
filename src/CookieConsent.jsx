import React, { useEffect, useRef, useState } from 'react';
import { DEFAULT_COOKIE_PREFERENCES } from './lib/cookie-preferences.js';

export const OPEN_COOKIE_SETTINGS_EVENT = 'open-cookie-settings';

export default function CookieConsent({ preferences, onSave, error }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState(preferences ?? DEFAULT_COOKIE_PREFERENCES);
  const dialogTitle = useRef(null);

  useEffect(() => {
    function openSettings() {
      setDraft(preferences ?? DEFAULT_COOKIE_PREFERENCES);
      setSettingsOpen(true);
    }

    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings);
  }, [preferences]);

  useEffect(() => {
    if (settingsOpen) dialogTitle.current?.focus();
  }, [settingsOpen]);

  useEffect(() => {
    if (!settingsOpen) return undefined;

    function closeOnEscape(event) {
      if (event.key === 'Escape') setSettingsOpen(false);
    }

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [settingsOpen]);

  function save(nextPreferences) {
    if (onSave(nextPreferences)) setSettingsOpen(false);
  }

  function updateDraft(category, enabled) {
    setDraft((current) => ({ ...current, [category]: enabled }));
  }

  return (
    <>
      {!preferences && !settingsOpen && (
        <section className="cookie-consent-banner" aria-label="Privacy and cookie choices">
          <div className="cookie-consent-copy">
            <span className="auth-eyebrow">YOUR PRIVACY</span>
            <h2>Choose your privacy settings</h2>
            <p>
              Essential storage keeps sign-in working. Optional analytics and
              advertising stay off unless you allow them. Change your choices
              any time in Cookie settings.
            </p>
            {error && <p className="cookie-consent-error" role="alert">{error}</p>}
          </div>
          <div className="cookie-consent-actions">
            <button type="button" className="cookie-consent-secondary" onClick={() => save(DEFAULT_COOKIE_PREFERENCES)}>
              Essential only
            </button>
            <button type="button" className="cookie-consent-link" onClick={() => setSettingsOpen(true)}>
              Customize
            </button>
            <button
              type="button"
              className="cookie-consent-primary"
              onClick={() => save({ essential: true, analytics: true, advertising: true })}
            >
              Allow all
            </button>
          </div>
        </section>
      )}

      {preferences && !settingsOpen && (
        <button
          type="button"
          className="cookie-settings-trigger"
          onClick={() => {
            setDraft(preferences);
            setSettingsOpen(true);
          }}
        >
          Cookie settings
        </button>
      )}

      {settingsOpen && (
        <div className="cookie-settings-backdrop">
          <section className="cookie-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="cookie-settings-title">
            <h2 id="cookie-settings-title" ref={dialogTitle} tabIndex={-1}>Cookie and site-data settings</h2>
            <p>
              Choose which optional technologies this site may use. Your
              essential sign-in and security storage is always enabled.
            </p>
            <div className="cookie-category">
              <div>
                <strong>Essential storage</strong>
                <span>Required for account sessions, security, and remembering this choice.</span>
              </div>
              <input type="checkbox" checked disabled aria-label="Essential storage is always on" />
            </div>
            <label className="cookie-category" htmlFor="cookie-analytics">
              <span>
                <strong>Privacy-preserving analytics</strong>
                <span>Allow daily, aggregated page-visit counts with no raw IP stored.</span>
              </span>
              <input
                id="cookie-analytics"
                type="checkbox"
                checked={draft.analytics}
                onChange={(event) => updateDraft('analytics', event.target.checked)}
              />
            </label>
            <label className="cookie-category" htmlFor="cookie-advertising">
              <span>
                <strong>Advertising technologies</strong>
                <span>Allow Google AdSense to load and use its advertising technologies.</span>
              </span>
              <input
                id="cookie-advertising"
                type="checkbox"
                checked={draft.advertising}
                onChange={(event) => updateDraft('advertising', event.target.checked)}
              />
            </label>
            {error && <p className="cookie-consent-error" role="alert">{error}</p>}
            <div className="cookie-consent-actions">
              <button type="button" className="cookie-consent-secondary" onClick={() => save(DEFAULT_COOKIE_PREFERENCES)}>
                Essential only
              </button>
              <button type="button" className="cookie-consent-primary" onClick={() => save(draft)}>
                Save choices
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
