// capacitorBack.js
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️  THIS FILE IS INTENTIONALLY A NO-OP.
//
// Back-button handling is owned entirely by the useEffect inside App.jsx,
// which registers a single Capacitor listener on mount and removes it on
// unmount. Registering a second listener here caused a race condition:
//
//   • App.jsx listener → shows "press again to exit" toast  ✅
//   • This listener   → sees window.history.length === 1
//                      → calls CapacitorApp.exitApp() immediately  ❌
//
// Result: the app minimized/killed on the very first back press at root,
// making the toast useless and the UX broken.
//
// Do NOT add any Capacitor back-button logic here.
// ─────────────────────────────────────────────────────────────────────────────
export function registerBackButtonHandler() {
  // intentionally empty — see App.jsx useEffect for the real handler
}
