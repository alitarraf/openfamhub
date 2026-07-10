<script>
  import AvatarChip from './AvatarChip.svelte';
  import Icon from './Icon.svelte';
  import { burst } from '../celebrate.js';
  // Tinted per-member card. Sets --person scope so children inherit theming.
  // segments: [{ icon, active }]  — time-of-day routine segments.
  let {
    id = '',
    name,
    color = 'var(--p-sky)',
    tint = 'var(--person-tint)',
    tintBorder = 'var(--person-tint-border)',
    monogram = '',
    points = null,
    completion = 0,
    segments = [],
    footer = '',
    // Monotonically-increasing token (see TasksChoreScreen): each increment
    // triggers one celebration — avatar pop + star tick + confetti from the
    // avatar. Left at 0 for non-celebrating cards.
    celebrate = 0,
    children
  } = $props();

  // Two-beat celebration whenever the celebrate token increments (never on the
  // initial 0-value mount): BEAT 1 is the avatar pop + confetti from the avatar
  // centre; BEAT 2 (once the avatar has held at peak and settled, ~2.5s later)
  // is the star reward — a "+N" flies up off the star, the star drops in with a
  // bounce, and the running total odometer-rolls old→new. CSS animations are
  // retriggered by toggling their class off then on across a frame.
  let avatarEl;
  let cardEl; // for measuring the full-card-height travel of the +N
  let starEl; // the +N climbs up and lands here
  let pop = $state(false);
  let ticking = $state(false); // number pop + gold flash (on landing)
  let starDrop = $state(false); // star receive-bounce (on landing)
  let flyStar = $state(false); // a big star that flies up the card into the counter
  let flyRise = $state(0); // px the star travels up (counter star centre → card bottom)
  // Shown total — held at the OLD value through beat 1 so it visibly ticks up to
  // the new total at the reward beat, rather than changing the instant the tap
  // registers (the points prop updates immediately; this lags it on purpose).
  let displayPoints = $state(points);
  let prevCelebrate = 0;
  let lastPoints = points; // previous total, so beat 2 knows the delta
  let celebrating = false; // guard: don't reveal the new total early, mid-beat
  $effect(() => {
    const c = celebrate;
    const p = points;
    if (c > prevCelebrate) {
      prevCelebrate = c;
      const from = lastPoints;
      lastPoints = p;
      celebrating = true;
      fire(from, p);
    } else {
      // Points changed without a celebration (e.g. a data refresh) — sync the
      // shown total, unless a celebration is mid-flight (don't spoil the reveal).
      prevCelebrate = c;
      lastPoints = p;
      if (!celebrating) displayPoints = p;
    }
  });
  function fire(fromPts, toPts) {
    // BEAT 1 — avatar pop + confetti.
    pop = false;
    requestAnimationFrame(() => {
      pop = true;
    });
    // Matches the ~2.7s avatar-pop (pop up → ~2s hold → settle); keep the class on
    // for the whole run so the hold isn't cut short.
    setTimeout(() => {
      pop = false;
    }, 2750);
    if (avatarEl) {
      const r = avatarEl.getBoundingClientRect();
      // Canvas needs concrete colours (CSS vars don't resolve on ctx.fillStyle):
      // the member's own colour if it's a hex, plus a festive spread + gold.
      const cols = [color, '#F6C445', '#FF6B6B', '#4ECDC4', '#B197FC', '#FFFFFF'].filter(
        (x) => typeof x === 'string' && x.startsWith('#')
      );
      // +100 keeps the confetti under the avatar's shifted (translateX) hold spot.
      const x = r.left + r.width / 2 + 100;
      const y = r.top + r.height / 2;
      burst({ x, y, colors: cols });
      // A second burst mid-hold so confetti keeps flying for the full ~2s peak.
      setTimeout(() => burst({ x, y, colors: cols }), 650);
    }
    // BEAT 2 — the star reward, once the avatar is on its way back down.
    setTimeout(() => starBeat(fromPts, toPts), 2500);
  }
  function starBeat(fromPts, toPts) {
    const delta = toPts - fromPts;
    // Measure the climb: from the star's centre down to the card's bottom edge,
    // so the +N launches from the bottom of the card and lands on the star.
    if (cardEl && starEl) {
      const cr = cardEl.getBoundingClientRect();
      const sr = starEl.getBoundingClientRect();
      flyRise = Math.max(160, cr.bottom - (sr.top + sr.height / 2) - 8);
    } else {
      flyRise = 500;
    }
    if (delta > 0) flyStar = true; // launch the big star from the bottom of the card
    // It climbs for ~1.25s; when it lands, the counter star bounces and the total
    // ticks up.
    setTimeout(() => {
      displayPoints = toPts;
      starDrop = true;
      ticking = true;
    }, 1250);
    setTimeout(() => {
      flyStar = false; // climb finished
    }, 1450);
    setTimeout(() => {
      starDrop = false;
      ticking = false;
      celebrating = false;
    }, 2000);
  }
</script>

<div
  class="person-scope card"
  bind:this={cardEl}
  style="--person:{color}; --person-tint:{tint}; --person-tint-border:{tintBorder}; background:{tint}; border-color:{tintBorder};"
