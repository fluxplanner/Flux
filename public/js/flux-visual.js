/**
 * Flux visual polish — pure CSS hooks + small vanilla helpers.
 * Loaded before app.js; exposes window.FluxVisual.
 */
(function () {
  'use strict';

  function prefersReduced() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (_) {
      return false;
    }
  }

  function scrambleNumber(el, finalValue, duration = 600) {
    if (!el) return;
    const fv = String(finalValue);
    if (prefersReduced()) {
      el.textContent = fv;
      return;
    }
    const start = performance.now();
    function frame(now) {
      const progress = Math.min((now - start) / duration, 1);
      if (progress < 1) {
        el.textContent = String(Math.floor(Math.random() * 100));
        requestAnimationFrame(frame);
      } else {
        el.textContent = fv;
      }
    }
    requestAnimationFrame(frame);
  }

  function countUp(el, target, duration = 800) {
    if (!el) return;
    const t = Number(target);
    if (!Number.isFinite(t) || prefersReduced()) {
      el.textContent = String(target);
      return;
    }
    const start = performance.now();
    const from = parseInt(el.textContent, 10) || 0;
    function frame(now) {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(from + (t - from) * ease));
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function encryptedReveal(el, finalText, duration = 700) {
    if (!el) return;
    if (prefersReduced()) {
      el.textContent = finalText;
      return;
    }
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    const ft = String(finalText);
    const start = performance.now();
    function frame(now) {
      const progress = (now - start) / duration;
      if (progress >= 1) {
        el.textContent = ft;
        return;
      }
      const revealed = Math.floor(progress * ft.length);
      el.textContent =
        ft.slice(0, revealed) +
        [...ft.slice(revealed)].map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function initCursorSpotlight() {
    if (prefersReduced()) return;
    try {
      if (localStorage.getItem('flux_cursor_spotlight') === '0') return;
    } catch (_) {}
    if (window.innerWidth < 900) return;
    if (document.body.dataset.fluxCursor === 'off') return;
    const spotlight = document.createElement('div');
    spotlight.id = 'cursorSpotlight';
    spotlight.style.cssText = `position:fixed;pointer-events:none;z-index:1;width:400px;height:400px;border-radius:50%;transform:translate(-50%,-50%);background:radial-gradient(circle,rgba(var(--accent-rgb),0.05) 0%,transparent 70%);transition:opacity 0.3s;opacity:0`;
    document.body.appendChild(spotlight);
    let raf = 0;
    document.addEventListener(
      'mousemove',
      (e) => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          spotlight.style.left = e.clientX + 'px';
          spotlight.style.top = e.clientY + 'px';
          spotlight.style.opacity = '1';
        });
      },
      { passive: true }
    );
    document.addEventListener('mouseleave', () => {
      spotlight.style.opacity = '0';
    });
  }

  function initRippleEffect() {
    if (prefersReduced()) return;
    document.addEventListener(
      'click',
      (e) => {
        const btn = e.target.closest('button, .btn-primary, .nav-item, .bnav-item');
        if (!btn) return;
        const rect = btn.getBoundingClientRect();
        const ripple = document.createElement('span');
        const size = Math.max(rect.width, rect.height) * 2;
        ripple.style.cssText = `position:absolute;width:${size}px;height:${size}px;border-radius:50%;background:rgba(255,255,255,0.12);transform:scale(0);animation:ripple-expand 0.5s ease forwards;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px;pointer-events:none;z-index:10`;
        const prev = btn.style.position;
        if (!prev || prev === 'static') btn.style.position = 'relative';
        btn.style.overflow = 'hidden';
        btn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
      },
      true
    );
  }

  function init3DTiltCards() {
    if (window.innerWidth < 900 || prefersReduced()) return;
    const list = document.getElementById('taskList');
    if (!list) return;
    list.addEventListener('mousemove', (e) => {
      const card = e.target.closest('.task-item');
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(600px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg) translateZ(2px)`;
      card.style.transition = 'transform 0.1s ease';
      card.style.willChange = 'transform';
    });
    list.addEventListener(
      'mouseleave',
      (e) => {
        const card = e.target.closest('.task-item');
        if (card) {
          card.style.transform = '';
          card.style.transition = 'transform 0.4s ease';
          card.style.willChange = '';
        }
      },
      true
    );
  }

  function initMagneticButtons() {
    if (window.innerWidth < 900 || prefersReduced()) return;
    document.querySelectorAll('.btn-magnetic, .login-email-btn, #undoBtn, .topbar-new-task-btn').forEach((btn) => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = (e.clientX - rect.left - rect.width / 2) * 0.15;
        const y = (e.clientY - rect.top - rect.height / 2) * 0.15;
        btn.style.transform = `translate(${x}px, ${y}px) scale(1.02)`;
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
      });
    });
  }

  function initDirectionAwareHover() {
    document.querySelectorAll('.canvas-card, .ref-card').forEach((card) => {
      card.addEventListener('mouseenter', function (e) {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left,
          y = e.clientY - rect.top;
        const w = rect.width,
          h = rect.height;
        const edges = [y, h - y, x, w - x];
        const dir = edges.indexOf(Math.min.apply(null, edges));
        const fromMap = ['top', 'bottom', 'left', 'right'];
        card.dataset.hoverFrom = fromMap[dir];
      });
    });
  }

  function initCardSpotlight() {
    document.querySelectorAll('.ref-card, .st-section').forEach((card) => {
      card.addEventListener(
        'mousemove',
        (e) => {
          const rect = card.getBoundingClientRect();
          card.style.setProperty('--spotlight-x', e.clientX - rect.left + 'px');
          card.style.setProperty('--spotlight-y', e.clientY - rect.top + 'px');
        },
        { passive: true }
      );
    });
  }

  function revealText(el) {
    if (!el || prefersReduced()) return;
    const text = el.textContent;
    el.textContent = '';
    el.style.visibility = 'visible';
    [...text].forEach((char, i) => {
      const span = document.createElement('span');
      span.textContent = char === ' ' ? '\u00A0' : char;
      span.style.cssText = `opacity:0;display:inline-block;transform:translateY(4px);animation:char-reveal 0.35s ease ${i * 0.03}s forwards`;
      el.appendChild(span);
    });
  }

  function initTextRevealOnScroll() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !entry.target._fluxRevealed) {
            entry.target._fluxRevealed = true;
            revealText(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );
    document.querySelectorAll('.reveal-on-scroll').forEach((el) => observer.observe(el));
  }

  function initParallax() {
     if (prefersReduced()) return;
    const dashboard = document.getElementById('dashboard');
    const header = document.getElementById('dashHero');
    if (!dashboard || !header) return;
    dashboard.addEventListener(
      'scroll',
      () => {
        const scrolled = dashboard.scrollTop;
        header.style.transform = `translateY(${scrolled * 0.3}px)`;
        header.style.opacity = String(Math.max(0.55, 1 - scrolled * 0.003));
      },
      { passive: true }
    );
  }

  function initSidebarResize() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar || window.innerWidth < 900) return;
    const handle = document.createElement('div');
    handle.setAttribute('aria-hidden', 'true');
    handle.style.cssText =
      'position:absolute;top:0;right:-4px;bottom:0;width:8px;cursor:col-resize;z-index:10;opacity:0;transition:opacity 0.2s';
    let dragging = false,
      startX = 0,
      startW = 0;
    handle.addEventListener('mouseenter', () => (handle.style.opacity = '1'));
    handle.addEventListener('mouseleave', () => {
      if (!dragging) handle.style.opacity = '0';
    });
    sidebar.style.position = 'relative';
    sidebar.appendChild(handle);
    handle.addEventListener('mousedown', (e) => {
      dragging = true;
      startX = e.clientX;
      startW = sidebar.offsetWidth;
      document.body.style.userSelect = 'none';
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const nw = Math.min(320, Math.max(200, startW + (e.clientX - startX)));
      sidebar.style.width = nw + 'px';
      document.documentElement.style.setProperty('--sidebar-width', nw + 'px');
    });
    document.addEventListener('mouseup', () => {
      dragging = false;
      document.body.style.userSelect = '';
      handle.style.opacity = '0';
    });
  }

  function initChatScrollProgress() {
    const chat = document.getElementById('aiMsgsWrap');
    if (!chat) return;
    const parent = chat.parentElement;
    if (!parent) return;
    parent.style.position = 'relative';
    let bar = document.getElementById('aiChatScrollBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'aiChatScrollBar';
      parent.prepend(bar);
    }
    chat.addEventListener(
      'scroll',
      () => {
        const max = chat.scrollHeight - chat.clientHeight;
        const pct = max > 0 ? (chat.scrollTop / max) * 100 : 0;
        bar.style.width = pct + '%';
      },
      { passive: true }
    );
  }

  function staggerItems(items, baseDelay = 0) {
    if (prefersReduced()) {
      items.forEach((el) => el.classList.add('visible'));
      return;
    }
    items.forEach((el, i) => {
      el.classList.remove('visible');
      setTimeout(() => el.classList.add('visible'), baseDelay + i * 35);
    });
  }

  function initStarField(containerEl) {
    if (!containerEl || prefersReduced()) return;
    if (containerEl.dataset.fluxStarsInit === '1') return;
    containerEl.dataset.fluxStarsInit = '1';
    containerEl.style.position = containerEl.style.position || 'relative';
    for (let i = 0; i < 20; i++) {
      const star = document.createElement('div');
      const size = Math.random() * 2 + 1;
      const dur = Math.random() * 3 + 2;
      const del = Math.random() * 4;
      star.style.cssText = `position:absolute;width:${size}px;height:${size}px;border-radius:50%;background:rgba(255,255,255,${Math.random() * 0.4 + 0.1});left:${Math.random() * 100}%;top:${Math.random() * 100}%;pointer-events:none;z-index:0;animation:star-twinkle ${dur}s ease-in-out ${del}s infinite alternate`;
      containerEl.appendChild(star);
    }
  }

  function injectTaskShootingStars() {
    if (prefersReduced()) return;
    const el = document.getElementById('taskList');
    if (!el) return;
    const empty = el.querySelector('.empty');
    if (!empty) return;
    if (empty.querySelector('.shooting-star-host')) return;
    const host = document.createElement('div');
    host.className = 'shooting-star-host';
    for (let i = 0; i < 4; i++) {
      const s = document.createElement('div');
      s.className = 'shooting-star';
      s.style.left = 20 + Math.random() * 60 + '%';
      s.style.top = 10 + Math.random() * 40 + '%';
      s.style.animationDelay = i * 0.9 + 's';
      host.appendChild(s);
    }
    empty.style.position = 'relative';
    empty.appendChild(host);
  }

  function updateTimerRingGlow(progressPercent) {
    const ring = document.getElementById('timerRing');
    if (!ring) return;
    const p = Number(progressPercent);
    const intensity = p < 20 ? 1 - p / 20 : 0;
    ring.style.filter = intensity > 0 ? `drop-shadow(0 0 ${8 * intensity}px rgba(255,77,109,${0.55 * intensity}))` : '';
    if (p < 20) {
      ring.style.stroke = `rgb(${Math.round(255 * (1 - p / 20))},${Math.round(77 + 140 * (p / 20))},109)`;
    } else {
      ring.style.stroke = '';
    }
  }

  function spawnAchievementConfetti(sourceEl) {
    if (prefersReduced()) return;
    const colors = ['var(--accent)', 'var(--gold)', 'var(--green)', '#a78bfa', '#ff6b6b'];
    const rect = sourceEl?.getBoundingClientRect() || {
      left: window.innerWidth / 2,
      top: window.innerHeight / 2,
      width: 0,
      height: 0,
    };
    for (let i = 0; i < 30; i++) {
      const piece = document.createElement('div');
      const size = Math.random() * 8 + 4;
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const vx = (Math.random() - 0.5) * 300;
      const vy = -(Math.random() * 200 + 100);
      const rot = Math.random() * 720 - 360;
      piece.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:${size}px;height:${size}px;background:${colors[Math.floor(Math.random() * colors.length)]};border-radius:${Math.random() > 0.5 ? '50%' : '2px'};pointer-events:none;z-index:9999;--vx:${vx}px;--vy:${vy}px;--rot:${rot}deg;animation:confetti-fall ${Math.random() + 0.8}s ease forwards ${Math.random() * 0.3}s`;
      piece.style.willChange = 'transform, opacity';
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), 1500);
    }
  }

  function animateNavIndicator(targetTabEl) {
    if (!targetTabEl || prefersReduced()) return;
    let indicator = document.getElementById('fluxBnavIndicator');
    const nav = document.querySelector('.bottom-nav');
    if (!nav) return;
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'fluxBnavIndicator';
      indicator.style.cssText =
        'position:absolute;bottom:10px;height:3px;border-radius:3px;background:var(--accent);transition:left 0.3s cubic-bezier(0.34,1.56,0.64,1),width 0.3s cubic-bezier(0.34,1.56,0.64,1);pointer-events:none;z-index:2';
      if (getComputedStyle(nav).position === 'static') nav.style.position = 'relative';
      nav.appendChild(indicator);
    }
    const navRect = nav.getBoundingClientRect();
    const tabRect = targetTabEl.getBoundingClientRect();
    indicator.style.left = tabRect.left - navRect.left + tabRect.width * 0.25 + 'px';
    indicator.style.width = tabRect.width * 0.5 + 'px';
  }

  function hexToUri(hex) {
    const h = (hex || '').replace('#', '');
    return '%23' + h;
  }

  function updateNavSquiggle(accentHex) {
    const hex = accentHex || getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00bfff';
    const uri = hexToUri(hex.startsWith('#') ? hex : '#' + hex);
    const style =
      `#flux-main .nav-item.active .nav-label::after{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 6'%3E%3Cpath d='M0,3 Q12.5,0 25,3 Q37.5,6 50,3 Q62.5,0 75,3 Q87.5,6 100,3' fill='none' stroke='${uri}' stroke-width='2'/%3E%3C/svg%3E") !important;}`;
    let tag = document.getElementById('flux-nav-squiggle-style');
    if (!tag) {
      tag = document.createElement('style');
      tag.id = 'flux-nav-squiggle-style';
      document.head.appendChild(tag);
    }
    tag.textContent = style;
  }

  function decorateHeadings() {
    const topTitle = document.getElementById('topbarTitle');
    if (topTitle) topTitle.classList.remove('shimmer-text');
    document.querySelectorAll('.flux-page > header h2, .flux-page h2').forEach((el) => {
      el.classList.add('shimmer-text');
    });
    document.querySelectorAll('.ai-title, .sidebar-logo').forEach((el) => el.classList.add('gradient-animate'));
  }

  // ── Liquid glass SVG filter (injected once) ──────────────────────
  function initLiquidGlass() {
    if (document.querySelector('svg.glass-distortion-svg')) return;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'glass-distortion-svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `
      <defs>
        <filter id="glass-distortion" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.65 0.65" numOctaves="1" seed="12" result="noise"/>
          <feColorMatrix in="noise" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 15 -6" result="sharpNoise"/>
          <feComposite in="SourceGraphic" in2="sharpNoise" operator="in"/>
        </filter>
        <filter id="glass-refraction">
          <feTurbulence type="fractalNoise" baseFrequency="0.015 0.01" numOctaves="3" seed="5" result="turbulence"/>
          <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="4" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
      </defs>`;
    document.body.prepend(svg);
  }

  // ── Animated global mesh canvas ──────────────────────────────────
  // Lives at z-index:0 behind the app shell. Pauses when the tab is hidden
  // and respects prefers-reduced-motion (skip entirely in that case).
  function initGlobalMesh() {
    if (prefersReduced()) return;
    if (document.getElementById('fluxMeshCanvas')) return;

    const canvas = document.createElement('canvas');
    canvas.id = 'fluxMeshCanvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;opacity:1';
    document.body.prepend(canvas);

    const ctx = canvas.getContext('2d', { alpha: false });
    let W = (canvas.width = window.innerWidth);
    let H = (canvas.height = window.innerHeight);
    let t = 0;

    function getAccent() {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      return v || '#00bfff';
    }

    function hexToRgb(hex) {
      let h = String(hex || '').trim();
      if (h.startsWith('#')) h = h.slice(1);
      if (h.length === 3) {
        h = h.split('').map((c) => c + c).join('');
      }
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      return [Number.isFinite(r) ? r : 0, Number.isFinite(g) ? g : 191, Number.isFinite(b) ? b : 255];
    }

    class MeshNode {
      constructor(x, y, radius, color, speed, phase) {
        this.baseX = x;
        this.baseY = y;
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.speed = speed;
        this.phase = phase;
        this.amplitude = Math.random() * 200 + 100;
      }
      update(time) {
        this.x = this.baseX + Math.sin(time * this.speed + this.phase) * this.amplitude;
        this.y = this.baseY + Math.cos(time * this.speed * 0.7 + this.phase * 1.3) * this.amplitude * 0.6;
      }
      draw(c) {
        const [r, g, b] = this.color;
        const grad = c.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
        grad.addColorStop(0, `rgba(${r},${g},${b},0.08)`);
        grad.addColorStop(0.4, `rgba(${r},${g},${b},0.04)`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        c.fillStyle = grad;
        c.beginPath();
        c.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        c.fill();
      }
    }

    let nodes = [];

    function createNodes() {
      const accent = hexToRgb(getAccent());
      const purple = [124, 92, 255];
      nodes = [
        new MeshNode(W * 0.2, H * 0.2, W * 0.5, accent, 0.0008, 0),
        new MeshNode(W * 0.8, H * 0.8, W * 0.5, purple, 0.0007, 1.5),
        new MeshNode(W * 0.5, H * 0.5, W * 0.4, accent, 0.0009, 3.0),
        new MeshNode(W * 0.1, H * 0.7, W * 0.4, accent, 0.0006, 0.8),
        new MeshNode(W * 0.9, H * 0.3, W * 0.45, purple, 0.0008, 2.2),
        new MeshNode(W * 0.6, H * 0.1, W * 0.35, purple, 0.0010, 4.0),
        new MeshNode(W * 0.3, H * 0.9, W * 0.35, accent, 0.0007, 1.0),
      ];
    }

    function draw() {
      ctx.fillStyle = 'rgb(7, 8, 15)';
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < nodes.length; i++) {
        nodes[i].update(t);
        nodes[i].draw(ctx);
      }
      // Subtle horizontal noise drift
      ctx.save();
      ctx.globalAlpha = 0.015;
      const [r, g, b] = hexToRgb(getAccent());
      for (let i = 0; i < 5; i++) {
        const y = ((H * i * 0.25) + t * 20) % (H * 1.5) - H * 0.25;
        const grad = ctx.createLinearGradient(0, y, W, y + 100);
        grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
        grad.addColorStop(0.5, `rgba(${r},${g},${b},0.5)`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, y, W, 1);
      }
      ctx.restore();
      t += 0.4;
    }

    let raf = 0;
    let running = true;
    function loop() {
      if (!running) return;
      draw();
      raf = requestAnimationFrame(loop);
    }

    createNodes();
    loop();

    function onResize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      createNodes();
    }
    window.addEventListener('resize', onResize);

    // Pause when the tab is hidden so we don't burn CPU
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        loop();
      }
    });

    // Recreate when accent color changes
    document.addEventListener('flux-accent-change', createNodes);

    window._fluxMeshStop = () => {
      running = false;
      cancelAnimationFrame(raf);
      canvas.remove();
      window.removeEventListener('resize', onResize);
    };
  }

  function initFluxVisual() {
    initLiquidGlass();
    initGlobalMesh();
    decorateHeadings();
    initCursorSpotlight();
    initRippleEffect();
    init3DTiltCards();
    initMagneticButtons();
    initDirectionAwareHover();
    initCardSpotlight();
    initTextRevealOnScroll();
    initParallax();
    initSidebarResize();
    initChatScrollProgress();

    document.getElementById('quickAddSubmit')?.classList.add('flux-fab-glow');

    document.addEventListener(
      'flux-nav',
      (e) => {
        if (e.detail?.panel === 'notes') {
          setTimeout(() => initStarField(document.getElementById('notes')), 120);
        }
        if (e.detail?.panel === 'dashboard' && typeof window.renderStats === 'function') {
          setTimeout(() => {
            document.querySelectorAll('#dashboard .stat .num, #dashMobStats .dash-mob-stat-num').forEach((el) => {
              const t = el.textContent;
              countUp(el, parseInt(t, 10) || 0, 700);
            });
          }, 80);
        }
      },
      false
    );

    const taskObserver = new MutationObserver(() => {
      injectTaskShootingStars();
      const items = [...document.querySelectorAll('.task-item:not([data-flux-visual-init])')];
      items.forEach((el) => {
        el.dataset.fluxVisualInit = '1';
        el.classList.add('stagger-item');
      });
      if (items.length) staggerItems(items, 40);
    });
    const taskList = document.getElementById('taskList');
    if (taskList) taskObserver.observe(taskList, { childList: true, subtree: false });
    injectTaskShootingStars();

    updateNavSquiggle(localStorage.getItem('flux_accent') || undefined);
  }

  window.FluxVisual = {
    scrambleNumber,
    countUp,
    encryptedReveal,
    staggerItems,
    initStarField,
    updateTimerRingGlow,
    spawnAchievementConfetti,
    animateNavIndicator,
    updateNavSquiggle,
    initFluxVisual,
    initLiquidGlass,
    initGlobalMesh,
  };

  if (document.readyState === 'complete') {
    setTimeout(initFluxVisual, 0);
  } else {
    window.addEventListener('load', () => setTimeout(initFluxVisual, 0));
  }
})();
