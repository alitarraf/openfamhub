<script>
  import Icon from './Icon.svelte';
  // A single task / chore / routine / to-do row. Tap toggles completion.
  let {
    title,
    points = null,
    icon = 'task_alt',
    iconColor = 'var(--person)',
    iconBg = 'var(--person-tint)',
    done = false,
    error = false,
    onToggle
  } = $props();
</script>

<div
  class="row"
  class:done
  class:error
  role="button"
  tabindex="0"
  onclick={() => onToggle?.()}
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle?.();
    }
  }}
>
  <span class="ic" style="background:{done ? 'var(--hairline-2)' : iconBg};">
    <Icon name={icon} size={22} color={done ? 'var(--ink-faint)' : iconColor} />
  </span>
  <span class="title">{title}</span>
  {#if points != null}
    <span class="pts">
      <Icon name="star" size={18} fill color="var(--gold)" />
      <span class="ptsnum">{points}</span>
    </span>
  {/if}
  <span class="check">
    {#if error}<Icon name="priority_high" size={22} fill color="#fff" />
    {:else if done}<Icon name="check" size={22} fill color="#fff" />{/if}
  </span>
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: 14px;
    background: var(--surface);
    border: 1px solid var(--hairline);
    border-radius: var(--r-md);
    padding: 14px 16px;
    min-height: var(--hit);
    cursor: pointer;
    transition: background var(--dur-fast) var(--ease);
  }
  .row:active {
    background: var(--surface-2);
  }
  .ic {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
  }
  .title {
    flex: 1;
    font-size: 18px;
    font-weight: 600;
    color: var(--ink);
  }
  .done .title {
    color: var(--ink-faint);
    text-decoration: line-through;
  }
  .pts {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--gold-soft);
    border-radius: 999px;
    padding: 5px 12px;
  }
  .done .pts {
    background: var(--bg);
  }
  .ptsnum {
    font-weight: 700;
    font-size: 15px;
    color: var(--gold-ink);
  }
  .check {
    width: 34px;
    height: 34px;
    border-radius: 999px;
    border: 2.5px solid #d6dce5;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .done .check {
    background: var(--good);
    border-color: var(--good);
  }
  /* The save didn't land (network/DNS blip) and the toggle was reverted — flag
     it briefly so the tap isn't a silent no-op. Set transiently by the screen. */
  .error {
    border-color: var(--bad);
    background: var(--bad-tint, #fbeae6);
    animation: nudge var(--dur-fast, 0.15s) var(--ease, ease) 2;
  }
  .error .check {
    background: var(--bad);
    border-color: var(--bad);
  }
  @keyframes nudge {
    0%,
    100% {
      transform: translateX(0);
    }
    25% {
      transform: translateX(-4px);
    }
    75% {
      transform: translateX(4px);
    }
  }
</style>