>
  <div class="head">
    <div class="avatar" class:pop bind:this={avatarEl}>
      <AvatarChip {id} {name} {color} {monogram} size={74} showName={false} progress={completion} />
    </div>
    <div class="meta">
      <div class="name">{name}</div>
      {#if points != null}
        <div class="pts">
          <span class="star" class:drop={starDrop} bind:this={starEl}>
            <Icon name="star" size={20} fill color="var(--gold)" />
          </span>
          <span class="ptsnum" class:ticking>{displayPoints}</span>
          {#if flyStar}
            <span class="fly-star" style="--rise:{flyRise}px">
              <Icon name="star" size={56} fill color="var(--gold)" />
            </span>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  {#if segments.length}
    <div class="segs">
      {#each segments as seg}
        <span class="seg" class:active={seg.active}>
          <Icon name={seg.icon} size={22} fill={seg.active} color={seg.active ? '#fff' : color} />
        </span>
      {/each}
    </div>
  {/if}

  {#if children}
    <div class="body">{@render children()}</div>
  {/if}

  {#if footer}
    <div class="footer">{footer}</div>
  {/if}
</div>

<style>
  .card {
    border: 1px solid var(--person-tint-border);
    border-radius: var(--r-lg);
    padding: 20px;
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .avatar {
    display: inline-flex;
    transform-origin: center;
    position: relative;
  }
  .avatar.pop {
    /* Ride above sibling cards while it balloons so the big scale isn't clipped,
       and let taps fall through the giant avatar to the board during the hold. */
    z-index: 20;
    pointer-events: none;
    animation: avatar-pop 2700ms var(--ease);
  }
  /* Pop up (~350ms), HOLD at peak for ~2s so the confetti is on show, then settle
     back down. translateX nudges the ballooned avatar ~1in to the right so a
     left-column kid doesn't get clipped off the screen edge; right-column kids
     have the room to spare. */
  @keyframes avatar-pop {
    0% {
      transform: translateX(0) scale(1) rotate(0);
    }
    6% {
      transform: translateX(100px) scale(3.5) rotate(-6deg);
    }
    9% {
      transform: translateX(100px) scale(3.3) rotate(3deg);
    }
    13% {
      transform: translateX(100px) scale(3.4) rotate(0);
    }
    87% {
      transform: translateX(100px) scale(3.4) rotate(0);
    }
    100% {
      transform: translateX(0) scale(1) rotate(0);
    }
  }
  .meta {
    flex: 1;
  }
  .name {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 24px;
    color: var(--ink);
  }
  .pts {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-top: 2px;
    position: relative; /* anchor the floating +N badge */
  }
  .star {
    display: inline-flex;
    transform-origin: center bottom;
  }
  /* Landing: the star gets "hit" by the incoming +N — a punchy squash-and-settle. */
  .star.drop {
    animation: star-drop 720ms var(--ease);
  }
  @keyframes star-drop {
    0% {
      transform: scale(1) rotate(0);
    }
    28% {
      transform: scale(1.8) rotate(-9deg);
    }
    52% {
      transform: scale(0.86) rotate(5deg);
    }
    74% {
      transform: scale(1.2) rotate(-2deg);
    }
    100% {
      transform: scale(1) rotate(0);
    }
  }
  .ptsnum {
    font-weight: 700;
    font-size: 20px;
    color: var(--gold-ink);
    display: inline-block;
    transform-origin: center;
  }
  .ptsnum.ticking {
    animation: pts-pop 640ms var(--ease);
  }
  @keyframes pts-pop {
    0% {
      transform: scale(1);
    }
    35% {
      transform: scale(1.55);
      color: var(--gold);
    }
    100% {
      transform: scale(1);
    }
  }
  /* A big gold star launches from the bottom of the card and climbs into the
     counter star, which then bounces as the total ticks up. Every chore is worth
     one star, so the traveller is a star, not a number. --rise (px, set inline) is
     the counter-star-centre → card-bottom distance measured at fire time; anchored
     on the counter star and centred on itself via translate(-50%). */
  .fly-star {
    position: absolute;
    left: 10px;
    top: 50%;
    display: inline-flex;
    transform-origin: center;
    pointer-events: none;
    z-index: 25;
    animation: star-rise 1450ms var(--ease) forwards;
  }
  @keyframes star-rise {
    0% {
      transform: translate(-50%, var(--rise)) scale(2.4);
      opacity: 0;
    }
    12% {
      transform: translate(-50%, var(--rise)) scale(3);
      opacity: 1;
    }
    72% {
      transform: translate(-50%, calc(var(--rise) * 0.22)) scale(2.9);
      opacity: 1;
    }
    90% {
      transform: translate(-50%, 0) scale(1.25);
      opacity: 1;
    }
    100% {
      transform: translate(-50%, -4px) scale(0.5);
      opacity: 0;
    }
  }
  .segs {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }
  .seg {
    flex: 1;
    height: 42px;
    border-radius: 12px;
    background: #fff;
    border: 1px solid var(--person-tint-border);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .seg.active {
    background: var(--person);
    border-color: var(--person);
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 16px;
    flex: 1;
  }
  .footer {
    margin-top: auto;
    padding-top: 16px;
    text-align: center;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--person) 65%, var(--ink-soft));
  }
</style>
