import { App as CapacitorApp } from '@capacitor/app';

export function registerBackButtonHandler() {
  try {
    if (!CapacitorApp || typeof CapacitorApp.addListener !== 'function') return;

    const handler = () => {
      // If the web history stack has entries, go back. Otherwise exit the app (Android).
      if (window.history && window.history.length > 1) {
        window.history.back();
      } else {
        CapacitorApp.exitApp();
      }
    };

    const listener = CapacitorApp.addListener('backButton', handler);

    // expose an unregister function to the window so we don't register multiple times
    if (!window.__capBackUnregister) {
      window.__capBackUnregister = () => listener && listener.remove && listener.remove();
    }
  } catch (e) {
    // ignore in non-capacitor/web environments
    // console.warn('Could not register Capacitor back handler', e);
  }
}
