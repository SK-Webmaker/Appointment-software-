// Is this a real, active Australian business?
//
// The ABN is optional at signup (the owner's decision: plenty of salons are
// sole traders who do not have one to hand, and a dedicated SMS number needs
// no ABN). When one IS given, checking it costs nothing — the ABR's web
// service is free — and it is the cheapest signal there is that a stranger
// paying A$410 is who they say they are.
//
// A check that cannot be made is never a reason to refuse a signup. An
// unreachable ABR returns "unknown", and unknown is not a flag.
const API_BASE = () => process.env.ABR_API_BASE || 'https://abr.business.gov.au';
const GUID = () => String(process.env.ABR_GUID || '').trim();

/** The ABN checksum. Catches a typo without asking anybody's server. */
export function abnLooksValid(abn) {
  const digits = String(abn || '').replace(/\s/g, '');
  if (!/^\d{11}$/.test(digits)) return false;
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const nums = digits.split('').map(Number);
  nums[0] -= 1;
  return nums.reduce((sum, n, i) => sum + n * weights[i], 0) % 89 === 0;
}

const normalise = (s) => String(s || '').toLowerCase().replace(/\b(pty|ltd|limited|the|and|co|company|group|australia|au)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

/** Do the registered name and the typed business name share a real word? */
export function namesOverlap(a, b) {
  const wordsA = new Set(normalise(a).split(' ').filter((w) => w.length >= 3));
  const wordsB = normalise(b).split(' ').filter((w) => w.length >= 3);
  return wordsB.some((w) => wordsA.has(w));
}

/**
 * @returns {{status:'active'|'inactive'|'notfound'|'unknown', name:string, detail:string}}
 */
export async function lookup(abn, { fetchImpl = fetch } = {}) {
  const digits = String(abn || '').replace(/\s/g, '');
  if (!abnLooksValid(digits)) return { status: 'notfound', name: '', detail: 'not a valid ABN' };
  if (!GUID()) return { status: 'unknown', name: '', detail: 'no ABR_GUID configured' };
  let data;
  try {
    const res = await fetchImpl(`${API_BASE()}/json/AbnDetails.aspx?abn=${digits}&guid=${encodeURIComponent(GUID())}`, { signal: AbortSignal.timeout(8000) });
    const text = await res.text();
    // The ABR returns JSONP: callback({...}). Take what is inside the brackets.
    const inner = text.slice(text.indexOf('(') + 1, text.lastIndexOf(')'));
    data = JSON.parse(inner);
  } catch (err) {
    return { status: 'unknown', name: '', detail: `ABR unreachable: ${String(err.message).slice(0, 100)}` };
  }
  if (data?.Message) return { status: 'notfound', name: '', detail: String(data.Message).slice(0, 200) };
  const name = data?.EntityName || data?.BusinessName?.[0] || '';
  const active = String(data?.AbnStatus || '').toLowerCase() === 'active';
  return { status: active ? 'active' : 'inactive', name, detail: data?.AbnStatus || '' };
}
