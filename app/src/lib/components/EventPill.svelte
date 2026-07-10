<script>
  import EventDot from './EventDot.svelte';
  // variant "border": white pill with a 4px person-colored left border.
  // variant "tint":   person-tint fill with a leading dot.
  let { time = '', title = '', color = 'var(--person)', tint = 'var(--person-tint)', variant = 'border' } = $props();
</script>

<div
  class="pill {variant}"
  style="--c:{color}; {variant === 'tint' ? `background:${tint};` : `border-left-color:${color};`}"
>
  {#if variant === 'tint'}<EventDot {color} size={8} />{/if}
  {#if time}<span class="time">{time}</span>{/if}
  <span class="title">{title}</span>
</div>

<style>
  .pill {
    display: flex;
    align-items: center;
    gap: 10px;
    border-radius: var(--r-sm);
    padding: 9px 12px;
    background: var(--surface);
  }
  .pill.border {
    border-left: 4px solid var(--c);
  }
  .time {
    font-size: 14px;
    font-weight: 700;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }
  .title {
    font-size: 14px;
    color: var(--ink-soft);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
