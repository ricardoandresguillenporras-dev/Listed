import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

// Simple hook to route Android hardware back button to window.history.back()
// This lets the existing popstate-based handler in App.jsx handle navigation
// and the double-press-to-exit UX already implemented there.
export default function useCapacitorBackButton() {
  useEffect(() => {
    try {
      if (typeof Capacitor === 'undefined' || Capacitor.getPlatform() !== 'android') return;
    } catch (e) {
      return;
    }

    const handler = CapacitorApp.addListener('backButton', () => {
      // Delegate to browser history; App.jsx listens to popstate and will
      // perform the appropriate in-app navigation or exit flow.
      try {
        window.history.back();
      } catch (err) {
        console.warn('useCapacitorBackButton: failed to call history.back()', err);
      }
    });

    return () => {
      try { handler.remove(); } catch {}
    };
  }, []);
}
