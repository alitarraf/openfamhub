<script>
  import Icon from './Icon.svelte';
  import { WX, wxLabel } from '../weather.js';
  // Current temp + Hi/Lo. Used in the dashboard AppBar and the Day-view header.
  // `scale` ~0.6 for the companion PWA (sizes here are tuned for the 1080 wall).
  let { wx = 'sunny', temp, hi, lo, place = '', scale = 1 } = $props();
  let c = $derived(WX[wx] ?? WX.sunny);
</script>

<div class="wt" style="--s:{scale};">
  <div class="row">
    <Icon name={c.icon} size={Math.round(54 * scale)} fill color={c.color} />
    <span class="temp">{temp}°</span>
  </div>
  <div class="hilo">
    <span class="hi">H {hi}°</span>
    <span class="lo">L {lo}°</span>
  </div>
  <!-- Always render the place line (blank → &nbsp;) so the card reserves the
       same height with or without a place — the parent shows it only once real
       weather has loaded, and a missing place line would shift the layout. -->
  <div class="place">
    {#if place}{place} · {wxLabel(wx)}{:else}&nbsp;{/if}
  </div>
</div>

<style>
  .wt {
    text-align: right;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    justify-content: flex-end;
  }
  .temp {
    font-family: var(--font-display);
    font-size: calc(52px * var(--s));
    color: var(--ink);
  }
  .hilo {
    display: flex;
    gap: 14px;
    justify-content: flex-end;
    margin-top: 4px;
    font-family: var(--font-display);
    font-size: calc(24px * var(--s));
  }
  .hi {
    color: var(--ink);
  }
  .lo {
    color: var(--ink-faint);
  }
  .place {
    font-size: calc(22px * var(--s));
    color: var(--ink-soft);
    margin-top: 2px;
  }
</style>
