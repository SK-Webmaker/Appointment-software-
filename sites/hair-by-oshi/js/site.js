/* ============================================================
   HAIR BY OSHI — motion + interaction engine
   Native scroll throughout (keeps position:sticky, anchors and
   assistive tech intact); effects are scroll-linked and lerped
   on rAF for the weight, rather than hijacking the page.
   ============================================================ */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var lerp  = function (a, b, n) { return a + (b - a) * n; };
  var clamp = function (v, a, b) { return Math.min(Math.max(v, a), b); };

  /* ---------- 0. the release signal ----------
     The hero is above the fold, so it has no scroll to wait for. It
     waits for this instead, and so does anything else that must not
     start until the loader is out of the way. Callers registered after
     the release still fire, so ordering between modules cannot break
     the entrance.                                                     */
  var released = false, waiting = [];
  function release() {
    if (released) return;
    released = true;
    waiting.splice(0).forEach(function (fn) { fn(); });
  }
  function onRelease(fn) { released ? fn() : waiting.push(fn); }
  /* a stuck loader must never cost the page its entrance */
  setTimeout(release, 4000);

  /* ---------- 1. preloader ---------- */
  (function preload() {
    var pl = $('#preloader'), bar = $('#plBar');
    if (!pl) { document.body.classList.remove('is-loading'); release(); return; }
    var p = 0, done = false;
    var tick = setInterval(function () {
      p = Math.min(p + Math.random() * 18, 92);
      if (bar) bar.style.width = p + '%';
    }, 130);
    function finish() {
      if (done) return;
      done = true;
      clearInterval(tick);
      if (bar) bar.style.width = '100%';
      setTimeout(function () {
        pl.classList.add('done');
        document.body.classList.remove('is-loading');
        release();
        setTimeout(function () { if (pl.parentNode) pl.remove(); }, 800);
      }, reduce ? 0 : 380);
    }
    window.addEventListener('load', finish);
    setTimeout(finish, reduce ? 150 : 2400);
  })();

  /* ---------- 2. cursor + magnetic ---------- */
  (function cursor() {
    var el = $('#cursor');
    if (!el || reduce || !window.matchMedia('(hover:hover)').matches) return;
    var label = $('.cursor__label', el), tx = 0, ty = 0, cx = 0, cy = 0;
    window.addEventListener('mousemove', function (e) { tx = e.clientX; ty = e.clientY; }, { passive: true });
    (function run() {
      cx = lerp(cx, tx, 0.19); cy = lerp(cy, ty, 0.19);
      el.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';
      requestAnimationFrame(run);
    })();
    document.addEventListener('mouseover', function (e) {
      var n = e.target.closest('a,button,summary,[data-cursor],input,select,textarea');
      if (!n) return;
      el.classList.add('is-big');
      if (label) label.textContent = n.getAttribute('data-cursor') || '';
    });
    document.addEventListener('mouseout', function (e) {
      if (e.target.closest('a,button,summary,[data-cursor],input,select,textarea')) {
        el.classList.remove('is-big');
        if (label) label.textContent = '';
      }
    });
    $$('[data-magnetic]').forEach(function (n) {
      var mx = 0, my = 0, ax = 0, ay = 0, raf = null, active = false;
      function loop() {
        ax = lerp(ax, mx, 0.2); ay = lerp(ay, my, 0.2);
        n.style.transform = 'translate3d(' + ax + 'px,' + ay + 'px,0)';
        if (Math.abs(ax - mx) > 0.1 || Math.abs(ay - my) > 0.1 || active) raf = requestAnimationFrame(loop);
        else { n.style.transform = ''; raf = null; }
      }
      n.addEventListener('mousemove', function (e) {
        var r = n.getBoundingClientRect();
        mx = (e.clientX - (r.left + r.width / 2)) * 0.28;
        my = (e.clientY - (r.top + r.height / 2)) * 0.38;
        active = true;
        if (!raf) raf = requestAnimationFrame(loop);
      });
      n.addEventListener('mouseleave', function () { mx = 0; my = 0; active = false; });
    });
  })();

  /* ---------- 3. nav, progress, mobile CTA ---------- */
  (function chrome() {
    var nav = $('#nav'), bar = $('#scrollBar'), mcta = $('#mcta'), last = 0;
    function sizeCta() {
      if (!mcta) return;
      var on = window.innerWidth < 1060;
      document.documentElement.style.setProperty('--mcta-h', on ? mcta.offsetHeight + 'px' : '0px');
    }
    function onScroll() {
      var y = window.scrollY;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      if (bar) bar.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
      if (nav) {
        nav.classList.toggle('stuck', y > 30);
        nav.classList.toggle('hide', y > last && y > 420 &&
          !document.body.classList.contains('menu-open') &&
          !document.body.classList.contains('modal-open'));
      }
      if (mcta) mcta.classList.toggle('show', y > 520);
      last = y;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', sizeCta);
    sizeCta(); onScroll();
  })();

  /* ---------- 4. mobile menu ---------- */
  var menuApi = (function menu() {
    var b = $('#burger'), m = $('#menu');
    if (!b || !m) return { close: function () {} };
    function set(open) {
      m.hidden = false;
      m.classList.toggle('open', open);
      b.setAttribute('aria-expanded', String(open));
      b.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.classList.toggle('menu-open', open);
      if (!open) setTimeout(function () { if (!m.classList.contains('open')) m.hidden = true; }, 780);
    }
    b.addEventListener('click', function () { set(!m.classList.contains('open')); });
    $$('a,button', m).forEach(function (a) { a.addEventListener('click', function () { set(false); }); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && m.classList.contains('open')) { set(false); b.focus(); }
    });
    return { close: function () { set(false); } };
  })();

  /* ---------- 5. choreography ----------
     Rather than fading every block identically, each element is
     classed by what it is — a heading, a photograph, a list item —
     given the matching entrance, and staggered against its
     neighbours so a section arrives in reading order.            */
  (function choreograph() {
    /* first match wins; order matters */
    var RULES = [
      ['wipe', '.hero__frame, .svc__media, .oshi__portrait, .studio__media, .work__card, .consult__formwrap'],
      ['fade', '.svc__list li, .consult__list li, .val, .step, .proof__item, .studio__facts > div, .faq__item, .hero__meta > div, .foot__grid > div, .hero__chip'],
      ['rise', '.eyebrow, .h2, .lede, .hero__title, .hero__sub, .hero__actions, .hero__note, .svc__num, .svc__body h3, .svc__tag, .svc__copy, .svc__note, .link-btn, .oshi__body p, .pull, .oshi__sig, .studio__actions, .consult__copy p, .book__title, .book__sub, .book__actions, .book__days, .foot__mark, .foot__tag, .oshi__head .h2, .steps__note']
    ];

    var seen = new Set();
    /* The hero runs its own hand-set timeline in CSS. Tagging its parts
       here too would put two transitions on one property and the later
       one would silently win, which is exactly the race this replaced. */
    var heroEl = $('.hero');
    function tag(el, kind) {
      if (seen.has(el) || el.hasAttribute('data-anim')) return;
      if (heroEl && heroEl.contains(el)) return;
      seen.add(el);
      el.setAttribute('data-anim', kind);
    }
    RULES.forEach(function (pair) {
      $$(pair[1]).forEach(function (el) { tag(el, pair[0]); });
    });
    /* Anything still carrying the old .reveal class must get an entrance
       too — .reveal starts at opacity 0, so a block that matched no rule
       above would otherwise stay invisible for good. */
    $$('.reveal').forEach(function (el) { tag(el, 'rise'); });

    var groups = $$('section, .foot, .marquee').filter(function (s) {
      return s.querySelector('[data-anim]');
    });

    if (reduce || !('IntersectionObserver' in window)) {
      $$('[data-anim]').forEach(function (el) { el.classList.add('in'); });
      return;
    }

    groups.forEach(function (group) {
      /* stagger in DOM order, but cap it so a long section never
         leaves the last item waiting a second and a half */
      var kids = $$('[data-anim]', group);
      kids.forEach(function (el, i) {
        el.style.setProperty('--d', Math.min(i * 55, 420) + 'ms');
      });
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          kids.forEach(function (el) { el.classList.add('in'); });
          io.disconnect();
        });
      }, { threshold: 0.06, rootMargin: '0px 0px -5% 0px' });
      io.observe(group);
    });

    /* the hero is already on screen — it opens when the loader lifts */
    if (heroEl) {
      onRelease(function () {
        /* a frame's grace so the class lands after layout, not during it */
        requestAnimationFrame(function () { heroEl.classList.add('is-in'); });
      });
    }
  })();

  /* ---------- 6. split craft sentence ---------- */
  (function split() {
    var el = $('#craftText');
    if (!el) return;
    var words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach(function (w, wi) {
      var s = document.createElement('span');
      s.style.display = 'inline-block';
      w.split('').forEach(function (ch) {
        var c = document.createElement('span');
        c.className = 'ch'; c.textContent = ch; s.appendChild(c);
      });
      el.appendChild(s);
      if (wi < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
  })();

  /* ---------- 6a. gallery loop ----------
     The rail drifts on its own while nobody is touching it, and a drift
     that stopped dead at the last card would just be a rail that ran
     out. Duplicating the set gives it somewhere to go: once it has
     advanced by exactly one set the scroll position is rolled back by
     that much, which puts identical pixels under the viewport, so the
     seam cannot be seen. The copies are decoration — they are hidden
     from assistive tech, which has already read the originals.
     This runs before the photo slots so the copies are armed by the
     same sweep, and before the parallax so they drift like the rest.  */
  (function galleryLoop() {
    var track = $('#workTrack');
    if (!track) return;
    var cards = $$('.work__card', track);
    if (cards.length < 2) return;
    var frag = document.createDocumentFragment();
    cards.forEach(function (c) {
      var copy = c.cloneNode(true);
      copy.setAttribute('aria-hidden', 'true');
      copy.setAttribute('data-clone', '1');
      frag.appendChild(copy);
    });
    track.appendChild(frag);
    track.setAttribute('data-looped', '1');
  })();

  /* ---------- 6b. photo slots ----------
     Runs before anything caches an image element: this swap replaces
     <img> with a placeholder node, and a module holding the old
     reference would then be animating a node no longer in the page.
     Until the real photography lands, each missing image renders as a
     deliberate card: what the photo should be, the crop it wants, and a
     short note. Better to look intentional than to look broken.        */
  (function photoSlots() {
    function esc(t) {
      return String(t || '').replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
      });
    }
    function slot(img) {
      if (img.dataset.slotted) return;
      img.dataset.slotted = '1';
      var file  = (img.getAttribute('src') || '').split('/').pop();
      var title = img.getAttribute('data-title') || file;
      var note  = img.getAttribute('data-note') || '';
      var box = document.createElement('div');
      box.className = 'slot';
      box.setAttribute('role', 'img');
      box.setAttribute('aria-label', 'Photograph to come — ' + (img.getAttribute('alt') || title));
      box.innerHTML =
        '<span class="slot__tag">Photo to come</span>' +
        '<span class="slot__title">' + esc(title) + '</span>' +
        (note ? '<span class="slot__note">' + esc(note) + '</span>' : '') +
        '<span class="slot__file">' + esc(file) + '</span>';
      img.replaceWith(box);
    }
    $$('img').forEach(function (img) {
      if (img.complete && img.naturalWidth === 0) slot(img);
      else img.addEventListener('error', function () { slot(img); });
    });
  })();

  /* ---------- 7. scroll-linked effects ---------- */
  (function scrollFX() {
    var craft = $('.craft'), chars = $$('#craftText .ch');
    var marquee = $('#marquee');
    var mqX = 0, mqW = 0;
    function measure() { if (marquee) mqW = marquee.scrollWidth / 2; }
    measure(); window.addEventListener('resize', measure);

    (function frame() {
      var y = window.scrollY, vh = window.innerHeight;

      if (craft && chars.length) {
        var r = craft.getBoundingClientRect();
        var total = craft.offsetHeight - vh;
        var prog = clamp((-r.top) / (total > 0 ? total : 1), 0, 1);
        var upTo = Math.round(clamp((prog - 0.06) / 0.66, 0, 1) * chars.length);
        for (var i = 0; i < chars.length; i++) {
          var lit = i < upTo;
          if (chars[i]._lit !== lit) { chars[i].classList.toggle('lit', lit); chars[i]._lit = lit; }
        }
      }
      if (marquee && mqW && !reduce) {
        mqX -= 0.42;
        if (mqX <= -mqW) mqX += mqW;
        marquee.style.transform = 'translate3d(' + mqX + 'px,0,0)';
      }
      requestAnimationFrame(frame);
    })();
  })();

  /* ---------- 7b. parallax inside the frames ----------
     A photograph that sits perfectly still inside a moving page reads as
     a sticker. Letting it drift a little against its own frame is what
     gives an editorial page its depth — the frame is a window, and you
     are moving past it. The image is oversized so the drift never
     exposes an edge.                                                   */
  (function framedParallax() {
    if (reduce) return;
    var frames = $$('.svc__media, .oshi__portrait, .studio__media, .work__frame, .hero__frame')
      .map(function (f) { return { frame: f, media: null, y: 0 }; });
    if (!frames.length) return;

    /* the scale this holds images at, read from the stylesheet so the
       hero entrance and this agree on one number */
    var zoom = (getComputedStyle(document.documentElement)
      .getPropertyValue('--frame-zoom') || '1.14').trim() || '1.14';

    /* The hero photograph is mid-entrance when this starts, and that
       entrance is a transform set in CSS. Claiming it now would
       overwrite it on the first frame and the opening move would never
       be seen, so the hero frame is held back until it has landed. */
    var heroFrame = $('.hero__frame'), heroReady = !heroFrame;
    if (heroFrame) {
      onRelease(function () {
        var go = function () { heroReady = true; };
        var m = heroFrame.querySelector('img, .slot');
        if (m) {
          m.addEventListener('transitionend', function (e) {
            if (e.propertyName === 'transform') go();
          });
        }
        setTimeout(go, 2600);   /* backstop: the entrance runs ~2.2s */
      });
    }

    /* A missing photograph is swapped for a placeholder on the image's
       error event, which fires well after this runs. Holding the original
       reference would leave us animating a node that is no longer in the
       page, so each frame re-resolves its own child whenever the one it
       has drops out of the document. */
    function resolve(o) {
      if (o.media && o.media.isConnected) return o.media;
      o.media = o.frame.querySelector('img, .slot');
      if (o.media) o.media.style.willChange = 'transform';
      return o.media;
    }

    (function loop() {
      var vh = window.innerHeight;
      for (var i = 0; i < frames.length; i++) {
        var o = frames[i];
        if (o.frame === heroFrame && !heroReady) continue;
        var r = o.frame.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) continue;
        var m = resolve(o);
        if (!m) continue;
        /* -1 as the frame enters, +1 as it leaves.
           Drift is in pixels, not percent: a percentage on a transform
           resolves against the element's own box, which made the travel
           unpredictable across frames of different heights. The picture
           is 112% of its frame, so half the 12% slack is the most it can
           move before an edge would show; 4% keeps a margin.          */
        var centre = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2);
        o.y = lerp(o.y, clamp(centre, -1, 1) * r.height * 0.045, 0.12);
        /* One transform does both jobs: the scale supplies the slack the
           drift moves through, so no width, height or offset is touched
           and there is nothing for a percentage to resolve against. */
        m.style.transform = 'translate3d(0,' + o.y.toFixed(1) + 'px,0) scale(' + zoom + ')';
      }
      requestAnimationFrame(loop);
    })();
  })();

  /* ---------- 7c. the gallery rail ----------
     Drag it, throw a wheel at it, or use the arrow keys. It is an
     ordinary scroll container, so a trackpad and a screen reader both
     already know what to do with it.                                  */
  (function rail() {
    var track = $('#workTrack'), bar = $('#workBar');
    if (!track) return;

    var looped = track.getAttribute('data-looped') === '1';
    /* declared up here because wrap(), below, adjusts its accumulator */
    var drift = { acc: 0, wrote: 0, last: 0, on: false, idle: 0, hover: false, seen: false };

    /* One set's advance, measured rather than assumed: half the scroll
       width is not it, because the track's own padding and the gap
       either side of the seam do not divide evenly. */
    function span() {
      var kids = track.children;
      if (!looped || kids.length < 2) return 0;
      return kids[kids.length / 2].offsetLeft - kids[0].offsetLeft;
    }

    var wrapping = false;
    function wrap() {
      if (wrapping) return;
      var sp = span();
      if (!sp || track.scrollLeft < sp) return;
      wrapping = true;
      track.scrollLeft -= sp;      /* identical pixels — nothing moves */
      drift.acc -= sp; drift.wrote -= sp;   /* keep the drift in step */
      wrapping = false;
    }

    function progress() {
      if (!bar) return;
      var sp = span();
      if (sp) { bar.style.width = ((track.scrollLeft % sp) / sp) * 100 + '%'; return; }
      var max = track.scrollWidth - track.clientWidth;
      bar.style.width = (max > 4 ? (track.scrollLeft / max) * 100 : 100) + '%';
    }
    track.addEventListener('scroll', function () { wrap(); progress(); }, { passive: true });
    window.addEventListener('resize', progress);
    progress();

    /* a vertical wheel over the rail should move it sideways, but only
       while there is still rail to move — otherwise the page stops
       scrolling and the visitor feels stuck */
    track.addEventListener('wheel', function (e) {
      if (e.ctrlKey) return;
      var dx = Math.abs(e.deltaX), dy = Math.abs(e.deltaY);
      if (dx > dy) return;                       // already a sideways gesture
      var max = track.scrollWidth - track.clientWidth;
      var next = track.scrollLeft + e.deltaY;
      if (next <= 0 || next >= max) return;      // hand it back to the page
      e.preventDefault();
      track.scrollLeft = next;
    }, { passive: false });

    /* click and drag, the way you would push a print sleeve along */
    var down = false, startX = 0, startLeft = 0, moved = 0;
    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') return;     // native touch is better
      down = true; moved = 0;
      startX = e.clientX; startLeft = track.scrollLeft;
      track.classList.add('is-dragging');
    });
    track.addEventListener('pointermove', function (e) {
      if (!down) return;
      var d = e.clientX - startX;
      moved = Math.max(moved, Math.abs(d));
      track.scrollLeft = startLeft - d;
      if (moved > 4) e.preventDefault();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
      track.addEventListener(ev, function () {
        down = false;
        track.classList.remove('is-dragging');
      });
    });
    /* a drag should not also open whatever was under the cursor */
    track.addEventListener('click', function (e) {
      if (moved > 4) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    /* keyboard: the rail is focusable, so arrows and Home/End work */
    track.tabIndex = 0;
    track.setAttribute('role', 'region');
    track.setAttribute('aria-label', 'Gallery of recent work, scrollable');
    /* --- the idle drift ---
       Left to right, slowly, while nobody is using it. Anything that
       counts as use stops it, and it only picks back up once the rail
       has been left alone for a moment — so it never fights a hand on
       the trackpad, and never crawls out from under a reader mid-card.
       It is suspended off-screen and in a hidden tab as well, because a
       rAF loop nobody can see is just battery.                         */
    function still() {                       /* may it move right now? */
      return drift.on && drift.seen && !drift.hover && !down &&
             !document.hidden && !track.contains(document.activeElement);
    }
    function hold() {                        /* a hand has arrived */
      drift.on = false;
      clearTimeout(drift.idle);
      drift.idle = setTimeout(function () {
        drift.on = true;
        drift.acc = track.scrollLeft;        /* resume from where it sits */
      }, 2200);
    }
    ['pointerdown', 'wheel', 'touchstart', 'keydown', 'focusin']
      .forEach(function (ev) { track.addEventListener(ev, hold, { passive: true }); });
    track.addEventListener('pointerenter', function () { drift.hover = true; });
    track.addEventListener('pointerleave', function () { drift.hover = false; });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (en) { drift.seen = en.isIntersecting; });
      }, { threshold: 0.12 }).observe(track);
    } else { drift.seen = true; }

    if (!reduce && looped) {
      drift.on = true;
      track.classList.add('is-drifting');
      (function step(t) {
        requestAnimationFrame(step);
        var dt = drift.last ? Math.min(t - drift.last, 60) : 16;
        drift.last = t;
        if (!still()) { drift.acc = track.scrollLeft; return; }
        /* If anything else moved the rail — a scrollbar, a jump to a
           card, the wrap — carry on from where it actually is. Writing
           a private running total back over it would haul it back. */
        if (Math.abs(track.scrollLeft - drift.wrote) > 1) drift.acc = track.scrollLeft;
        drift.acc += 22 * dt / 1000;         /* px per second */
        track.scrollLeft = drift.acc;        /* scroll fires wrap() */
        drift.wrote = track.scrollLeft;      /* what the browser took */
      })(0);
    }

    track.addEventListener('keydown', function (e) {
      var step = track.clientWidth * 0.8;
      if (e.key === 'ArrowRight') { track.scrollLeft += step; e.preventDefault(); }
      if (e.key === 'ArrowLeft')  { track.scrollLeft -= step; e.preventDefault(); }
      if (e.key === 'Home')       { track.scrollLeft = 0; e.preventDefault(); }
      if (e.key === 'End')        {
        /* the far end of the real set, not of the duplicated track */
        var sp = span();
        track.scrollLeft = sp ? sp - track.clientWidth : track.scrollWidth;
        e.preventDefault();
      }
    });
  })();

  /* ---------- 9. modal plumbing (focus trap + scroll lock) ---------- */
  var modalApi = (function modals() {
    var openEl = null, lastFocus = null;
    var FOCUS = 'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])';

    function open(el) {
      if (!el) return;
      lastFocus = document.activeElement;
      el.hidden = false;
      void el.offsetWidth;                 // force reflow so the transition runs
      el.classList.add('open');
      document.body.classList.add('modal-open');
      openEl = el;
      var f = el.querySelector(FOCUS);
      if (f) setTimeout(function () { f.focus(); }, 60);
    }
    function close() {
      if (!openEl) return;
      var el = openEl;
      openEl = null;
      el.classList.remove('open');
      document.body.classList.remove('modal-open');
      setTimeout(function () { if (!el.classList.contains('open')) el.hidden = true; }, 520);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    document.addEventListener('keydown', function (e) {
      if (!openEl) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      var f = $$(FOCUS, openEl).filter(function (n) { return n.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], lastN = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { lastN.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === lastN) { first.focus(); e.preventDefault(); }
    });
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) { close(); }
    });
    return { open: open, close: close };
  })();

  /* ---------- 10. booking ----------
     Every Book now button opens the same panel, which offers the two
     real ways in: a DM to Oshi, or the free consult form. Clicking one
     of the per-service buttons carries that service into the consult
     form, so nobody has to pick it twice.                             */
  var wanted = '';            /* the service a Book <service> button named */
  (function booking() {
    var modal = $('#bookingModal');
    if (!modal) return;
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-open="booking"]');
      if (!t) return;
      e.preventDefault();
      menuApi.close();
      wanted = t.getAttribute('data-service') || '';
      modalApi.open(modal);
    });
  })();

  /* ---------- 11. free consultation form ---------- */
  (function consult() {
    var form = $('#consultForm');
    if (!form) return;
    var done = $('#consultDone'), doneMsg = $('#consultDoneMsg'), reset = $('#consultReset');

    function err(id, msg) {
      var f = $('.cform__err[data-for="' + id + '"]');
      var input = $('#' + id);
      if (f) f.textContent = msg || '';
      if (input) {
        if (msg) input.setAttribute('aria-invalid', 'true');
        else input.removeAttribute('aria-invalid');
      }
      return !msg;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('#cf-name').value.trim();
      var contact = $('#cf-contact').value.trim();
      var service = $('#cf-service').value;
      var ok = true;
      ok = err('cf-name', name ? '' : 'Please tell Oshi your name.') && ok;
      var contactOk = /.+@.+\..+/.test(contact) || /^[\d\s+()-]{8,}$/.test(contact);
      ok = err('cf-contact', contactOk ? '' : 'An email or mobile number so Oshi can reply.') && ok;
      ok = err('cf-service', service ? '' : 'Pick a service, or "not sure".') && ok;
      if (!ok) {
        var bad = form.querySelector('[aria-invalid="true"]');
        if (bad) bad.focus();
        return;
      }
      var day = $('#cf-day').value;
      doneMsg.textContent = 'Thanks ' + name + ' — Oshi will come back to you about ' +
        service.toLowerCase() + (day ? ' for a ' + day : '') +
        ', usually within a day. Send your photos through when she replies.';
      form.hidden = true;
      done.hidden = false;
      done.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    });

    if (reset) reset.addEventListener('click', function () {
      form.reset();
      ['cf-name', 'cf-contact', 'cf-service'].forEach(function (id) { err(id, ''); });
      done.hidden = true;
      form.hidden = false;
      $('#cf-name').focus();
    });
  })();

  /* ---------- 12. "free consult" jumps to the form ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-open="consult"]');
    if (!t) return;
    e.preventDefault();
    menuApi.close();
    modalApi.close();
    var sec = $('#consult');
    if (!sec) return;
    /* carry through whichever service the visitor named, so they are
       not asked to choose it a second time */
    if (wanted) {
      var sel = $('#cf-service');
      if (sel) {
        for (var i = 0; i < sel.options.length; i++) {
          if (sel.options[i].text === wanted) { sel.selectedIndex = i; break; }
        }
      }
      wanted = '';
    }
    var top = sec.getBoundingClientRect().top + window.scrollY - 60;
    window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
    setTimeout(function () {
      var f = $('#cf-name');
      if (f && !$('#consultForm').hidden) f.focus({ preventScroll: true });
    }, reduce ? 0 : 700);
  });

  /* ---------- 14. misc ---------- */
  var yr = $('#yr');
  if (yr) yr.textContent = new Date().getFullYear();

  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id.length < 2) return;
      var t = document.querySelector(id);
      if (!t) return;
      e.preventDefault();
      window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 60,
                        behavior: reduce ? 'auto' : 'smooth' });
    });
  });
})();
