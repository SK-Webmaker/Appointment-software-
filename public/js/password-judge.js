// Live, honest feedback on a candidate password, shared by the Account page
// and the reset-password page so both judge a password the same way.
//
// Kept in step with MIN_LENGTH in src/password.js — the server is the enforcer,
// this is only so the owner finds out before pressing the button.
export const PW_MIN = 10;
const PW_COMMON = ['password', 'letmein', 'welcome', 'qwerty', 'admin', 'kairo', 'salon',
  'hair', 'changeme', 'iloveyou', 'monkey', 'dragon', 'sunshine', 'football', 'secret'];

/** Live, honest feedback on a candidate password. Mirrors the server's rules. */
export function judgePassword(pw, context) {
  const skeleton = (s) => String(s).toLowerCase().replace(/[^a-z]/g, '');
  const skel = skeleton(pw);
  if (!pw) return null;
  if (pw.length < PW_MIN) return { level: 0, say: `${PW_MIN - pw.length} more character${PW_MIN - pw.length === 1 ? '' : 's'} needed` };
  if (PW_COMMON.includes(skel)) return { level: 0, say: 'Far too common — anyone would try this' };
  if (/^(.)\1+$/.test(pw)) return { level: 0, say: 'That is one character repeated' };
  if (/^(?:0123456789|1234567890|abcdefghij|qwertyuiop)/.test(pw.toLowerCase())) {
    return { level: 0, say: 'That is a keyboard run' };
  }
  // Mirrors tooPersonal() in src/password.js: a single word from their world,
  // and the whole name run together, which is what people actually type.
  const near = (c) => c.length >= 4 && (skel === c || (skel.startsWith(c) && skel.length - c.length <= 2));
  for (const raw of context) {
    const words = String(raw || '').split(/[^A-Za-z]+/).map((w) => w.toLowerCase());
    if (near(skeleton(raw)) || near(skeleton(String(raw || '').split('@')[0])) || words.some(near)) {
      return { level: 0, say: 'Too close to your own name or business' };
    }
  }
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (pw.length >= 16 || (pw.length >= 12 && variety >= 3)) return { level: 3, say: 'Strong' };
  if (pw.length >= 12 || variety >= 3) return { level: 2, say: 'Good' };
  return { level: 1, say: 'Passable — longer would be better' };
}
