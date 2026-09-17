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

  /* ---------- 1. preloader ---------- */
  (function preload() {
    var pl = $('#preloader'), bar = $('#plBar');
    if (!pl) { document.body.classList.remove('is-loading'); return; }
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
      var n = e.target.closest('a,button,summary,[data-cursor],.ba__stage,input,select,textarea');
      if (!n) return;
      el.classList.add('is-big');
      if (label) label.textContent = n.getAttribute('data-cursor') || '';
    });
    document.addEventListener('mouseout', function (e) {
      if (e.target.closest('a,button,summary,[data-cursor],.ba__stage,input,select,textarea')) {
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

  /* ---------- 5. reveals ---------- */
  (function reveals() {
    var items = $$('.reveal, .nano__viz');
    if (reduce || !('IntersectionObserver' in window)) {
      items.forEach(function (n) { n.classList.add('in'); }); return;
    }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en, i) {
        if (!en.isIntersecting) return;
        var n = en.target;
        setTimeout(function () { n.classList.add('in'); }, i * 65);
        io.unobserve(n);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    items.forEach(function (n) { io.observe(n); });
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

  /* ---------- 7. scroll-linked effects ---------- */
  (function scrollFX() {
    var heroImg = $('#heroImg'), craft = $('.craft'), chars = $$('#craftText .ch');
    var workSec = $('.work'), workTrk = $('#workTrack'), marquee = $('#marquee');
    var mqX = 0, mqW = 0, trkX = 0;
    function measure() { if (marquee) mqW = marquee.scrollWidth / 2; }
    measure(); window.addEventListener('resize', measure);

    (function frame() {
      var y = window.scrollY, vh = window.innerHeight;

      if (heroImg && !reduce && y < vh * 1.4) {
        heroImg.style.transform = 'scale(' + (1 + clamp(y / vh, 0, 1) * 0.07) + ')';
      }
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
      if (workSec && workTrk && window.innerWidth >= 900 && !reduce) {
        var wr = workSec.getBoundingClientRect();
        var wt = workSec.offsetHeight - vh;
        var wp = clamp((-wr.top) / (wt > 0 ? wt : 1), 0, 1);
        var dist = Math.max(workTrk.scrollWidth - window.innerWidth + 80, 0);
        trkX = lerp(trkX, -wp * dist, 0.1);
        workTrk.style.transform = 'translate3d(' + trkX + 'px,0,0)';
      } else if (workTrk && workTrk.style.transform) {
        workTrk.style.transform = '';
      }
      if (marquee && mqW && !reduce) {
        mqX -= 0.42;
        if (mqX <= -mqW) mqX += mqW;
        marquee.style.transform = 'translate3d(' + mqX + 'px,0,0)';
      }
      requestAnimationFrame(frame);
    })();
  })();

  /* ---------- 8. before / after ---------- */
  (function beforeAfter() {
    var stage = $('#baStage'), clip = $('#baClip'), handle = $('#baHandle');
    if (!stage || !clip || !handle) return;
    var pct = 50, dragging = false;
    function apply(p) {
      pct = clamp(p, 2, 98);
      clip.style.width = pct + '%';
      handle.style.left = pct + '%';
      handle.setAttribute('aria-valuenow', Math.round(pct));
    }
    function fromX(x) { var r = stage.getBoundingClientRect(); apply(((x - r.left) / r.width) * 100); }
    stage.addEventListener('pointerdown', function (e) {
      dragging = true; stage.setPointerCapture(e.pointerId); fromX(e.clientX);
    });
    stage.addEventListener('pointermove', function (e) { if (dragging) fromX(e.clientX); });
    ['pointerup', 'pointercancel'].forEach(function (ev) {
      stage.addEventListener(ev, function () { dragging = false; });
    });
    stage.addEventListener('mousemove', function (e) { if (!dragging) fromX(e.clientX); });
    handle.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft')  { apply(pct - 4); e.preventDefault(); }
      if (e.key === 'ArrowRight') { apply(pct + 4); e.preventDefault(); }
      if (e.key === 'Home') { apply(2); e.preventDefault(); }
      if (e.key === 'End')  { apply(98); e.preventDefault(); }
    });
    apply(50);
    if (!reduce && 'IntersectionObserver' in window) {
      var shown = false;
      new IntersectionObserver(function (en, ob) {
        if (!en[0].isIntersecting || shown) return;
        shown = true; ob.disconnect();
        var t0 = performance.now();
        (function nudge(now) {
          var t = (now - t0) / 1500;
          if (t >= 1 || dragging) { if (!dragging) apply(50); return; }
          apply(50 + Math.sin(t * Math.PI * 2) * 16);
          requestAnimationFrame(nudge);
        })(t0);
      }, { threshold: 0.45 }).observe(stage);
    }
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

  /* ---------- 10. booking — a working preview of the Kairo flow ---------- */
  (function booking() {
    var modal = $('#bookingModal');
    if (!modal) return;
    var state = { service: '', day: '', time: '' };
    var DAYS = [
      { k: 'Mon', n: 'Monday' }, { k: 'Tue', n: 'Tuesday' },
      { k: 'Fri', n: 'Friday' }, { k: 'Sat', n: 'Saturday' }
    ];
    var TIMES = ['9:00', '10:30', '12:00', '1:30', '3:00', '4:30'];
    /* deterministic "already booked" slots so the demo looks like a real diary */
    function taken(day, i) { return ((day.charCodeAt(0) + day.charCodeAt(1) + i * 7) % 5) === 0; }

    function step(n) {
      $$('.bk__pane', modal).forEach(function (p) {
        p.classList.toggle('is-on', p.getAttribute('data-pane') === String(n));
      });
      $$('.bk__step', modal).forEach(function (s) {
        s.classList.toggle('is-on', Number(s.getAttribute('data-step')) <= n);
      });
      var panel = $('.modal__panel', modal);
      if (panel) panel.scrollTop = 0;
    }

    function drawDays() {
      var wrap = $('#bkDays', modal);
      wrap.innerHTML = '';
      DAYS.forEach(function (d) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'bk__day' + (state.day === d.n ? ' is-on' : '');
        b.innerHTML = '<em>' + d.k + '</em><strong>' + d.n.slice(0, 1) + '</strong>';
        b.setAttribute('aria-label', d.n);
        b.setAttribute('aria-pressed', String(state.day === d.n));
        b.addEventListener('click', function () {
          state.day = d.n; state.time = '';
          drawDays(); drawSlots();
        });
        wrap.appendChild(b);
      });
    }

    function drawSlots() {
      var wrap = $('#bkSlots', modal);
      wrap.innerHTML = '';
      if (!state.day) {
        wrap.innerHTML = '<p class="bk__fine" style="grid-column:1/-1">Pick a day to see times.</p>';
        return;
      }
      TIMES.forEach(function (t, i) {
        var b = document.createElement('button');
        b.type = 'button';
        var gone = taken(state.day, i);
        b.className = 'bk__slot' + (state.time === t ? ' is-on' : '');
        b.textContent = t;
        b.disabled = gone;
        if (gone) b.setAttribute('aria-label', t + ' — already booked');
        b.addEventListener('click', function () {
          state.time = t;
          drawSlots();
          setTimeout(function () { summary(); step(3); }, 220);
        });
        wrap.appendChild(b);
      });
    }

    function summary() {
      var s = $('#bkSummary', modal);
      s.innerHTML =
        '<div><em>Service</em><strong>' + state.service + '</strong></div>' +
        '<div><em>Day</em><strong>' + state.day + '</strong></div>' +
        '<div><em>Time</em><strong>' + state.time + '</strong></div>' +
        '<div><em>Where</em><strong>350 Warrigal Rd, Oakleigh South</strong></div>';
    }

    $$('[data-pick-service]', modal).forEach(function (b) {
      b.addEventListener('click', function () {
        state.service = b.getAttribute('data-pick-service');
        $('#bkCtx', modal).textContent = state.service + ' — choose when suits you.';
        drawDays(); drawSlots(); step(2);
      });
    });
    $$('[data-goto]', modal).forEach(function (b) {
      b.addEventListener('click', function () { step(Number(b.getAttribute('data-goto'))); });
    });

    var confirm = $('#bkConfirm', modal);
    if (confirm) confirm.addEventListener('click', function () {
      var name = ($('#bk-name', modal).value || '').trim();
      $('#bkDoneSum', modal).textContent =
        (name ? name + ', your ' : 'Your ') + state.service.toLowerCase() +
        ' would be locked in for ' + state.day + ' at ' + state.time + '.';
      step(4);
    });

    /* any [data-open="booking"] opens it; a data-service preselects and skips step 1 */
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-open="booking"]');
      if (!t) return;
      e.preventDefault();
      menuApi.close();
      state = { service: '', day: '', time: '' };
      $('#bk-name', modal).value = ''; $('#bk-phone', modal).value = ''; $('#bk-notes', modal).value = '';
      var pre = t.getAttribute('data-service');
      if (pre) {
        state.service = pre;
        $('#bkCtx', modal).textContent = pre + ' — choose when suits you.';
        drawDays(); drawSlots(); step(2);
      } else {
        step(1);
      }
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
    var sec = $('#consult');
    if (!sec) return;
    var top = sec.getBoundingClientRect().top + window.scrollY - 60;
    window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
    setTimeout(function () {
      var f = $('#cf-name');
      if (f && !$('#consultForm').hidden) f.focus({ preventScroll: true });
    }, reduce ? 0 : 700);
  });

  /* ---------- 13. photo slots ---------- */
  (function photoSlots() {
    function slot(img) {
      if (img.dataset.slotted) return;
      img.dataset.slotted = '1';
      var name = (img.getAttribute('src') || '').split('/').pop();
      var box = document.createElement('div');
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
