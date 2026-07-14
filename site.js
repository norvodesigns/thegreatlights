/* ============================================================
   THE GREAT LIGHTS — shared site engine
   Scroll-driven atmosphere, adaptive navigation, reveals,
   mobile menu, loader and accessible form logic.
   One engine drives all four pages so they move as one.
   ============================================================ */
(() => {
  'use strict';
  const q  = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── per-page atmosphere window ───────────────────────────
     Each page occupies a slice of one continuous dawn→dusk arc,
     so navigating feels like moving through the same world.   */
  const body = document.body;
  const aStart = parseFloat(body.dataset.atmoStart ?? '0');
  const aEnd   = parseFloat(body.dataset.atmoEnd ?? '1');

  /* ── footer year ── */
  const yr = q('#year'); if (yr) yr.textContent = new Date().getFullYear();

  /* ─────────────  ATMOSPHERE  ───────────── */
  const sky = q('#lp-sky'), sun = q('#lp-sun'), sunGlow = q('#lp-sun .sun-glow'), rays = q('#lp-rays'),
        hills = q('#lp-hills'), water = q('#lp-water'), grove = q('#lp-grove'),
        mistA = q('#lp-mist-a'), mistB = q('#lp-mist-b'), nav = q('#lp-nav');

  // particles (skip when motion is reduced)
  const pc = q('#lp-particles');
  if (pc && !reduceMotion) {
    for (let i = 0; i < 46; i++) {
      const d = document.createElement('div');
      const s = (Math.random() * 4 + 1.4).toFixed(1);
      const aqua = Math.random() > 0.55;
      const col = aqua
        ? `rgba(200,244,238,${(Math.random() * 0.45 + 0.2).toFixed(2)})`
        : `rgba(255,248,232,${(Math.random() * 0.5 + 0.25).toFixed(2)})`;
      d.style.cssText =
        `position:absolute;left:${(Math.random() * 100).toFixed(2)}%;top:${(Math.random() * 100).toFixed(2)}%;`
        + `width:${s}px;height:${s}px;border-radius:50%;background:${col};`
        + `box-shadow:0 0 ${Math.round(s * 2.5)}px ${aqua ? 'rgba(190,240,235,.5)' : 'rgba(255,244,214,.55)'};`
        + `animation:lp-rise ${(Math.random() * 10 + 8).toFixed(1)}s linear ${(-Math.random() * 14).toFixed(1)}s infinite`;
      pc.appendChild(d);
    }
  }

  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const stops = [
    { t: 0.00, top: '#10243a', mid: '#2f5a5e', bot: '#d98f86', sun: '#ffd9b0', sunY: 78, sz: 470, op: 0.85 },
    { t: 0.16, top: '#355f7e', mid: '#6fa07e', bot: '#f0c19a', sun: '#ffe9c8', sunY: 50, sz: 600, op: 1.00 },
    { t: 0.34, top: '#bfe0e2', mid: '#cfe4cf', bot: '#d8ecd2', sun: '#fffced', sunY: 28, sz: 480, op: 0.78 },
    { t: 0.50, top: '#dceae6', mid: '#d2e6df', bot: '#c9e0d8', sun: '#f0f6ef', sunY: 24, sz: 540, op: 0.40 },
    { t: 0.66, top: '#a9dbe0', mid: '#6fc2c6', bot: '#3f9aa6', sun: '#dffaf6', sunY: 30, sz: 440, op: 0.55 },
    { t: 0.82, top: '#6fa07a', mid: '#3f7551', bot: '#1e4632', sun: '#ffe9a8', sunY: 20, sz: 380, op: 0.55 },
    { t: 1.00, top: '#244a44', mid: '#3f6b52', bot: '#c9a86a', sun: '#ffdba0', sunY: 64, sz: 360, op: 0.52 },
  ].map((s) => ({ ...s, topC: hex(s.top), midC: hex(s.mid), botC: hex(s.bot), sunC: hex(s.sun) }));

  const mix = (c1, c2, k) => [Math.round(lerp(c1[0], c2[0], k)), Math.round(lerp(c1[1], c2[1], k)), Math.round(lerp(c1[2], c2[2], k))];
  const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
  const band = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
  const sample = (p) => {
    let i = 0;
    while (i < stops.length - 2 && p > stops[i + 1].t) i++;
    const a = stops[i], b = stops[i + 1];
    const k = clamp((p - a.t) / (b.t - a.t), 0, 1);
    return {
      top: mix(a.topC, b.topC, k), mid: mix(a.midC, b.midC, k), bot: mix(a.botC, b.botC, k),
      sun: mix(a.sunC, b.sunC, k), sunY: lerp(a.sunY, b.sunY, k), sz: lerp(a.sz, b.sz, k), op: lerp(a.op, b.op, k),
    };
  };
  // relative luminance (0–255 space) for nav contrast decisions
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

  // cache each float's document-relative position instead of calling
  // getBoundingClientRect() on every one of them on every scroll frame —
  // that per-frame layout read (times a dozen+ elements on content-heavy
  // pages) was a real source of mobile scroll jank. Re-measure only when
  // the layout can actually have changed.
  const floats = qa('[data-lp-float]');
  let floatMeta = [];
  const measureFloats = () => {
    const scrollY = (document.scrollingElement || document.documentElement).scrollTop;
    floatMeta = floats.map((f) => {
      const r = f.getBoundingClientRect();
      return { el: f, top: r.top + scrollY, height: r.height };
    });
  };
  measureFloats();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureFloats).catch(() => {});
  window.addEventListener('load', measureFloats);
  let resizeTimer = null;
  const scheduleRemeasure = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(measureFloats, 150); };
  window.addEventListener('resize', scheduleRemeasure);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', scheduleRemeasure);

  let navTone = 'dark';

  const update = () => {
    ticking = false;
    const se = document.scrollingElement || document.documentElement;
    const vh = window.innerHeight;
    const max = se.scrollHeight - vh;
    const y = se.scrollTop || window.scrollY || 0;
    const pLocal = clamp(max > 0 ? y / max : 0, 0, 1);
    const p = aStart + pLocal * (aEnd - aStart);      // position on the master arc
    const s = sample(p);

    if (sky) sky.style.background = `linear-gradient(180deg, ${rgb(s.top)} 0%, ${rgb(s.mid)} 52%, ${rgb(s.bot)} 100%)`;
    if (sun) {
      // transform + opacity only — compositor-only properties, no forced
      // layout reflow on scroll (this was the biggest source of mobile jank:
      // animating width/height/top forces a synchronous reflow every frame)
      if (sunGlow) sunGlow.style.background = `radial-gradient(circle, ${rgb(s.sun)} 0%, rgba(0,0,0,0) 70%)`;
      sun.style.opacity = s.op.toFixed(3);
      const sunScale = s.sz / 600;
      const sunPx = (s.sunY / 100) * vh;
      sun.style.transform = `translate(-50%, calc(${sunPx.toFixed(1)}px - 50%)) scale(${sunScale.toFixed(3)})`;
    }
    if (rays) rays.style.opacity = (0.5 * band(p, 0.06, 0.18) * (1 - band(p, 0.28, 0.42)) + 0.6 * band(p, 0.70, 0.84) * (1 - band(p, 0.95, 1))).toFixed(3);
    if (hills) { hills.style.opacity = (1 - band(p, 0.30, 0.50)).toFixed(3); hills.style.transform = `translateY(${(p * 150).toFixed(1)}px)`; }
    if (water) water.style.opacity = (band(p, 0.46, 0.60) * (1 - band(p, 0.86, 0.98))).toFixed(3);
    if (grove) { grove.style.opacity = (band(p, 0.66, 0.86)).toFixed(3); grove.style.transform = `translateY(${((1 - band(p, 0.62, 1)) * 70).toFixed(1)}px)`; }
    const mk = 0.22 + 0.7 * band(p, 0.40, 0.54) * (1 - band(p, 0.60, 0.74));
    if (mistA) mistA.style.opacity = mk.toFixed(3);
    if (mistB) mistB.style.opacity = (mk * 0.8).toFixed(3);

    // adaptive navbar: colour to the sky and flip foreground when the sky is light
    if (nav) {
      const navOpac = clamp(0.72 + p * 0.14, 0.72, 0.86);
      nav.style.background = `rgba(${s.mid[0]},${s.mid[1]},${s.mid[2]},${navOpac})`;
      // luminance with hysteresis so the flip never flickers
      const L = lum(s.mid);
      const wantTone = L > (navTone === 'dark' ? 168 : 150) ? 'light' : 'dark';
      if (wantTone !== navTone) { navTone = wantTone; nav.setAttribute('data-tone', navTone); }
    }

    // float reveals — fade/blur content toward the viewport centre.
    // Positions come from the cached floatMeta (see measureFloats above),
    // not a fresh getBoundingClientRect() per element per frame.
    if (!reduceMotion) {
      for (const m of floatMeta) {
        const c = (m.top - y) + m.height / 2;
        const d = (c - vh / 2) / vh;
        // in-focus window spans the middle 80% of the viewport (10% fade
        // band at the top, 10% at the bottom) — previously only the
        // middle ~33% was ever fully sharp, so most of the screen sat
        // partially blurred at any given moment.
        const frac = c / vh;
        const o = band(frac, 0, 0.1) * (1 - band(frac, 0.9, 1));
        m.el.style.opacity = o.toFixed(3);
        m.el.style.transform = `translateY(${(d * -26).toFixed(1)}px)`;
        m.el.style.filter = o < 0.99 ? `blur(${((1 - o) * 4.5).toFixed(2)}px)` : 'none';
      }
    }
  };

  let ticking = false;
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  requestAnimationFrame(update);
  setTimeout(update, 80);

  // brand click → smooth to top when already home
  const brand = q('#lp-brand-nav');
  if (brand && (location.pathname.endsWith('index.html') || location.pathname.endsWith('/'))) {
    brand.addEventListener('click', (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); });
  }

  /* ─────────────  MOBILE MENU  ───────────── */
  const toggle = q('.nav-toggle');
  const menu = q('#mobile-menu');
  if (toggle && menu) {
    const focusable = () => qa('a, button', menu).filter((el) => !el.hasAttribute('disabled'));
    let lastFocused = null;
    // moving focus here is for keyboard/screen-reader users (so focus lands
    // inside the opened menu / returns to the toggle on close) — it's not a
    // real keyboard interaction, but some browsers show the :focus-visible
    // ring for it anyway (inconsistently, hence it looking "random"). Tag
    // the element so CSS can suppress the ring for just this one focus call,
    // without touching real tab-navigation within the menu.
    const focusQuiet = (el) => {
      if (!el) return;
      el.classList.add('no-ring');
      // clear on blur, not a timer — a fixed timeout would let the ring pop
      // in later while focus never actually moved, which looks exactly like
      // the bug it's meant to fix. Real subsequent keyboard nav (Tab) moves
      // focus to a different element, which never got 'no-ring', so it gets
      // the normal ring as expected.
      el.addEventListener('blur', () => el.classList.remove('no-ring'), { once: true });
      el.focus();
    };

    const openMenu = () => {
      lastFocused = document.activeElement;
      body.classList.add('menu-open');
      body.style.overflow = 'hidden';
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Close menu');
      menu.removeAttribute('inert');
      const f = focusable(); if (f.length) setTimeout(() => focusQuiet(f[0]), 60);
    };
    const closeMenu = (restore = true) => {
      body.classList.remove('menu-open');
      body.style.overflow = '';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
      menu.setAttribute('inert', '');
      if (restore && lastFocused) focusQuiet(lastFocused);
    };
    menu.setAttribute('inert', '');
    toggle.addEventListener('click', () => body.classList.contains('menu-open') ? closeMenu() : openMenu());
    qa('a', menu).forEach((a) => a.addEventListener('click', () => closeMenu(false)));
    document.addEventListener('keydown', (e) => {
      if (!body.classList.contains('menu-open')) return;
      if (e.key === 'Escape') closeMenu();
      if (e.key === 'Tab') {                       // focus trap
        const f = focusable(); if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    // reset if resized up to desktop while open
    window.addEventListener('resize', () => { if (window.innerWidth > 900 && body.classList.contains('menu-open')) closeMenu(false); });
  }

  /* ─────────────  LOADER  ───────────── */
  const loader = q('#tgl-loader');
  if (loader && !reduceMotion) {
    let seen = false;
    try { seen = !!sessionStorage.getItem('tgl-seen'); } catch (e) {}
    if (seen) { loader.classList.add('is-hidden'); }
    else {
      const hide = () => {
        loader.classList.add('is-hidden');
        try { sessionStorage.setItem('tgl-seen', '1'); } catch (e) {}
      };
      window.addEventListener('load', () => setTimeout(hide, 420));
      setTimeout(hide, 1600); // safety cap
    }
  } else if (loader) {
    loader.classList.add('is-hidden');
  }

  /* ─────────────  MAGNETIC BUTTONS  ───────────── */
  // buttons lean gently toward the cursor and spring back on release —
  // only on devices with a real mouse; touch/reduced-motion keep the plain CSS hover.
  const canMagnet = !reduceMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (canMagnet) {
    const magnets = qa('.cta-pill, .nav-cta, .form-submit, .svc-toc a, .contact-arrow');
    magnets.forEach((el) => {
      let raf = null;
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const mx = clamp((e.clientX - (r.left + r.width / 2)) * 0.3, -10, 10);
        const my = clamp((e.clientY - (r.top + r.height / 2)) * 0.3, -8, 8);
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          el.style.transition = 'transform .15s ease-out';
          el.style.transform = `translate(${mx.toFixed(1)}px, ${(my - 2).toFixed(1)}px) scale(1.04)`;
        });
      });
      el.addEventListener('mouseleave', () => {
        if (raf) cancelAnimationFrame(raf);
        el.style.transition = 'transform .6s var(--ease-spring)';
        el.style.transform = '';
      });
    });
  }

  /* ─────────────  CONTACT FORM  ───────────── */
  const form = q('#contact-form');
  if (form) {
    const status = q('#form-status');
    const card = q('.form-card');
    const errorBox = q('#form-error');
    const submitBtn = q('.form-submit', form);
    const submitLabel = submitBtn ? submitBtn.textContent : '';

    /* EmailJS (emailjs.com) — fill in your own three values below:
       - Public Key:  Account > General
       - Service ID:  Email Services > (your service)
       - Template ID: Email Templates > (your template)
       The public key is designed to be exposed in client-side code — it
       identifies your account but can't do anything without the service
       and template you've configured, so this is safe to ship as-is. */
    const EMAILJS_PUBLIC_KEY = 'NECckX4AiLjvCav0C';
    const EMAILJS_SERVICE_ID = 'service_2ulcamt';
    const EMAILJS_TEMPLATE_ID = 'template_ykj8lj2';
    if (window.emailjs) window.emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });

    const validators = {
      name: (v) => v.trim().length >= 2 || 'Please share your name.',
      email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) || 'Please enter a valid email address.',
      message: (v) => v.trim().length >= 10 || 'A sentence or two helps me understand how to help.',
    };
    const fieldWrap = (input) => input.closest('.field');
    const validateField = (input) => {
      const rule = validators[input.name];
      if (!rule) return true;
      const res = rule(input.value);
      const wrap = fieldWrap(input);
      const errEl = wrap && wrap.querySelector('.field-error');
      if (res === true) {
        wrap && wrap.classList.remove('invalid');
        input.setAttribute('aria-invalid', 'false');
        return true;
      }
      wrap && wrap.classList.add('invalid');
      input.setAttribute('aria-invalid', 'true');
      if (errEl) errEl.textContent = res;
      return false;
    };

    qa('input, textarea', form).forEach((input) => {
      input.addEventListener('blur', () => { if (input.name in validators) validateField(input); });
      input.addEventListener('input', () => {
        const wrap = fieldWrap(input);
        if (wrap && wrap.classList.contains('invalid')) validateField(input);
      });
    });

    const showSuccess = () => {
      if (status) status.textContent = 'Thank you — your message has been received.';
      if (card) card.classList.add('is-success');
      const name = (q('#f-name') && q('#f-name').value.trim().split(' ')[0]) || '';
      const nameSlot = q('#success-name'); if (nameSlot && name) nameSlot.textContent = ', ' + name;
      if (!reduceMotion && card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fields = qa('input, textarea', form).filter((i) => i.name in validators);
      let firstInvalid = null; let ok = true;
      fields.forEach((input) => { if (!validateField(input) && !firstInvalid) { firstInvalid = input; ok = false; } else if (!validateField(input)) ok = false; });
      if (!ok) {
        if (status) status.textContent = 'Please check the highlighted fields and try again.';
        if (firstInvalid) firstInvalid.focus();
        return;
      }
      if (errorBox) { errorBox.textContent = ''; errorBox.classList.remove('is-visible'); }

      const timeField = q('input[name="submitted_at"]', form);
      if (timeField) timeField.value = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

      if (!window.emailjs) {
        // EmailJS didn't load (offline, blocked, or the three IDs above
        // haven't been filled in yet) — fall back to the form's own
        // mailto: action rather than failing with no feedback at all.
        form.submit();
        return;
      }

      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending…'; }

      window.emailjs.sendForm(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, form).then(
        () => {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = submitLabel; }
          showSuccess();
        },
        (err) => {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = submitLabel; }
          if (errorBox) {
            errorBox.textContent = 'Something went wrong sending your message — please try again, or email connect@thegreatlights.com directly.';
            errorBox.classList.add('is-visible');
          }
          if (status) status.textContent = 'There was a problem sending your message.';
          console.error('EmailJS send failed:', err);
        }
      );
    });
  }

  /* ─────────────  ANCHOR LINKS (native smooth scroll)  ───────────── */
  // scrolling runs on the browser's own compositor thread — no smoothing
  // library sitting in between, so it tracks input exactly 1:1.
  qa('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length > 1) {
        const t = q(id);
        if (t) {
          e.preventDefault();
          const y = t.getBoundingClientRect().top + window.scrollY - 80;
          window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
        }
      }
    });
  });

})();
