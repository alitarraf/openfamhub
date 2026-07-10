<script>
  // In-app segmented tabs for the Tasks app.
  const TABS = [
    { id: 'profile', label: 'Profile' },
    { id: 'todo', label: 'To-do' },
    { id: 'chore', label: 'Routine · Chore' },
    { id: 'reward', label: 'Reward' }
  ];
  // `trailing` is an optional snippet for a screen-specific control (e.g. the
  // Reward tab's Manage button) that renders inside this same white bar,
  // instead of as a second floating element next to it.
  let { active = 'chore', onSelect, trailing } = $props();
</script>

<div class="tabs">
  {#each TABS as t}
    <button class="tab" class:on={t.id === active} onclick={() => onSelect?.(t.id)}>{t.label}</button>
  {/each}
  {#if trailing}
    <div class="trailing">{@render trailing()}</div>
  {/if}
</div>

<style>
  .tabs {
    background: var(--surface);
    border-radius: 24px;
    box-shadow: var(--shadow);
    padding: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .tab {
    flex: 1;
    text-align: center;
    padding: 16px;
    border-radius: 18px;
    font-size: 20px;
    font-weight: 600;
    color: var(--ink-faint);
    background: transparent;
    border: none;
    cursor: pointer;
  }
  .tab.on {
    font-weight: 700;
    color: var(--gold-ink);
    background: var(--gold-soft);
  }
  .trailing {
    flex: none;
    padding-right: 6px;
  }
</style>
