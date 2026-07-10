<script>
  // The signature: oversized friendly numerals in warm gold over a confetti wash.
  // Calendar headers + screensaver only — never on app cards.
  let { weekday = '', title = '', value = '', time = '', size = 128 } = $props();
</script>

<div class="banner">
  <div class="left">
    {#if weekday}<div class="sub">{weekday}</div>{/if}
    {#if title}<div class="big" style="font-size:{size}px;">{title}</div>{/if}
  </div>
  {#if value || time}
    <div class="right">
      {#if value}<div class="big" style="font-size:{size}px;">{value}</div>{/if}
      {#if time}<div class="sub">{time}</div>{/if}
    </div>
  {/if}
</div>

<style>
  .banner {
    position: relative;
    overflow: hidden;
    border-radius: var(--r-lg);
    background: #fbf6ea;
    background-image:
      radial-gradient(circle at 12% 24%, #e7c97a 0 7px, transparent 8px),
      radial-gradient(circle at 86% 18%, #9cc9d8 0 6px, transparent 7px),
      radial-gradient(circle at 74% 70%, #e59fb6 0 6px, transparent 7px),
      radial-gradient(circle at 22% 78%, #a7d6b8 0 5px, transparent 6px),
      radial-gradient(circle at 50% 30%, #e7c97a 0 4px, transparent 5px),
      radial-gradient(circle at 94% 56%, #c8b6e6 0 5px, transparent 6px),
      radial-gradient(circle at 5% 54%, #e59fb6 0 4px, transparent 5px);
    padding: 36px 48px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
  }
  .right {
    text-align: right;
  }
  .sub {
    font-family: var(--font-display);
    font-weight: 500;
    font-size: 26px;
    color: var(--gold-ink);
    letter-spacing: 0.04em;
  }
  .big {
    font-family: var(--font-display);
    font-weight: 600;
    line-height: 0.92;
    color: var(--gold);
  }
</style>
