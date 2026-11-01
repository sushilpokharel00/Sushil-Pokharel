import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';
import { getServiceStatus } from './lib/status-health.js';
import { sitePath } from './site-path.js';

const refreshIntervalMs = 60_000;

function StatusMetric({ label, value, detail }) {
  return (
    <article className="status-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

export default function StatusPage({ Header, Footer }) {
  const [health, setHealth] = useState({
    settings: null,
    status: 'checking',
    responseMs: null,
    traffic: null,
    trafficUnavailable: false,
    checkedAt: null,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    document.title = 'Website status | Sushil Pokharel';
    document.querySelector('meta[name="description"]')?.setAttribute(
      'content',
      'Live website health, response time, consent-based traffic, and uptime monitoring status.',
    );
    document.querySelector('link[rel="canonical"]')?.setAttribute(
      'href',
      'https://sushilpokharel.com.np/status',
    );
  }, []);

  useEffect(() => {
    let active = true;
    let inFlight = false;

    async function refreshStatus() {
      if (inFlight) return;
      inFlight = true;
      setRefreshing(true);

      if (!supabase) {
        if (active) {
          setHealth({
            settings: null,
            status: 'degraded',
            responseMs: null,
            traffic: null,
            trafficUnavailable: true,
            checkedAt: new Date().toISOString(),
          });
          setRefreshing(false);
        }
        inFlight = false;
        return;
      }

      const settingsRequest = (async () => {
        const startedAt = performance.now();
        const { data, error } = await supabase
          .from('site_settings')
          .select('is_maintenance, maintenance_title, maintenance_message, updated_at')
          .eq('id', 1)
          .single();
        if (error) throw error;
        return { data, responseMs: Math.round(performance.now() - startedAt) };
      })();
      const trafficRequest = supabase.functions.invoke('public-status', { body: {} });

      const [settingsResult, trafficResult] = await Promise.allSettled([
        settingsRequest,
        trafficRequest,
      ]);
      const settingsError = settingsResult.status === 'rejected'
        ? settingsResult.reason
        : null;
      const settingsData = settingsResult.status === 'fulfilled'
        ? settingsResult.value.data
        : null;
      const responseMs = settingsResult.status === 'fulfilled'
        ? settingsResult.value.responseMs
        : null;

      let traffic = null;
      let trafficUnavailable = trafficResult.status === 'rejected';
      if (trafficResult.status === 'fulfilled') {
        const { data, error } = trafficResult.value;
        if (error) {
          trafficUnavailable = true;
          console.warn('Consent-based public traffic metrics are unavailable.', error);
        } else if (
          Number.isSafeInteger(data?.trafficToday) &&
          Number.isSafeInteger(data?.trafficLast7Days)
        ) {
          traffic = data;
        } else {
          trafficUnavailable = true;
          console.warn('The public status endpoint returned invalid traffic metrics.');
        }
      } else {
        console.warn('Consent-based public traffic metrics are unavailable.', trafficResult.reason);
      }

      if (settingsError) {
        console.warn('Live website settings could not be checked.', settingsError);
      }

      if (active) {
        setHealth({
          settings: settingsData,
          status: getServiceStatus(settingsData, settingsError, responseMs),
          responseMs,
          traffic,
          trafficUnavailable,
          checkedAt: new Date().toISOString(),
        });
        setRefreshing(false);
      }
      inFlight = false;
    }

    void refreshStatus();
    const intervalId = window.setInterval(refreshStatus, refreshIntervalMs);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [refreshToken]);

  const statusLabels = {
    checking: 'Checking services',
    operational: 'All systems operational',
    degraded: 'Degraded performance',
    maintenance: 'Maintenance in progress',
  };
  const statusDescriptions = {
    checking: 'Checking the live website configuration and traffic metrics.',
    operational: 'Core website services are responding normally.',
    degraded: 'The live health check failed or responded slowly. Some services may be degraded.',
    maintenance: 'The administrator has placed the website in maintenance mode.',
  };
  const status = health.status;

  return (
    <>
      <Header currentPath="/status" />
      <main className="status-page">
        <div className="status-shell">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <a href={sitePath('/')}>Home</a>
            <span aria-hidden="true">/</span>
            <span>Website status</span>
          </nav>

          <header className="status-page-heading">
            <div>
              <span className="eyebrow"><span /> LIVE SERVICE OVERVIEW</span>
              <h1>Website status</h1>
              <p>Health checks and privacy-conscious traffic insights, refreshed every minute.</p>
            </div>
            <button
              className="status-refresh-button"
              type="button"
              onClick={() => setRefreshToken((current) => current + 1)}
              disabled={refreshing}
            >
              {refreshing ? 'Checking…' : 'Refresh status'}
            </button>
          </header>

          <section className={`status-summary status-summary-${status}`} aria-live="polite">
            <span className="status-summary-indicator" aria-hidden="true" />
            <div>
              <span className="status-summary-label">Current system status</span>
              <h2>{statusLabels[status]}</h2>
              <p>{statusDescriptions[status]}</p>
              {health.settings?.maintenance_message && status === 'maintenance' && (
                <p className="status-maintenance-message">{health.settings.maintenance_message}</p>
              )}
            </div>
            {health.checkedAt && (
              <time dateTime={health.checkedAt}>
                Checked {new Date(health.checkedAt).toLocaleTimeString()}
              </time>
            )}
          </section>

          <section className="status-metrics-grid" aria-label="Live service metrics">
            <StatusMetric
              label="Core service response"
              value={health.responseMs === null ? '—' : `${health.responseMs} ms`}
              detail="Live response time for the website configuration check."
            />
            <StatusMetric
              label="Consented page views · today"
              value={health.traffic ? health.traffic.trafficToday.toLocaleString() : health.trafficUnavailable ? 'Unavailable' : '—'}
              detail="Unique visitor and page pairs recorded today."
            />
            <StatusMetric
              label="Consented page views · 7 days"
              value={health.traffic ? health.traffic.trafficLast7Days.toLocaleString() : health.trafficUnavailable ? 'Unavailable' : '—'}
              detail="Daily visitor and page pairs over the past seven UTC days."
            />
            <StatusMetric
              label="Uptime history"
              value="Not configured"
              detail="No independent uptime monitor is connected, so a verified percentage is unavailable."
            />
          </section>

          {health.trafficUnavailable && (
            <p className="status-data-note" role="status">
              Traffic metrics are temporarily unavailable. This does not affect the core service health check.
            </p>
          )}

          <p className="status-privacy-note">
            Traffic includes only visitors who opted in to analytics. Counts are deduplicated by visitor, page, and UTC day; live active-user tracking is not enabled.
          </p>

          {health.settings?.maintenance_message && status !== 'maintenance' && (
            <p className="status-admin-note">{health.settings.maintenance_message}</p>
          )}

          <div className="status-help-links">
            <a href={sitePath('/support')}>Visit support</a>
            <a href={sitePath('/contact')}>Get in touch</a>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
