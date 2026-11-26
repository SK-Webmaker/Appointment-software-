// Small, quick motion that makes moving around Kairo feel finished rather than
// abrupt: a page's pieces rise in one after another instead of all at once,
// the workspace settles in when the app opens, and a page that redraws itself
// for a tab does the same. Nothing here waits on an animation to do its job,
// and all of it is skipped when the phone asks for less motion.

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Rows of cards that read better arriving card by card than as one block.
const GRIDS = '.stats-row, .grid-2, .grid-31, .svc-grid, .settings-grid, .help-grid, .kw-grid, .today-grid, .pf-grid';

/** Stagger a freshly drawn page in: its top-level pieces, and the cards inside a row of cards. */
export function playIn(page) {
  if (!page || reduced()) return;
  const pieces = [];
  for (const c of page.children) {
    if (c.matches(GRIDS) && c.children.length > 1) pieces.push(...c.children);
    else pieces.push(c);
  }
  pieces.forEach((el, i) => {
    el.style.setProperty('--i', String(Math.min(i, 12)));
    el.classList.add('pi');
    // A moving ancestor would drag a pinned bar (the till's Charge button)
    // along with it, so anything holding one only fades.
    if (el.querySelector('.pos-paybar')) el.classList.add('pi-flat');
  });
  page.classList.remove('page-in');
  void page.offsetWidth;            // restart the animation even on the same page
  page.classList.add('page-in');
}

/**
 * Pages that redraw themselves when a tab is pressed (Team's two tabs, for one)
 * get the same entrance. Only a redraw that follows a tab press counts, so a
 * save or a live update never makes the page jump.
 */
let watched = null;     // the page element being watched (the shell is redrawn after a sign-in)
let pressed = 0;
let observer = null;
export function watchTabRedraws(page) {
  if (!page || page === watched) return;
  if (!watched) {
    document.addEventListener('click', (e) => {
      if (watched?.contains(e.target) && e.target.closest('.seg button, [role="tab"], [data-tab]')) pressed = performance.now();
    }, true);
  }
  watched = page;
  observer?.disconnect();
  observer = new MutationObserver(() => {
    if (!pressed || performance.now() - pressed > 900) return;
    pressed = 0;
    requestAnimationFrame(() => playIn(watched));
  });
  observer.observe(page, { childList: true });
}

/** Opening the app: the menu, top bar and tab bar settle in, then the page. */
export function playEntrance(app) {
  if (!app || reduced()) return;
  app.querySelectorAll('.sidebar .brand, .sidebar .nav > *, .sidebar-foot')
    .forEach((el, i) => el.style.setProperty('--n', String(i)));
  app.classList.add('app-enter');
  playIn(app.querySelector('#page'));
  setTimeout(() => app.classList.remove('app-enter'), 1500);
}
