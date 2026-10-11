import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

export async function openExternalUrl(url) {
  if (!Capacitor.isNativePlatform()) {
    const openedWindow = window.open(url, '_blank', 'noopener,noreferrer');
    if (!openedWindow) window.location.assign(url);
    return;
  }

  try {
    await Browser.open({ url });
  } catch (error) {
    console.error('Could not open the external link in the browser.', error);
    window.location.assign(url);
  }
}

export function configureNativeApp() {
  if (!Capacitor.isNativePlatform()) return;

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest('a[href]');
    if (!link) return;

    const url = new URL(link.href);
    if (link.hasAttribute('download')) {
      event.preventDefault();
      void openExternalUrl(url.href);
      return;
    }

    if (
      !['http:', 'https:'].includes(url.protocol)
      || url.origin === window.location.origin
    ) {
      return;
    }

    event.preventDefault();
    void openExternalUrl(url.href);
  });

  void CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
    } else {
      void CapacitorApp.exitApp();
    }
  });
}
