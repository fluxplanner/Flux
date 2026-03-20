/* ── FLUX PLANNER · splash.js ── */
window.runSplash = function(callback) {
  const splash = document.getElementById('splash');
  if (!splash) { callback(); return; }

  // Fix purple status bar — force black
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute('content', '#0c0d12');

  splash.style.cssText = 'position:fixed;inset:0;background:#0c0d12;z-index:9999;overflow:hidden;display:block';

  splash.innerHTML = `
    <canvas id="splashCanvas" style="position:absolute;inset:0;width:100%;height:100%"></canvas>

    <!-- Centered logo block -->
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;gap:0">

      <!-- Letter burst ring -->
      <div id="splRing" style="position:absolute;width:220px;height:220px;border-radius:50%;border:1px solid rgba(99,102,241,0);opacity:0;transform:scale(0.3);transition:opacity .4s ease,transform .8s cubic-bezier(.16,1,.3,1),border-color .4s ease"></div>

      <!-- FLUX — big centered -->
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
        <div style="position:relative;display:flex;align-items:center;gap:0">
          <span id="splF"  style="font-family:'Plus Jakarta Sans',sans-serif;font-size:clamp(4rem,14vw,6.5rem);font-weight:800;letter-spacing:-4px;background:linear-gradient(135deg,#6366f1 0%,#a78bfa 50%,#10d9a0 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;opacity:0;transform:translateY(60px) scale(.5) rotate(-8deg);transition:opacity .5s cubic-bezier(.16,1,.3,1),transform .7s cubic-bezier(.16,1,.3,1)">F</span>
          <span id="splL"  style="font-family:'Plus Jakarta Sans',sans-serif;font-size:clamp(4rem,14vw,6.5rem);font-weight:800;letter-spacing:-4px;color:#eef0f7;-webkit-text-fill-color:#eef0f7;opacity:0;transform:translateY(60px) scale(.5) rotate(-6deg);transition:opacity .5s cubic-bezier(.16,1,.3,1) .07s,transform .7s cubic-bezier(.16,1,.3,1) .07s">l</span>
          <span id="splU"  style="font-family:'Plus Jakarta Sans',sans-serif;font-size:clamp(4rem,14vw,6.5rem);font-weight:800;letter-spacing:-4px;color:#eef0f7;-webkit-text-fill-color:#eef0f7;opacity:0;transform:translateY(60px) scale(.5) rotate(-4deg);transition:opacity .5s cubic-bezier(.16,1,.3,1) .13s,transform .7s cubic-bezier(.16,1,.3,1) .13s">u</span>
          <span id="splX"  style="font-family:'Plus Jakarta Sans',sans-serif;font-size:clamp(4rem,14vw,6.5rem);font-weight:800;letter-spacing:-4px;background:linear-gradient(135deg,#a78bfa,#10d9a0);-webkit-background-clip:text;-webkit-text-fill-color:transparent;opacity:0;transform:translateY(60px) scale(.5) rotate(-2deg);transition:opacity .5s cubic-bezier(.16,1,.3,1) .19s,transform .7s cubic-bezier(.16,1,.3,1) .19s">x</span>
        </div>

        <!-- PLANNER — centered below FLUX -->
        <div id="splPl" style="font-family:'JetBrains Mono',monospace;font-size:clamp(.7rem,2.5vw,.95rem);font-weight:500;color:#5a6080;letter-spacing:6px;text-transform:uppercase;opacity:0;transform:translateY(16px) scaleX(.6);transition:opacity .6s ease .55s,transform .6s cubic-bezier(.16,1,.3,1) .55s">PLANNER</div>
      </div>

      <!-- Tagline -->
      <div id="splSub" style="font-family:'JetBrains Mono',monospace;font-size:.62rem;letter-spacing:4px;color:#2a3050;text-transform:uppercase;margin-top:24px;opacity:0;transition:opacity .5s ease 1.05s">YOUR SMART SCHOOL PLANNER</div>

      <!-- Loading dots -->
      <div id="splDots" style="display:flex;gap:8px;margin-top:36px;opacity:0;transition:opacity .4s ease 1.2s">
        <div style="width:6px;height:6px;border-radius:50%;background:#6366f1;animation:spB 1.3s ease-in-out infinite"></div>
        <div style="width:6px;height:6px;border-radius:50%;background:#a78bfa;animation:spB 1.3s ease-in-out .22s infinite"></div>
        <div style="width:6px;height:6px;border-radius:50%;background:#10d9a0;animation:spB 1.3s ease-in-out .44s infinite"></div>
      </div>
    </div>

    <style>
      @keyframes spB {
        0%,60%,100% { transform:translateY(0);opacity:.3 }
        30% { transform:translateY(-10px);opacity:1 }
      }
      @keyframes ripple {
        0%   { transform:scale(0.5);opacity:0.7 }
        100% { transform:scale(2.2);opacity:0 }
      }
      @keyframes orbit {
        from { transform:rotate(0deg) translateX(110px) rotate(0deg) }
        to   { transform:rotate(360deg) translateX(110px) rotate(-360deg) }
      }
    </style>`;

  // ── Canvas: particles + shooting stars ──────────────────────
  const canvas = document.getElementById('splashCanvas');
  const ctx    = canvas.getContext('2d');
  let W = 0, H = 0, animId, tick = 0;

  function resize() {
    W = canvas.width  = splash.offsetWidth  || window.innerWidth;
    H = canvas.height = splash.offsetHeight || window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const COLORS = ['#6366f1','#a78bfa','#10d9a0','#3b82f6','#e879f9','#fbbf24'];

  // Floating particles
  const pts = Array.from({length: 80}, () => ({
    x: Math.random() * W, y: Math.random() * H,
    r: Math.random() * 1.8 + 0.2,
    dx: (Math.random() - .5) * .45,
    dy: (Math.random() - .5) * .45,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    a: Math.random() * .5 + .05
  }));

  // Shooting stars pool
  const stars = [];
  function spawnStar() {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H * 0.5,
      len: Math.random() * 120 + 60,
      speed: Math.random() * 6 + 4,
      angle: Math.PI / 4 + (Math.random() - .5) * .3,
      alpha: 1,
      life: 0,
      maxLife: Math.random() * 30 + 25
    });
  }

  // Ripple rings
  const ripples = [];
  function spawnRipple() {
    ripples.push({ x: W/2, y: H/2, r: 0, maxR: Math.min(W,H)*0.5, alpha: 0.25 });
  }

  function frame() {
    tick++;
    ctx.clearRect(0, 0, W, H);

    // Connection lines between nearby particles
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < 110) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(99,102,241,${(1-d/110)*.07})`;
          ctx.lineWidth = .4;
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.stroke();
        }
      }
    }

    // Draw + move particles
    pts.forEach(p => {
      p.x += p.dx; p.y += p.dy;
      if (p.x < 0 || p.x > W) p.dx *= -1;
      if (p.y < 0 || p.y > H) p.dy *= -1;
      const pulse = 0.8 + Math.sin(tick * 0.04 + p.x) * 0.2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * pulse, 0, Math.PI*2);
      ctx.fillStyle = p.color + Math.floor(p.a * 255).toString(16).padStart(2,'0');
      ctx.fill();
    });

    // Ripples
    ripples.forEach((rp, i) => {
      rp.r += 2.5;
      rp.alpha *= 0.94;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(99,102,241,${rp.alpha})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      if (rp.alpha < 0.005) ripples.splice(i, 1);
    });

    // Shooting stars
    if (tick % 55 === 0) spawnStar();
    stars.forEach((s, i) => {
      s.life++;
      const pct = s.life / s.maxLife;
      s.alpha = pct < .2 ? pct/.2 : 1 - (pct-.2)/.8;
      const ex = s.x + Math.cos(s.angle) * s.len;
      const ey = s.y + Math.sin(s.angle) * s.len;
      const grad = ctx.createLinearGradient(s.x, s.y, ex, ey);
      grad.addColorStop(0, `rgba(255,255,255,0)`);
      grad.addColorStop(1, `rgba(255,255,255,${s.alpha * .8})`);
      ctx.beginPath();
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.2;
      ctx.moveTo(s.x + Math.cos(s.angle)*s.speed*s.life, s.y + Math.sin(s.angle)*s.speed*s.life);
      ctx.lineTo(ex + Math.cos(s.angle)*s.speed*s.life, ey + Math.sin(s.angle)*s.speed*s.life);
      ctx.stroke();
      if (s.life >= s.maxLife) stars.splice(i, 1);
    });

    // Glow pulse behind logo
    const grd = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, 160);
    const glowA = (0.04 + Math.sin(tick * 0.03) * 0.02).toFixed(3);
    grd.addColorStop(0, `rgba(99,102,241,${glowA})`);
    grd.addColorStop(1, 'rgba(99,102,241,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    animId = requestAnimationFrame(frame);
  }
  animId = requestAnimationFrame(frame);

  // ── Stagger text reveals ────────────────────────────────────
  const show = (id, delay) => setTimeout(() => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.opacity = '1';
    el.style.transform = 'none';
  }, delay);

  // Spawn ripple on logo reveal
  setTimeout(() => spawnRipple(), 200);
  setTimeout(() => spawnRipple(), 500);

  show('splF',  180);
  show('splL',  250);
  show('splU',  310);
  show('splX',  370);
  show('splPl', 580);
  show('splSub', 1050);
  show('splDots', 1220);

  // Ring reveal
  setTimeout(() => {
    const ring = document.getElementById('splRing');
    if (ring) {
      ring.style.opacity = '1';
      ring.style.transform = 'scale(1)';
      ring.style.borderColor = 'rgba(99,102,241,0.15)';
    }
  }, 300);

  // ── Exit after 3s ───────────────────────────────────────────
  setTimeout(() => {
    window.removeEventListener('resize', resize);
    cancelAnimationFrame(animId);
    splash.style.transition = 'opacity .55s ease';
    splash.style.opacity = '0';
    setTimeout(() => {
      splash.style.display = 'none';
      callback();
    }, 560);
  }, 3000);
};
