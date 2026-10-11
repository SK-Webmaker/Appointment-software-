// A tiny deterministic timeline: every frame is seek(t), so rendering is exact.
const EASE = {
  lin: (t) => t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  io: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  soft: (t) => 0.5 - Math.cos(Math.PI * t) / 2,
};
const tracks = [];
const mix = (a, b, k) => {
  if (typeof a === 'number') return a + (b - a) * k;
  const o = {};
  for (const key of Object.keys(a)) o[key] = key in b ? mix(a[key], b[key], k) : a[key];
  return o;
};
function at(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1, e] = keys[i];
    const [t0, v0] = keys[i - 1];
    if (t <= t1) {
      const k = t1 === t0 ? 1 : (t - t0) / (t1 - t0);
      return mix(v0, v1, EASE[e || 'io'](k));
    }
  }
  return keys[keys.length - 1][1];
}
/** Normalise keys so every key carries the full state of the one before it. */
function fill(keys) {
  let prev = {};
  return keys.map(([t, v, e]) => { prev = { ...prev, ...v }; return [t, prev, e]; });
}
export function track(el, keys, apply) { tracks.push({ el, keys: fill(keys), apply }); }
/** opacity / x / y / scale / blur */
export function anim(el, keys) {
  if (typeof el === 'string') el = document.querySelector(el);
  track(el, [[0, { o: 0, x: 0, y: 0, s: 1, b: 0 }], ...keys], (n, v) => {
    n.style.opacity = v.o.toFixed(4);
    n.style.visibility = v.o <= 0.001 ? 'hidden' : 'visible';
    n.style.transform = `translate(${v.x.toFixed(2)}px, ${v.y.toFixed(2)}px) scale(${v.s.toFixed(4)})`;
    n.style.filter = v.b > 0.01 ? `blur(${v.b.toFixed(2)}px)` : 'none';
  });
}
/** Visible between t0 and t1, fading over d seconds; optional rise in px. */
export function show(el, t0, t1, { d = 0.45, rise = 0, out = 0, s0 = 1, blur = 0 } = {}) {
  const k = [[t0, { o: 0, y: rise, s: s0, b: blur }], [t0 + d, { o: 1, y: 0, s: 1, b: 0 }, 'out']];
  if (t1 != null) k.push([t1 - d, { o: 1, y: 0, s: 1, b: 0 }], [t1, { o: 0, y: -out, s: 1, b: blur ? blur / 2 : 0 }, 'in']);
  anim(el, k);
}

// A scene can be slowed to fit its narration without rewriting its keyframes:
// warp([[renderedT, authoredT], ...]) maps the rendered timeline onto the one
// the keyframes were written for.
let WARP = null;
export function warp(points) { WARP = points; window.DURATION = points[points.length - 1][0]; }
function unwarp(t) {
  if (!WARP) return t;
  if (t <= WARP[0][0]) return WARP[0][1];
  for (let i = 1; i < WARP.length; i++) {
    const [n1, o1] = WARP[i];
    const [n0, o0] = WARP[i - 1];
    if (t <= n1) return n1 === n0 ? o1 : o0 + (o1 - o0) * ((t - n0) / (n1 - n0));
  }
  const [nl, ol] = WARP[WARP.length - 1];
  return ol + (t - nl);
}
export function seek(t) { const u = unwarp(t); for (const tr of tracks) tr.apply(tr.el, at(tr.keys, u)); }
window.seek = seek;
