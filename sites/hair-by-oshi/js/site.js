/* ============================================================
   HAIR BY OSHI — motion engine
   Native scroll (keeps position:sticky, anchors and a11y intact);
   every effect is scroll-LINKED and lerped on rAF for the
   buttery feel, rather than hijacking the page scroll.
   ============================================================ */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var lerp  = function (a, b, n) { return a + (b - a) * n; };
  var clamp = function (v, a, b) { return Math.min(Math.max(v, a), b); };

  /* ---------- 1. preloader ---------- */
  (function preload() {
    var pl = $('#preloader'), bar = $('#plBar');
    if (!pl) { document.body.classList.remove('is-loading'); return; }
    var p = 0, done = false;
    var tick = setInterval(function () {
      p = Math.min(p + Math.random() * 16, 92);
      if (bar) bar.style.width = p + '%';
    }, 140);

    function finish() {
      if (done) return;
      done = true;
      clearInterval(tick);
      if (bar) bar.style.width = '100%';
      setTimeout(function () {
        pl.classList.add('done');
        document.body.classList.remove('is-loading');
        setTimeout(function () { pl.remove(); }, 900);
      }, reduce ? 0 : 420);
    }
    window.addEventListener('load', finish);
    setTimeout(finish, reduce ? 200 : 2600); // never trap the user
  })();

  /* ---------- 2. custom cursor + magnetic ---------- */
  (function cursor() {
    var el = $('#cursor');
    if (!el || reduce || !window.matchMedia('(hover:hover)').matches) return;
    var label = $('.cursor__label', el);
    var tx = 0, ty = 0, cx = 0, cy = 0;

    window.addEventListener('mousemove', function (e) { tx = e.clientX; ty = e.clientY; }, { passive: true });

    (function run() {
      cx = lerp(cx, tx, 0.18);
      cy = lerp(cy, ty, 0.18);
      el.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';
      requestAnimationFrame(run);
    })();

    $$('a,button,[data-cursor],summary,.ba__stage').forEach(function (n) {
      n.addEventListener('mouseenter', function () {
        el.classList.add('is-big');
        if (label) label.textContent = n.getAttribute('data-cursor') || '';
      });
      n.addEventListener('mouseleave', function () {
        el.classList.remove('is-big');
        if (label) label.textContent = '';
      });
    });

    /* magnetic buttons */
    $$('[data-magnetic]').forEach(function (n) {
      var mx = 0, my = 0, ax = 0, ay = 0, raf = null, active = false;
      function loop() {
        ax = lerp(ax, mx, 0.2); ay = lerp(ay, my, 0.2);
        n.style.transform = 'translate3d(' + ax + 'px,' + ay + 'px,0)';
        if (Math.abs(ax - mx) > 0.1 || Math.abs(ay - my) > 0.1 || active) {
          raf = requestAnimationFrame(loop);
        } else { n.style.transform = ''; raf = null; }
      }
      n.addEventListener('mousemove', function (e) {
        var r = n.getBoundingClientRect();
        mx = (e.clientX - (r.left + r.width / 2)) * 0.32;
        my = (e.clientY - (r.top + r.height / 2)) * 0.42;
        active = true;
        if (!raf) raf = requestAnimationFrame(loop);
      });
      n.addEventListener('mouseleave', function () { mx = 0; my = 0; active = false; });
    });
  })();

  /* ---------- 3. nav + scroll progress ---------- */
  (function navBar() {
    var nav = $('#nav'), bar = $('#scrollBar'), last = 0;
    function onScroll() {
      var y = window.scrollY;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      if (bar) bar.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
      if (nav) {
        nav.classList.toggle('stuck', y > 40);
        nav.classList.toggle('hide', y > last && y > 400 && !document.body.classList.contains('menu-open'));
      }
      last = y;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  })();

  /* ---------- 4. mobile menu ---------- */
  (function menu() {
    var b = $('#burger'), m = $('#menu');
    if (!b || !m) return;
    function set(open) {
      m.hidden = false;
      m.classList.toggle('open', open);
      b.setAttribute('aria-expanded', String(open));
      b.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.classList.toggle('menu-open', open);
      if (!open) setTimeout(function () { if (!m.classList.contains('open')) m.hidden = true; }, 800);
    }
    b.addEventListener('click', function () { set(!m.classList.contains('open')); });
    $$('a', m).forEach(function (a) { a.addEventListener('click', function () { set(false); }); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && m.classList.contains('open')) { set(false); b.focus(); }
    });
  })();

  /* ---------- 5. reveal on enter ---------- */
  (function reveals() {
    var items = $$('.reveal, .nano__viz');
    if (reduce || !('IntersectionObserver' in window)) {
      items.forEach(function (n) { n.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en, i) {
        if (!en.isIntersecting) return;
        var n = en.target;
        setTimeout(function () { n.classList.add('in'); }, i * 70);
        io.unobserve(n);
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
    items.forEach(function (n) { io.observe(n); });
  })();

  /* ---------- 6. split the craft sentence into chars ---------- */
  (function split() {
    var el = $('#craftText');
    if (!el) return;
    var words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach(function (w, wi) {
      var span = document.createElement('span');
      span.className = 'wd';
      span.style.display = 'inline-block';
      w.split('').forEach(function (ch) {
        var c = document.createElement('span');
        c.className = 'ch';
        c.textContent = ch;
        span.appendChild(c);
      });
      el.appendChild(span);
      if (wi < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
  })();

  /* ---------- 7. scroll-linked effects (single rAF) ---------- */
  (function scrollFX() {
    var heroImg  = $('#heroImg');
    var craft    = $('.craft');
    var chars    = $$('#craftText .ch');
    var workSec  = $('.work');
    var workTrk  = $('#workTrack');
    var marquee  = $('#marquee');

    var mqX = 0, mqW = 0, trkX = 0, trkTarget = 0;
    if (marquee) mqW = marquee.scrollWidth / 2;
    window.addEventListener('resize', function () {
      if (marquee) mqW = marquee.scrollWidth / 2;
    });

    function frame() {
      var y  = window.scrollY;
      var vh = window.innerHeight;

      /* hero parallax */
      if (heroImg && !reduce) {
        var hp = clamp(y / vh, 0, 1.4);
        heroImg.style.transform = 'translate3d(0,' + (hp * -9) + '%,0) scale(' + (1 + hp * 0.07) + ')';
      }

      /* craft — light each character as you scroll through */
      if (craft && chars.length) {
        var r = craft.getBoundingClientRect();
        var total = craft.offsetHeight - vh;
        var prog = clamp((-r.top) / (total > 0 ? total : 1), 0, 1);
        var eased = clamp((prog - 0.08) / 0.68, 0, 1);
        var upTo = Math.round(eased * chars.length);
        for (var i = 0; i < chars.length; i++) {
          var lit = i < upTo;
          if (chars[i]._lit !== lit) { chars[i].classList.toggle('lit', lit); chars[i]._lit = lit; }
        }
      }

      /* work — pin & translate horizontally */
      if (workSec && workTrk && window.innerWidth > 860 && !reduce) {
        var wr = workSec.getBoundingClientRect();
        var wtotal = workSec.offsetHeight - vh;
        var wp = clamp((-wr.top) / (wtotal > 0 ? wtotal : 1), 0, 1);
        var dist = workTrk.scrollWidth - window.innerWidth + 80;
        trkTarget = -wp * Math.max(dist, 0);
        trkX = lerp(trkX, trkTarget, 0.1);
        workTrk.style.transform = 'translate3d(' + trkX + 'px,0,0)';
      }

      /* marquee — constant drift */
      if (marquee && mqW && !reduce) {
        mqX -= 0.45;
        if (mqX <= -mqW) mqX += mqW;
        marquee.style.transform = 'translate3d(' + mqX + 'px,0,0)';
      }

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  })();

  /* ---------- 8. before / after slider ---------- */
  (function beforeAfter() {
    var stage  = $('#baStage'), clip = $('#baClip'), handle = $('#baHandle');
    if (!stage || !clip || !handle) return;
    var pct = 50, dragging = false;

    function apply(p) {
      pct = clamp(p, 2, 98);
      clip.style.width = pct + '%';
      handle.style.left = pct + '%';
      handle.setAttribute('aria-valuenow', Math.round(pct));
    }
    function fromX(x) {
      var r = stage.getBoundingClientRect();
      apply(((x - r.left) / r.width) * 100);
    }

    stage.addEventListener('pointerdown', function (e) {
      dragging = true;
      stage.setPointerCapture(e.pointerId);
      fromX(e.clientX);
    });
    stage.addEventListener('pointermove', function (e) { if (dragging) fromX(e.clientX); });
    ['pointerup', 'pointercancel'].forEach(function (ev) {
      stage.addEventListener(ev, function () { dragging = false; });
    });
    stage.addEventListener('mousemove', function (e) { if (!dragging) fromX(e.clientX); });

    handle.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft')  { apply(pct - 4); e.preventDefault(); }
      if (e.key === 'ArrowRight') { apply(pct + 4); e.preventDefault(); }
      if (e.key === 'Home')       { apply(2);  e.preventDefault(); }
      if (e.key === 'End')        { apply(98); e.preventDefault(); }
    });

    apply(50);
    /* gentle invitation to drag, once, when it first comes into view */
    if (!reduce && 'IntersectionObserver' in window) {
      var shown = false;
      new IntersectionObserver(function (en, ob) {
        if (!en[0].isIntersecting || shown) return;
        shown = true; ob.disconnect();
        var t0 = performance.now();
        (function nudge(now) {
          var t = (now - t0) / 1600;
          if (t >= 1 || dragging) { if (!dragging) apply(50); return; }
          apply(50 + Math.sin(t * Math.PI * 2) * 17);
          requestAnimationFrame(nudge);
        })(t0);
      }, { threshold: 0.5 }).observe(stage);
    }
  })();


  /* ---------- 10. photo slots ----------
     Until real photography is dropped into assets/img/, any missing image
     renders as a branded slot that names the file it is waiting for.
     Add a correctly named file and it simply appears — no code change.     */
  (function photoSlots() {
    function slot(img) {
      if (img.dataset.slotted) return;
      img.dataset.slotted = '1';
      var src  = img.getAttribute('src') || '';
      var name = src.split('/').pop();
      var box  = document.createElement('div');
      box.className = 'slot';
      box.setAttribute('aria-hidden', 'true');
      box.innerHTML = '<span class="slot__mark">Hair by Oshi</span>' +
                      '<span class="slot__name">' + name + '</span>' +
                      '<span class="slot__alt">' + (img.getAttribute('alt') || '') + '</span>';
      img.replaceWith(box);
    }
    $$('img').forEach(function (img) {
      if (img.complete && img.naturalWidth === 0) slot(img);
      else img.addEventListener('error', function () { slot(img); });
    });
  })();

  /* ---------- 11. misc ---------- */
  var yr = $('#yr');
  if (yr) yr.textContent = new Date().getFullYear();

  /* anchor links respect the fixed nav */
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id.length < 2) return;
      var t = document.querySelector(id);
      if (!t) return;
      e.preventDefault();
      var top = t.getBoundingClientRect().top + window.scrollY - 70;
      window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
    });
  });
})();
