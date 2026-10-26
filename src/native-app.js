import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

export async function openExternalUrl(url) {
  if (url.startsWith('mailto:') || url.startsWith('tel:')) {
    window.location.href = url;
    return;
  }

  if (!Capacitor.isNativePlatform()) {
    const openedWindow = window.open(url, '_blank', 'noopener,noreferrer');
    if (!openedWindow) window.location.assign(url);
    return;
  }

  try {
    await Browser.open({
      url,
      toolbarColor: '#315648',
      presentationStyle: 'popover',
    });
  } catch (error) {
    console.error('Could not open the external link in the browser.', error);
    window.location.assign(url);
  }
}

export function configureNativeApp() {
  // Global link interception for SPA navigation (works seamlessly on web and in APK)
  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest('a[href]');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href) return;

    // In-page hash links (e.g. #agreement)
    if (href.startsWith('#')) return;

    // Mailto / tel links
    if (href.startsWith('mailto:') || href.startsWith('tel:')) {
      event.preventDefault();
      void openExternalUrl(href);
      return;
    }

    // Explicit download links
    if (link.hasAttribute('download')) {
      if (Capacitor.isNativePlatform()) {
        event.preventDefault();
        void openExternalUrl(link.href);
      }
      return;
    }

    // Check if the URL is internal to the website/app domain
    const url = new URL(link.href, window.location.href);
    const isInternalDomain =
      url.origin === window.location.origin ||
      url.hostname === 'sushilpokharel00.com.np' ||
      url.hostname === 'www.sushilpokharel00.com.np' ||
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1';

    if (!isInternalDomain) {
      if (Capacitor.isNativePlatform() || link.target === '_blank') {
        event.preventDefault();
        void openExternalUrl(url.href);
      }
      return;
    }

    // Don't intercept modified clicks (Cmd/Ctrl/Shift/Alt) or new windows
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === '_blank') {
      return;
    }

    // Internal navigation within the app!
    event.preventDefault();
    if (window.location.href !== link.href) {
      window.history.pushState({}, '', link.href);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  });

  if (!Capacitor.isNativePlatform()) return;

  // Handle hardware back button in Android
  void CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
    const basePath = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
    const isAtRoot = !basePath || basePath === '/' ? pathname === '/' : pathname === basePath || pathname === '/';

    if (canGoBack && !isAtRoot) {
      window.history.back();
    } else {
      void CapacitorApp.exitApp();
    }
  });
}
