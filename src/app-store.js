// Where Kairo's iPhone app is on the App Store.
//
// Apple gives a listing its number only once it is live, so the code cannot
// carry it. It is asked for instead: Apple's public lookup, by bundle id, at
// most every six hours once found (every thirty minutes until then), and kept
// in memory. Nothing ever waits on it — a page asks, gets whatever is known
// right now, and the answer improves in the background. Until there is one,
// every place that would link to the App Store says what it said before.
//
// KAIRO_APP_STORE_ID pins the number outright. KAIRO_APP_STORE_LOOKUP=off never
// asks Apple (tests, air-gapped installs).

export const BUNDLE_ID = 'com.kairobookings.kairo';

const FOUND_TTL = 6 * 60 * 60 * 1000;
const MISSING_TTL = 30 * 60 * 1000;

let known = { id: '', at: 0 };
let asking = null;

/** Apple's number for the app, or '' while it is not known. Never waits. */
export function appStoreId() {
  const pinned = String(process.env.KAIRO_APP_STORE_ID || '').trim();
  if (/^\d{6,12}$/.test(pinned)) return pinned;
  refresh();
  return known.id;
}

/** The listing's address, or '' while it is not known. */
export const appStoreUrl = (id = appStoreId()) => (id ? `https://apps.apple.com/app/id${id}` : '');

function refresh() {
  if (process.env.KAIRO_APP_STORE_LOOKUP === 'off' || asking) return;
  if (known.at && Date.now() - known.at < (known.id ? FOUND_TTL : MISSING_TTL)) return;
  known.at = Date.now();
  asking = lookupAppStoreId()
    .then((id) => { if (id) known.id = id; })
    .catch(() => { /* next window tries again */ })
    .finally(() => { asking = null; });
}

/**
 * Ask Apple. Australia first, because that is where Kairo sells; then the
 * default storefront, for a listing that is not offered in Australia.
 */
export async function lookupAppStoreId({ fetchImpl = fetch, timeoutMs = 4000 } = {}) {
  for (const country of ['au', '']) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    timer.unref?.();
    try {
      const q = `bundleId=${BUNDLE_ID}${country ? `&country=${country}` : ''}`;
      const res = await fetchImpl(`https://itunes.apple.com/lookup?${q}`, { signal: ctrl.signal });
      if (!res.ok) continue;
      const body = await res.json();
      const hit = (body.results || []).find((r) => r.bundleId === BUNDLE_ID);
      if (hit && /^\d{6,12}$/.test(String(hit.trackId))) return String(hit.trackId);
    } catch { /* try the next one */ } finally {
      clearTimeout(timer);
    }
  }
  return '';
}

/** For tests: forget what is known. */
export function _resetAppStore() { known = { id: '', at: 0 }; asking = null; }

/**
 * The Smart App Banner tag for a page Safari shows to an owner, or ''.
 * Safari draws "Kairo — Open" across the top; the app ignores it.
 */
export const appStoreBanner = (id = appStoreId()) => (id ? `<meta name="apple-itunes-app" content="app-id=${id}">` : '');
