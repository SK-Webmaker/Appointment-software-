// The one seam between the web workspace and the iOS shell.
//
// Deliberately tiny and deliberately one-way for anything that matters: the
// page tells the app when somebody signed in or out, and that is all. The app
// never asks the page for data, and the page never gets a capability it did
// not already have in a browser.
//
// In a browser `window.webkit` does not exist and every call here is a no-op,
// so nothing below needs a second code path.

const bridge = () => (typeof window !== 'undefined'
  && window.webkit?.messageHandlers?.kairo) || null;

/** True inside the app. The workspace uses it to hide "add to home screen". */
export const inApp = () => Boolean(typeof window !== 'undefined' && window.kairoNative);

function post(type, extra = {}) {
  const b = bridge();
  if (!b) return false;
  try { b.postMessage({ type, ...extra }); return true; } catch { return false; }
}

/**
 * Somebody is signed in and looking at their own book.
 *
 * This is the moment the app asks for notifications — not on first launch,
 * when the owner has seen nothing and has no reason to say yes.
 */
export const signedIn = () => post('signed-in');

/** Signed out: the app forgets the device token so this phone stops being sent to. */
export const signedOut = () => post('signed-out');

// ── Updates ─────────────────────────────────────────────────────────────────
// An iPhone app cannot update itself: only the App Store installs a new
// version (by itself overnight if the iPhone allows automatic updates, or
// when the owner taps Update). What the page can do is notice that this app
// is older than the one the App Store is giving out, and offer the button.
//
// Builds from 1.0.4 on say their own version (kairoNative.app). The ones
// before are known by their bridge version instead, each taken as the newest
// version it could be, so an app that is up to date is never told to update:
// 1 was the first builds, 2 everything up to 1.0.2, 3 is 1.0.3.
const BRIDGE_APP = { 1: '1.0.0', 2: '1.0.2', 3: '1.0.3' };
const VERSION_RE = /^\d{1,4}(\.\d{1,4}){0,3}$/;
const here = () => (typeof window !== 'undefined' ? window.kairoNative : null);

/** This app's version, "1.0.3", or '' in a browser or when it cannot be told. */
export function appVersion(native = here()) {
  if (!native) return '';
  const own = String(native.app || '');
  if (VERSION_RE.test(own)) return own;
  return BRIDGE_APP[Number(native.version)] || '';
}

/** Version a is later than version b ("1.0.10" is later than "1.0.9"). */
export function isNewer(a, b) {
  const x = String(a).split('.').map(Number);
  const y = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  }
  return false;
}

/** The App Store is giving out a newer Kairo than the one this page is in. */
export function updateAvailable(storeVersion, native = here()) {
  const mine = appVersion(native);
  return Boolean(mine && VERSION_RE.test(String(storeVersion || '')) && isNewer(storeVersion, mine));
}
