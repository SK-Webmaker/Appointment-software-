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
