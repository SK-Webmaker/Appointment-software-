// Password policy: what Kairo will and won't accept as a new password.
//
// The threat here is not a cryptanalyst; it is someone who knows the salon,
// tries "salonname2024", and gets in. So the rules are the ones that actually
// stop that: enough length, not a password everybody uses, and not simply the
// business's or the owner's own name.
//
// The leak check is separate and optional — see checkBreached below.
import crypto from 'node:crypto';

export const MIN_LENGTH = 10;

// The passwords that turn up at the top of every breach corpus, plus the ones
// specific to this product ("kairo…") and to salons. Compared case-folded and
// with digits/symbols stripped, so "Password1!" is caught by "password".
const COMMON = new Set([
  'password', 'passw0rd', 'letmein', 'welcome', 'admin', 'administrator', 'root',
  'qwerty', 'qwertyuiop', 'asdfgh', 'zxcvbn', 'abc', 'abcdef', 'iloveyou',
  'monkey', 'dragon', 'sunshine', 'princess', 'football', 'baseball', 'superman',
  'trustno', 'master', 'shadow', 'michael', 'jennifer', 'jordan', 'hello',
  'freedom', 'whatever', 'starwars', 'login', 'changeme', 'secret', 'test',
  'kairo', 'salon', 'hair', 'hairsalon', 'booking', 'business', 'default',
]);

/** Strip case, digits and punctuation so "P@ssw0rd123" reduces to "pssword". */
function skeleton(s) {
  return String(s).toLowerCase().replace(/[^a-z]/g, '');
}

/**
 * Is the password essentially just the owner's or the business's own name?
 *
 * Checked two ways, because both are what people actually type: a single word
 * from it ("Kairo2026"), and the whole thing run together ("LuxeHairStudio").
 * The second is the one that slips through a word-by-word check.
 */
function tooPersonal(password, context) {
  const skel = skeleton(password);
  if (!skel) return false;
  const near = (candidate) => candidate.length >= 4
    && (skel === candidate || (skel.startsWith(candidate) && skel.length - candidate.length <= 2));
  for (const raw of context) {
    if (near(skeleton(raw))) return true;                       // "Luxe Hair Studio" → luxehairstudio
    for (const word of String(raw || '').split(/[^A-Za-z]+/)) {
      if (near(word.toLowerCase())) return true;                // "Studio" on its own
    }
    // Email: the part before the @ is as guessable as the name.
    const local = String(raw || '').split('@')[0];
    if (local !== raw && near(skeleton(local))) return true;
  }
  return false;
}

/**
 * Check a candidate password against the rules.
 * `context` is anything an attacker would guess first — the owner's email,
 * their name, the business name.
 * Returns null when acceptable, or a sentence explaining what to change.
 */
export function checkPassword(password, context = []) {
  const pw = String(password ?? '');
  if (pw.length < MIN_LENGTH) return `Use at least ${MIN_LENGTH} characters — length matters more than symbols.`;
  if (pw.length > 200) return 'That password is too long.';
  if (!pw.trim()) return 'A password of only spaces will not protect anything.';
  if (/^(.)\1+$/.test(pw)) return 'That is the same character repeated — pick something else.';

  const skel = skeleton(pw);
  if (skel && COMMON.has(skel)) return 'That is one of the most common passwords in the world. Pick something else.';
  for (const c of COMMON) {
    if (c.length >= 5 && skel === c) return 'That is one of the most common passwords in the world. Pick something else.';
  }
  // Straight runs like "12345678901" or "abcdefghij"
  if (/^(?:0123456789|1234567890|abcdefghij|qwertyuiop)/.test(pw.toLowerCase())) {
    return 'That is a keyboard or number run — the first thing anyone tries.';
  }
  if (tooPersonal(pw, context)) return 'That is too close to your own name, email or business name.';
  return null;
}

/**
 * Has this exact password appeared in a known breach?
 *
 * Uses the Have I Been Pwned range API with k-anonymity: only the first five
 * characters of the SHA-1 hash ever leave this server, and the password itself
 * never does. Nothing identifying is sent, and the reply is a list of hash
 * suffixes we match locally.
 *
 * Fails OPEN on any network trouble. A salon must never be locked out of
 * changing its password because someone else's API is down — the rules above
 * already ran, and this is an extra net, not the floor.
 *
 * Set KAIRO_BREACH_CHECK=off to skip it entirely (air-gapped installs).
 */
export async function checkBreached(password, { timeoutMs = 2500, fetchImpl = fetch } = {}) {
  if (process.env.KAIRO_BREACH_CHECK === 'off') return null;
  const sha1 = crypto.createHash('sha1').update(String(password), 'utf8').digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, {
      signal: ctrl.signal,
      headers: { 'Add-Padding': 'true', 'User-Agent': 'Kairo-Booking' },
    });
    if (!res.ok) return null;
    const body = await res.text();
    for (const line of body.split('\n')) {
      const [hash, countRaw] = line.trim().split(':');
      if (hash !== suffix) continue;
      const count = Number(countRaw) || 0;
      if (count <= 0) return null;            // padding rows report a count of 0
      return count > 100
        ? 'That password has appeared in known data breaches. Please choose a different one.'
        : 'That password has turned up in a data breach. Please choose a different one.';
    }
    return null;
  } catch {
    return null;   // offline, blocked, or slow — never block the owner
  } finally {
    clearTimeout(timer);
  }
}
