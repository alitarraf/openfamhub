<script>
  import Icon from './Icon.svelte';
  import { WX } from '../weather.js';
  // 7-day strip. days: [{ day:'WED', wx, hi, lo, today }]. Today highlighted gold.
  let { days = [] } = $props();
</script>

<div class="ww">
  {#each days as d}
    <div class="day" class:today={d.today}>
      <span class="dow">{d.day}</span>
      {#if d.noData}
        <span class="nodata">No forecast</span>
      {:else}
        {@const c = WX[d.wx] ?? WX.sunny}
        <Icon name={c.icon} size={46} fill color={c.color} />
        <span class="hi">{d.hi}°</span>
        <span class="lo">{d.lo}°</span>
      {/if}
    </div>
  {/each}
</div>

<style>
  .ww {
    background: var(--surface);
    border-radius: var(--r-xl);
    box-shadow: var(--shadow);
    padding: 18px 22px;
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 8px;
  }
  .day {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 14px 4px;
    border-radius: 18px;
    border: 1px solid transparent;
  }
  .day.today {
    background: var(--gold-soft);
    border-color: #f0e0b4;
  }
  .dow {
    font-size: 18px;
    font-weight: 700;
    color: var(--ink-faint);
  }
  .day.today .dow {
    color: var(--gold-ink);
  }
  .hi {
    font-family: var(--font-display);
    font-size: 28px;
    color: var(--ink);
  }
  .lo {
    font-family: var(--font-display);
    font-size: 22px;
    color: var(--ink-faint);
  }
  .nodata {
    font-size: 13px;
    color: var(--ink-faint);
    text-align: center;
    margin-top: 18px;
  }
</style>
