// Cinematic post-login intro. Doubles as the loading screen: the Kairo mark
// assembles on a dark stage while the workspace loads underneath, then the
// screen splits down the middle — each half carrying half of the logo — and
// parts to reveal the app.
//
// mountIntro() shows the overlay immediately (call it the moment login
// succeeds); the returned reveal() plays the split once the app is rendered
// (never before a minimum dwell, so it never flashes), and abort() removes
// the overlay instantly if boot fails. Honours prefers-reduced-motion with a
// plain cross-fade.
const MIN_DWELL_MS = 1700;   // logo moment always gets this long
const SPLIT_MS = 1050;       // panels parting
const REDUCED_FADE_MS = 450;

export function mountIntro() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = document.createElement('div');
  el.className = `intro${reduced ? ' intro-reduced' : ''}`;

  // Identical full-screen lockup inside each half; the halves are clipped to
  // their side of the seam, so sliding them apart visually splits the logo.
  const lockup = (side) => `
    <div class="intro-stage">
      <div class="intro-lockup">
        <svg class="intro-mark" viewBox="0 0 120 120" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="introGrad-${side}" x1="20" y1="20" x2="100" y2="100">
              <stop offset="0" stop-color="#e0f2fe"/><stop offset="1" stop-color="#38bdf8"/>
            </linearGradient>
          </defs>
          <circle class="im-halo" cx="60" cy="60" r="34"/>
          <circle class="im-ring" cx="60" cy="60" r="34" stroke="url(#introGrad-${side})"/>
          <circle class="im-dot" cx="87" cy="33" r="10.5"/>
        </svg>
        <div class="intro-word" aria-hidden="true">${'KAIRO'.split('').map((c, i) =>
          `<span style="animation-delay:${520 + i * 85}ms">${c}</span>`).join('')}</div>
        <div class="intro-rule"></div>
        <div class="intro-tag">THE BOOKING OS</div>
        <div class="intro-load"><i></i></div>
      </div>
    </div>`;

  el.innerHTML = `
    <div class="intro-half ih-left">${lockup('l')}</div>
    <div class="intro-half ih-right">${lockup('r')}</div>
    <div class="intro-seam"></div>`;
  document.body.appendChild(el);

  const t0 = performance.now();
  let gone = false;
  const remove = () => { if (!gone) { gone = true; el.remove(); } };

  return {
    reveal() {
      const dwell = reduced ? 500 : MIN_DWELL_MS;
      const wait = Math.max(0, dwell - (performance.now() - t0));
      setTimeout(() => {
        el.classList.add('intro-open');
        const app = document.getElementById('app');
        if (app && !reduced) {
          app.classList.add('app-reveal');
          setTimeout(() => app.classList.remove('app-reveal'), SPLIT_MS + 300);
        }
        setTimeout(remove, reduced ? REDUCED_FADE_MS : SPLIT_MS + 100);
      }, wait);
    },
    abort: remove,
  };
}
