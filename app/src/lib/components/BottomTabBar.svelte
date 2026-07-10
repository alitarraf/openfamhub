<script>
  import Icon from './Icon.svelte';
  // App-launcher on every screen.
  const DEFAULT_TABS = [
    { id: 'home', icon: 'home', label: 'Home' },
    { id: 'calendar', icon: 'calendar_month', label: 'Calendar' },
    { id: 'tasks', icon: 'task_alt', label: 'Tasks' },
    { id: 'meals', icon: 'restaurant_menu', label: 'Meals' },
    { id: 'budget', icon: 'savings', label: 'Budget' },
    { id: 'journal', icon: 'auto_stories', label: 'Journal' }
  ];
  // scale "wall" = full 1080x1920 sizing; "default" = compact gallery sizing.
  let { active = 'home', tabs = DEFAULT_TABS, onSelect, scale = 'default' } = $props();
  let wall = $derived(scale === 'wall');
</script>

<nav class="tabbar" class:wall>
  {#each tabs as tab}
    <button class="tab" class:active={tab.id === active} onclick={() => onSelect?.(tab.id)}>
      <Icon
        name={tab.icon}
        size={wall ? 40 : 28}
        fill={tab.id === active}
        color={tab.id === active ? 'var(--gold-ink)' : 'var(--ink-faint)'}
      />
      <span class="label">{tab.label}</span>
    </button>
  {/each}
</nav>

<style>
  .tabbar {
    background: var(--surface);
    border-radius: 22px;
    box-shadow: var(--shadow);
    padding: 10px;
    display: flex;
    gap: 8px;
  }
  .tabbar.wall {
    border-radius: 28px;
    padding: 14px;
    gap: 10px;
  }
  .tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    padding: 12px;
    border-radius: 16px;
    background: transparent;
    border: none;
    cursor: pointer;
  }
  .wall .tab {
    gap: 8px;
    padding: 18px;
    border-radius: 20px;
  }
  .label {
    font-size: 14px;
    font-weight: 600;
    color: var(--ink-faint);
  }
  .wall .label {
    font-size: 20px;
  }
  .tab.active {
    background: var(--gold-soft);
  }
  .tab.active .label {
    color: var(--gold-ink);
    font-weight: 700;
  }
</style>
