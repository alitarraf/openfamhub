<script>
  import MonthGrid from '../../components/MonthGrid.svelte';
  import { buildMonth, WEEKDAYS } from '../../calendar.js';

  let { anchor = new Date(), onDayClick } = $props();
  let month = $derived(buildMonth(anchor));
</script>

<div class="view">
  <div class="banner">
    <div>
      <div class="yr">{month.year}</div>
      <div class="mo">{month.label}</div>
    </div>
  </div>

  <div class="weekrow">
    {#each WEEKDAYS as w}<div class="wd">{w}</div>{/each}
  </div>

  <div class="gridwrap">
    <MonthGrid {month} variant="full" {onDayClick} />
  </div>
</div>

<style>
  .view {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .banner {
    position: relative;
    overflow: hidden;
    border-radius: 28px;
    background: #fbf6ea;
    background-image:
      radial-gradient(circle at 10% 30%, #e7c97a 0 8px, transparent 9px),
      radial-gradient(circle at 88% 22%, #9cc9d8 0 7px, transparent 8px),
      radial-gradient(circle at 70% 74%, #e59fb6 0 7px, transparent 8px),
      radial-gradient(circle at 24% 80%, #a7d6b8 0 6px, transparent 7px),
      radial-gradient(circle at 94% 60%, #c8b6e6 0 6px, transparent 7px);
    padding: 30px 40px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .yr {
    font-family: var(--font-display);
    font-weight: 500;
    font-size: 26px;
    color: #8a6d1f;
  }
  .mo {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 96px;
    line-height: 0.9;
    color: var(--gold);
  }
  .weekrow {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 10px;
  }
  .wd {
    text-align: center;
    font-size: 20px;
    font-weight: 700;
    color: var(--ink-faint);
  }
  .gridwrap {
    flex: 1;
    min-height: 0;
  }
</style>
