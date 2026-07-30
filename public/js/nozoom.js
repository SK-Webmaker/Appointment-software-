// Keep the workspace at a fixed scale, the way a native app behaves.
//
// The owner runs this from the iPhone home screen, where a stray pinch or a
// double-tap leaves the whole UI zoomed and offset — fiddly, and it looks
// broken. `user-scalable=no` in the viewport meta handles Android and desktop,
// but iOS Safari has deliberately ignored it since iOS 10, so the gestures have
// to be cancelled here.
//
// What this must NOT break: ordinary scrolling (the page, modal bodies, the
// calendar's sideways swipe) and fast successive taps on buttons. So only
// genuine zoom gestures are cancelled — never single-finger movement, and never
// a second tap that lands somewhere else.

export function lockZoom() {
  // --- pinch: Safari's own gesture events (the reliable hook on iOS) --------
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
  }

  // --- pinch: two or more fingers moving together --------------------------
  // Single-finger moves are left alone so scrolling still works normally.
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });

  // Double-tap-to-zoom is handled in CSS by `touch-action: manipulation`
  // (Safari 9.3+), which the browser applies before any listener runs.
  // Doing it here as well would mean cancelling a tap and re-issuing the
  // click, which risks swallowing a genuine one — so it is left to the CSS.

  // --- desktop: ctrl/⌘ + wheel, and ⌘ +/-/0 --------------------------------
  // Same reasoning — the layout is designed at one scale.
  document.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) e.preventDefault();
  }, { passive: false });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ['+', '=', '-', '_', '0'].includes(e.key)) e.preventDefault();
  });

  // If iOS has already been left zoomed (e.g. from a previous version), reset
  // the scale once on load so the app opens at 1:1.
  if (window.visualViewport && window.visualViewport.scale !== 1) {
    document.documentElement.style.zoom = '1';
  }
}
