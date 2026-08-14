/* Aura Shakti — site behaviour. Shared by every page. */
(function () {
  var root = document.documentElement;

  /* ── theme ────────────────────────────────────────────────────────────────
     Three states: an explicit choice wins, otherwise the OS decides. The button
     only ever writes an explicit one. */
  var btn = document.getElementById('theme');
  var stored = null;
  try { stored = localStorage.getItem('aura-site-theme'); } catch (e) {}
  // Dark is the default: the app itself is a dark product and the screenshots
  // throughout are shot on black. A visitor on a light OS still lands on the
  // intended look, and the toggle remembers them the moment they disagree.
  root.setAttribute('data-theme', stored === 'light' ? 'light' : 'dark');

  function isDark() {
    var set = root.getAttribute('data-theme');
    if (set) return set === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function paintToggle() {
    if (!btn) return;
    var dark = isDark();
    btn.setAttribute('aria-checked', String(!dark));
    btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    var svg = btn.querySelector('svg');
    var disc = btn.querySelector('.disc');
    var bite = btn.querySelector('.bite');
    var rays = btn.querySelector('.rays');
    svg.style.transform = dark ? 'rotate(-75deg)' : 'rotate(0deg)';
    disc.setAttribute('r', dark ? '9' : '5.5');
    bite.setAttribute('cx', dark ? '16' : '26');
    bite.setAttribute('cy', dark ? '7' : '0');
    rays.style.opacity = dark ? '0' : '1';
    rays.style.transform = dark ? 'scale(.4)' : 'scale(1)';
  }

  paintToggle();
  if (btn) {
    btn.addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('aura-site-theme', next); } catch (e) {}
      paintToggle();
    });
  }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paintToggle);

  /* ── the small-screen menu ─────────────────────────────────────────────── */
  var burger = document.getElementById('burger');
  var nav = document.getElementById('nav');
  if (burger && nav) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      burger.setAttribute('aria-expanded', String(open));
    });
  }

  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── reveal on scroll ──────────────────────────────────────────────────── */
  var risers = document.querySelectorAll('.rise');
  if (risers.length) {
    var reveal = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); reveal.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    risers.forEach(function (el, i) {
      // A short stagger inside a grid, so a row of cards arrives in sequence
      // rather than all at once.
      el.style.transitionDelay = (Math.min(i, 6) * 45) + 'ms';
      reveal.observe(el);
    });
  }

  /* ── the accent follows the room you are reading (home only) ───────────── */
  var soft = {
    red: 'rgba(241,88,93,.16)', blue: 'rgba(92,173,221,.16)',
    green: 'rgba(86,190,149,.16)', gold: 'rgba(228,176,84,.16)'
  };
  var softLight = {
    red: 'rgba(194,33,39,.10)', blue: 'rgba(20,99,156,.10)',
    green: 'rgba(16,112,78,.10)', gold: 'rgba(122,87,8,.10)'
  };
  var tinted = document.querySelectorAll('[data-tint]');
  if (tinted.length) {
    var accent = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var t = e.target.getAttribute('data-tint');
        root.style.setProperty('--accent', 'var(--' + t + ')');
        root.style.setProperty('--accent-soft', (isDark() ? soft : softLight)[t]);
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    tinted.forEach(function (el) { accent.observe(el); });
  }

  /* ── the device cluster follows the pointer ────────────────────────────────
     One transform on the stage, so the phones stay in a single perspective
     instead of each tilting on its own axis. */
  var stage = document.getElementById('stage');
  if (stage && !still && window.matchMedia('(pointer: fine)').matches) {
    var raf = null;
    window.addEventListener('mousemove', function (e) {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = null;
        var x = (e.clientX / window.innerWidth - .5);
        var y = (e.clientY / window.innerHeight - .5);
        stage.style.transform = 'rotateY(' + (x * 9).toFixed(2) + 'deg) rotateX(' + (-y * 5).toFixed(2) + 'deg)';
      });
    }, { passive: true });
  }

  /* ── character plates tilt toward the cursor ───────────────────────────── */
  if (!still && window.matchMedia('(pointer: fine)').matches) {
    document.querySelectorAll('.char').forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - .5;
        var y = (e.clientY - r.top) / r.height - .5;
        card.style.transform =
          'translateY(-4px) rotateY(' + (x * 7).toFixed(2) + 'deg) rotateX(' + (-y * 7).toFixed(2) + 'deg)';
      });
      card.addEventListener('mouseleave', function () { card.style.transform = ''; });
    });
  }

  /* ── report bars fill on arrival ───────────────────────────────────────── */
  var rep = document.querySelector('.report');
  if (rep) {
    new IntersectionObserver(function (es, obs) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.querySelectorAll('.fill').forEach(function (f, i) {
          setTimeout(function () { f.style.width = f.getAttribute('data-w'); }, i * 90);
        });
        obs.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -20% 0px' }).observe(rep);
  }
})();
