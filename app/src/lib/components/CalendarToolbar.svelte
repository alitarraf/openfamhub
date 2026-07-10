<script>
  import Icon from './Icon.svelte';
  import { sameDay } from '../calendar.js';
  // Persistent calendar toolbar. Prev/next arrows flank the Day/Week/Month
  // segmented control and step the *current* view's period (day/week/month).
  // Each view renders its own date header, so the toolbar shows no position
  // label — only a "Today" jump that appears once you've navigated away.
  let { view = 'week', anchor = new Date(), onView, onPrev, onNext, onToday } = $props();
  const opts = [
    ['day', 'Day'],
    ['week', 'Week'],
    ['month', 'Month']
  ];
  let offToday = $derived(!sameDay(anchor, new Date()));
</script>

<div class="toolbar">
  <div class="nav">
    <button class="tbtn" onclick={() => onPrev?.()} aria-label="Previous"
      ><Icon name="chevron_left" size={30} color="var(--ink-soft)" /></button
    >
    <div class="seg">
      {#each opts as [id, label]}
        <button class="segbtn" class:on={view === id} onclick={() => onView?.(id)}>{label}</button>
      {/each}
    </div>
    <button class="tbtn" onclick={() => onNext?.()} aria-label="Next"
      ><Icon name="chevron_right" size={30} color="var(--ink-soft)" /></button
    >
  </div>
  <div class="right">
    {#if offToday}
      <button class="ttoday" onclick={() => onToday?.()}>Today</button>
    {/if}
  </div>
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--surface);
    border-radius: 24px;
    box-shadow: var(--shadow);
    padding: 14px 22px;
  }
  .nav {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .right {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .tbtn {
    width: 56px;
    height: 56px;
    border: none;
    border-radius: 999px;
    background: var(--bg);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .ttoday {
    font-family: var(--font-body);
    font-size: 22px;
    font-weight: 600;
    color: var(--ink);
    background: var(--bg);
    border: none;
    cursor: pointer;
    padding: 12px 22px;
    border-radius: 999px;
  }
  .ttoday:active {
    box-shadow: var(--shadow-press);
  }
  .seg {
    display: flex;
    gap: 6px;
    background: var(--bg);
    border-radius: 999px;
    padding: 6px;
  }
  .segbtn {
    border: none;
    background: transparent;
    padding: 10px 22px;
    border-radius: 999px;
    font-size: 18px;
    font-weight: 600;
    color: var(--ink-faint);
    cursor: pointer;
  }
  .segbtn.on {
    font-weight: 700;
    color: var(--ink);
    background: var(--surface);
    box-shadow: var(--shadow-press);
  }
</style>
