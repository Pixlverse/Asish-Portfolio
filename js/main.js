/* ============================================================
   ASISH THOMAS MURICKAVELI — main.js
   Vanilla JS. No dependencies. Each block below is a self-contained
   module: it finds its own nodes, bails silently if they're absent.

   Modules
     00  Utilities
     01  Preloader
     02  Text splitting (word masks)
     03  Scroll reveal
     04  Navigation + fullscreen menu
     05  Section rail + active link
     06  Scroll progress + journey track
     08  Animated counters
     09  Magnetic buttons + card spotlight
     11  Parallax
     12  Misc (anchors, year)
============================================================ */

(function () {
  'use strict';

  /* ==========================================================
     00 · UTILITIES
  ========================================================== */

  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* Content entrances are CSS-gated on the `.js` class. If anything in here
     throws, drop the class so the page falls back to plain, fully visible
     HTML instead of a screen of hidden elements. */
  window.addEventListener('error', function recover() {
    document.documentElement.classList.remove('js');
    document.body.classList.remove('is-locked');
    const loader = document.getElementById('preloader');
    if (loader) loader.remove();
  }, { once: true });

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = motionQuery.matches;
  motionQuery.addEventListener('change', (e) => { reducedMotion = e.matches; });

  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const lerp  = (a, b, t) => a + (b - a) * t;
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
  const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

  /* One shared rAF loop for everything that must run per-frame.
     Cheaper — and smoother — than each module owning its own loop. */
  const frameTasks = new Set();
  let frameRunning = false;

  function onFrame(fn) {
    frameTasks.add(fn);
    if (!frameRunning) {
      frameRunning = true;
      requestAnimationFrame(tick);
    }
    return () => frameTasks.delete(fn);
  }

  function tick() {
    frameTasks.forEach((fn) => fn());
    if (frameTasks.size) requestAnimationFrame(tick);
    else frameRunning = false;
  }

  /* Scroll state is read once per frame, never per listener. */
  const scrollState = { y: window.scrollY, max: 1 };

  function measureScrollMax() {
    scrollState.max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  }
  measureScrollMax();

  window.addEventListener('scroll', () => { scrollState.y = window.scrollY; }, { passive: true });
  window.addEventListener('resize', measureScrollMax, { passive: true });


  /* ==========================================================
     01 · PRELOADER
     Counts while the page loads, then lifts. Never blocks longer
     than it has to — resolves on `load` or after a hard timeout.
  ========================================================== */

  (function preloader() {
    const el    = $('#preloader');
    const count = $('#preloaderCount');
    const bar   = $('#preloaderBar');
    if (!el) return;

    let progress = 0;
    let loaded = false;
    let raf;

    const finish = () => {
      el.classList.add('is-done');
      document.body.classList.remove('is-locked');
      // Kick off the hero animation only once the curtain starts lifting
      document.body.classList.add('is-ready');
      window.setTimeout(() => el.remove(), 800);
    };

    if (reducedMotion) {
      window.addEventListener('load', finish, { once: true });
      window.setTimeout(finish, 1200);
      return;
    }

    document.body.classList.add('is-locked');

    const step = () => {
      // ease toward 100 — faster once the window has actually loaded
      const target = loaded ? 100 : 88;
      progress = lerp(progress, target, loaded ? 0.14 : 0.035);

      if (count) count.textContent = String(Math.round(progress)).padStart(2, '0');
      if (bar) bar.style.transform = `scaleX(${progress / 100})`;

      if (loaded && progress > 99.2) {
        if (count) count.textContent = '100';
        if (bar) bar.style.transform = 'scaleX(1)';
        cancelAnimationFrame(raf);
        window.setTimeout(finish, 260);
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    window.addEventListener('load', () => { loaded = true; }, { once: true });
    // Safety net: never hold the page hostage to a slow font or image
    window.setTimeout(() => { loaded = true; }, 3500);
  })();


  /* ==========================================================
     02 · TEXT SPLITTING
     Wraps each word of [data-split] in .word > i so the inner
     span can slide up out of an overflow-hidden mask.
     <br> and inline tags are preserved.
  ========================================================== */

  function splitElement(el) {
    if (el.dataset.splitDone) return;

    const base = parseInt(el.dataset.delay || '0', 10);
    const frag = document.createDocumentFragment();
    let index = 0;

    const walk = (node, target) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const parts = child.textContent.split(/(\s+)/);
          parts.forEach((part) => {
            if (part === '') return;
            if (/^\s+$/.test(part)) {
              target.appendChild(document.createTextNode(' '));
              return;
            }
            const word  = document.createElement('span');
            word.className = 'word';
            const inner = document.createElement('i');
            inner.textContent = part;
            inner.style.setProperty('--d', `${base + index * 45}ms`);
            word.appendChild(inner);
            target.appendChild(word);
            index++;
          });
        } else if (child.nodeName === 'BR') {
          target.appendChild(child.cloneNode());
        } else {
          const clone = child.cloneNode(false);
          walk(child, clone);
          target.appendChild(clone);
        }
      });
    };

    walk(el, frag);
    el.textContent = '';
    el.appendChild(frag);
    el.dataset.splitDone = 'true';
  }

  $$('[data-split]').forEach(splitElement);


  /* ==========================================================
     03 · SCROLL REVEAL
     A single IntersectionObserver drives every entrance on the
     page — reveals, splits, labels and section state.
  ========================================================== */

  (function reveal() {
    const targets = $$('[data-reveal], [data-split], .display--muted, .tl, [data-section]');

    // Apply per-element delay as a CSS custom property
    $$('[data-reveal][data-delay]').forEach((el) => {
      el.style.setProperty('--d', `${el.dataset.delay}ms`);
    });

    if (!('IntersectionObserver' in window) || reducedMotion) {
      targets.forEach((el) => el.classList.add('is-in'));
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);   // reveal once, then stop watching
      });
    }, {
      rootMargin: '0px 0px -12% 0px',
      threshold: 0.12
    });

    targets.forEach((el) => io.observe(el));

    // Anything already above the fold on load should not wait for a scroll
    requestAnimationFrame(() => {
      targets.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.9) {
          el.classList.add('is-in');
          io.unobserve(el);
        }
      });
    });
  })();


  /* ==========================================================
     04 · NAVIGATION + MENU
  ========================================================== */

  (function navigation() {
    const nav    = $('#nav');
    const toggle = $('#navToggle');
    const menu   = $('#menu');
    if (!nav) return;

    let lastY = window.scrollY;
    let menuOpen = false;

    onFrame(() => {
      const y = scrollState.y;

      nav.classList.toggle('is-solid', y > 40);

      // Auto-hide on the way down, reveal on the way up — but never while
      // the menu is open, and never in the first viewport.
      if (!menuOpen && y > window.innerHeight * 0.9) {
        const goingDown = y > lastY + 4;
        const goingUp   = y < lastY - 4;
        if (goingDown) nav.classList.add('is-hidden');
        else if (goingUp) nav.classList.remove('is-hidden');
      } else {
        nav.classList.remove('is-hidden');
      }
      lastY = y;
    });

    if (!toggle || !menu) return;

    const setMenu = (open) => {
      menuOpen = open;
      toggle.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.classList.toggle('is-locked', open);

      if (open) {
        menu.hidden = false;
        // next frame so the clip-path transition has a starting state
        requestAnimationFrame(() => {
          menu.classList.add('is-open');
          $$('.menu__list a', menu).forEach((a, i) => {
            a.style.transitionDelay = `${120 + i * 45}ms`;
          });
        });
      } else {
        menu.classList.remove('is-open');
        $$('.menu__list a', menu).forEach((a) => { a.style.transitionDelay = '0ms'; });
        window.setTimeout(() => { if (!menuOpen) menu.hidden = true; }, 800);
      }
    };

    toggle.addEventListener('click', () => setMenu(!menuOpen));

    $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menuOpen) setMenu(false);
    });
  })();


  /* ==========================================================
     05 · SECTION RAIL + ACTIVE LINK
  ========================================================== */

  (function sectionRail() {
    const rail     = $('#rail');
    const sections = $$('[data-section][id]');
    if (!sections.length) return;

    const railLinks = rail ? $$('a', rail) : [];

    const setActive = (id) => {
      railLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${id}`));
    };

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        // pick the entry closest to the top of the viewport that is visible
        const visible = entries.filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });

      sections.forEach((s) => io.observe(s));
    }

    if (rail) {
      onFrame(() => {
        rail.classList.toggle('is-on', scrollState.y > window.innerHeight * 0.7);
      });
    }
  })();


  /* ==========================================================
     06 · SCROLL PROGRESS
  ========================================================== */

  (function progress() {
    const bar = $('#scrollProgress');
    if (!bar) return;

    onFrame(() => {
      bar.style.transform = `scaleX(${clamp(scrollState.y / scrollState.max, 0, 1)})`;
    });
  })();


  /* ==========================================================
     06b · JOURNEY TRACK
     Fills the connecting line as the section crosses the viewport.
     Everything is already on screen — this only paints progress.
  ========================================================== */

  (function journeyTrack() {
    const track = $('#track');
    if (!track) return;

    if (reducedMotion) {
      track.style.setProperty('--fill', '1');
      return;
    }

    onFrame(() => {
      const r = track.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 as the track enters the lower third, 1 once it clears the middle
      const p = clamp((vh * 0.82 - r.top) / (r.height + vh * 0.25), 0, 1);
      track.style.setProperty('--fill', p.toFixed(3));
    });
  })();


  /* ==========================================================
     08 · ANIMATED COUNTERS
  ========================================================== */

  (function counters() {
    const nums = $$('[data-count]');
    if (!nums.length) return;

    const render = (el, value) => {
      el.textContent = `${Math.round(value)}${el.dataset.suffix || ''}`;
    };

    if (!('IntersectionObserver' in window) || reducedMotion) {
      nums.forEach((el) => render(el, parseFloat(el.dataset.count)));
      return;
    }

    const run = (el) => {
      const target = parseFloat(el.dataset.count) || 0;
      const duration = 1800;
      const start = performance.now();

      const step = (now) => {
        const t = clamp((now - start) / duration, 0, 1);
        render(el, target * easeOutExpo(t));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        run(entry.target);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.5 });

    nums.forEach((el) => io.observe(el));
  })();


  /* ==========================================================
     09 · MAGNETIC BUTTONS
     Pointer devices only. Never interferes with touch or keyboard.
  ========================================================== */

  (function magneticButtons() {
    if (!finePointer || reducedMotion) return;

    $$('.btn').forEach((btn) => {
      const strength = 0.28;
      let raf = null;

      btn.addEventListener('mousemove', (e) => {
        const r = btn.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) * strength;
        const y = (e.clientY - (r.top + r.height / 2)) * strength;
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          btn.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        });
      });

      btn.addEventListener('mouseleave', () => {
        btn.style.transition = 'transform 700ms cubic-bezier(0.22, 1, 0.36, 1)';
        btn.style.transform = '';
        window.setTimeout(() => { btn.style.transition = ''; }, 700);
      });
    });
  })();


  /* ==========================================================
     09b · CARD SPOTLIGHT
     Feeds the pointer position to each card as --mx / --my so the
     glow tracks the cursor. Pure CSS from there.
  ========================================================== */

  (function cardSpotlight() {
    const cards = $$('.card');
    if (!cards.length || !finePointer || reducedMotion) return;

    cards.forEach((card) => {
      let raf = null;

      card.addEventListener('mousemove', (e) => {
        if (raf) return;                     // one write per frame, no more
        raf = requestAnimationFrame(() => {
          const r = card.getBoundingClientRect();
          card.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
          card.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
          raf = null;
        });
      });
    });
  })();


  /* ==========================================================
     11 · PARALLAX
     [data-parallax="0.12"] — positive drifts with the scroll,
     negative drifts against it. Only runs while on screen.
  ========================================================== */

  (function parallax() {
    const els = $$('[data-parallax]');
    if (!els.length || reducedMotion) return;

    const items = els.map((el) => ({
      el,
      speed: parseFloat(el.dataset.parallax) || 0.1,
      visible: true,
      current: 0
    }));

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const item = items.find((i) => i.el === entry.target);
          if (item) item.visible = entry.isIntersecting;
        });
      }, { rootMargin: '20% 0px 20% 0px' });
      items.forEach((i) => io.observe(i.el));
    }

    onFrame(() => {
      const vh = window.innerHeight;
      items.forEach((item) => {
        if (!item.visible) return;
        const r = item.el.getBoundingClientRect();
        // distance of the element's centre from the viewport centre
        const offset = (r.top + r.height / 2) - vh / 2;
        const target = -offset * item.speed;
        item.current = lerp(item.current, target, 0.12);
        // The `translate` property — NOT `transform`. It composes with any
        // transform the stylesheet already applies (e.g. the display word's
        // translateX(-50%) centring), instead of replacing it. Browsers without
        // it simply ignore the assignment and skip the parallax.
        item.el.style.translate = `0 ${item.current.toFixed(2)}px`;
      });
    });
  })();


  /* ==========================================================
     12 · MISC
  ========================================================== */

  (function misc() {
    // Footer year
    const year = $('#year');
    if (year) year.textContent = String(new Date().getFullYear());

    // Smooth anchor scrolling with a nav offset.
    // Native `scroll-behavior: smooth` handles the easing; this only
    // corrects the landing position and keeps the URL clean.
    $$('a[data-nav]').forEach((link) => {
      link.addEventListener('click', (e) => {
        const id = link.getAttribute('href');
        if (!id || !id.startsWith('#')) return;
        const target = document.querySelector(id);
        if (!target) return;

        e.preventDefault();
        const top = target.getBoundingClientRect().top + window.scrollY
                  - (id === '#hero' ? 0 : parseInt(getComputedStyle(document.documentElement)
                      .getPropertyValue('--nav-h'), 10) || 84);

        window.scrollTo({
          top: Math.max(0, top),
          behavior: reducedMotion ? 'auto' : 'smooth'
        });
      });
    });

    // Re-measure after fonts land — line heights shift and the
    // scroll progress denominator changes with them.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(measureScrollMax);
    }
  })();

})();
