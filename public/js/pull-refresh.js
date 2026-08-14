// Pull down at the top of a page to reload it — the gesture every phone app
// has trained people to expect.
//
// Kairo is a home-screen app with no address bar, so there is no reload button
// anywhere on a phone. Without this, an owner who left the app open on the back
// bench has no way to ask "is this still right?" except closing and reopening
// it. The gesture is the answer to that, and it is the same one they already
// use in every other app on the device.

const THRESHOLD = 68;    // how far to pull before it will fire
const MAX_PULL = 110;    // past here the indicator stops following the finger
const RESISTANCE = 0.55; // the drag feels weighted rather than loose

/**
 * Is anything between `el` and `scroller` already scrolled down? If so the
 * finger belongs to that inner list (the calendar's day grid, a long modal),
 * not to a page refresh.
 */
function insideScrolledChild(el, scroller) {
  for (let n = el; n && n !== scroller; n = n.parentElement) {
    if (!(n instanceof Element)) continue;
    const canScroll = n.scrollHeight > n.clientHeight + 2;
    if (canScroll && n.scrollTop > 0) return true;
  }
  return false;
}

/**
 * @param {HTMLElement} scroller  the page's scrolling element
 * @param {() => Promise<void>} onRefresh  what to reload
 */
export function enablePullToRefresh(scroller, onRefresh) {
  if (!scroller || !window.matchMedia('(pointer: coarse)').matches) return () => {};

  const ind = document.createElement('div');
  ind.className = 'ptr';
  ind.innerHTML = '<div class="ptr-circle"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" '
    + 'stroke="currentColor" stroke-width="2.2" stroke-linecap="round">'
    + '<path d="M20 11a8 8 0 1 0-.6 4"/><polyline points="20 5 20 11 14 11"/></svg></div>';
  scroller.parentElement.insertBefore(ind, scroller);

  let startY = 0, pulling = false, dist = 0, busy = false;

  const setDist = (d) => {
    dist = d;
    ind.style.transform = `translateY(${Math.min(d, MAX_PULL)}px)`;
    ind.style.opacity = String(Math.min(1, d / (THRESHOLD * 0.7)));
    ind.classList.toggle('is-ready', d >= THRESHOLD);
    // The arrow turns as it's pulled, so the threshold is felt, not guessed.
    ind.querySelector('.ptr-circle').style.transform = `rotate(${Math.min(d / MAX_PULL, 1) * 270}deg)`;
  };
  const reset = () => {
    pulling = false;
    ind.classList.add('is-easing');
    setDist(0);
    setTimeout(() => ind.classList.remove('is-easing'), 260);
  };

  const onStart = (e) => {
    if (busy || e.touches.length !== 1) return;
    // Only from a genuine resting position at the very top, and never while a
    // dialog is open — a pull there is someone scrolling the dialog.
    if (scroller.scrollTop > 0 || document.querySelector('.modal-overlay')) return;
    if (insideScrolledChild(e.target, scroller)) return;
    startY = e.touches[0].clientY;
    pulling = true;
    dist = 0;
  };

  const onMove = (e) => {
    if (!pulling || busy) return;
    const dy = e.touches[0].clientY - startY;
    if (dy <= 0) {
      // Pulled back up past the start: hand the gesture back to the page.
      if (dist > 0) setDist(0);
      pulling = false;
      return;
    }
    if (scroller.scrollTop > 0) { reset(); return; }
    // Now it is definitely a pull, so stop the page bouncing underneath it.
    if (e.cancelable) e.preventDefault();
    setDist(dy * RESISTANCE);
  };

  const onEnd = async () => {
    if (!pulling || busy) return;
    if (dist < THRESHOLD) { reset(); return; }
    busy = true;
    pulling = false;
    ind.classList.add('is-easing', 'is-spinning');
    setDist(THRESHOLD);
    try {
      await onRefresh();
    } catch { /* the page's own error handling shows the problem */ }
    finally {
      ind.classList.remove('is-spinning');
      reset();
      busy = false;
    }
  };

  scroller.addEventListener('touchstart', onStart, { passive: true });
  scroller.addEventListener('touchmove', onMove, { passive: false });
  scroller.addEventListener('touchend', onEnd, { passive: true });
  scroller.addEventListener('touchcancel', reset, { passive: true });

  return () => {
    scroller.removeEventListener('touchstart', onStart);
    scroller.removeEventListener('touchmove', onMove);
    scroller.removeEventListener('touchend', onEnd);
    scroller.removeEventListener('touchcancel', reset);
    ind.remove();
  };
}
