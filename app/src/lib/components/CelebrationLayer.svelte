<script>
  // Single full-screen confetti canvas, mounted once in App.svelte. Listens for
  // burst({x,y,colors}) from the celebrate store and paints a short particle pop
  // from that point. pointer-events:none so it never eats a tap; z-index below
  // the 200-level sleep/screensaver/babysitter overlays. GPU-cheap on the 2011
  // APU: solid fillRect only — no shadowBlur, no per-particle gradients (the
  // "no blur" rule in canvas form). When idle the rAF loop stops and clears.
  import { onBurst } from '../celebrate.js';

  let canvas;
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  $effect(() => {
    // Under reduced motion the chime + star count still fire; we just skip the
    // particles. (Also bail if the canvas somehow isn't bound yet.)
    if (reduce || !canvas) return;
    const g = canvas.getContext('2d');
    let particles = [];
    let raf = 0;
    let running = false;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function spawn({ x, y, colors }) {
      const palette = colors && colors.length ? colors : ['#F6C445'];
      for (let i = 0; i < 64; i++) {
        const a = Math.random() * Math.PI * 2;
        const speed = 4 + Math.random() * 7;
        particles.push({
          x,
          y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed - 6, // biased upward so it fountains
          size: 6 + Math.random() * 6,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.3,
          color: palette[i % palette.length],
          life: 1
        });
      }
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    }

    function tick() {
      g.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.vy += 0.35; // gravity
        p.vx *= 0.99; // drag
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= 0.009; // slower fade so confetti lingers through the ~2s peak hold
        g.save();
        g.globalAlpha = Math.max(0, p.life);
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.fillStyle = p.color;
        g.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        g.restore();
      }
      particles = particles.filter((p) => p.life > 0 && p.y < canvas.height + 40);
      if (particles.length) {
        raf = requestAnimationFrame(tick);
      } else {
        running = false;
        g.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    const off = onBurst(spawn);
    return () => {
      off();
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  });
</script>

<canvas bind:this={canvas} class="confetti" aria-hidden="true"></canvas>

<style>
  .confetti {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    /* Above the app, below the 200-level full-screen overlays. */
    z-index: 150;
  }
</style>
