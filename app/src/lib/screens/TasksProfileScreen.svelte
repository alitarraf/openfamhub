<script>
  // Family Progress overview (PRD: "Profile + Family Progress — rings, balances,
  // stars-today"). Per-member: avatar + today's chore-completion ring, lifetime
  // balance (header, matches Chore/Reward's convention), stars earned today
  // (footer, matches the PRD's own "45 stars earned today" Chore mockup), and
  // the nearest reward they're working toward (ties the economy to a reason).
  import TasksTabs from '../components/TasksTabs.svelte';
  import PersonCard from '../components/PersonCard.svelte';
  import Icon from '../components/Icon.svelte';
  import { choreCards } from '../data/mock.js';
  import { byId, syncListToRoster } from '../roster.svelte.js';
  import { getBalances, getTodayStars, getBoard, getRewards } from '../api.js';
  import { refreshTick } from '../refresh.svelte.js';

  let { onSubTab } = $props();
  let cards = $state(structuredClone(choreCards));
  const emptyCard = () => ({ points: 0, completion: 0, today: 0 });
  let rewardsData = $state({ catalog: [], assignments: {}, balances: {} });

  $effect(() => {
    refreshTick(); // re-run on each heartbeat
    syncListToRoster(cards, emptyCard);
    getBalances().then((balances) => {
      if (!balances) return;
      for (const c of cards) {
        if (c.id in balances) c.points = balances[c.id];
      }
    });
    getTodayStars().then((today) => {
      if (!today) return;
      for (const c of cards) {
        if (c.id in today) c.today = today[c.id];
      }
    });
    // Today's chores done/assigned, same board the Chore screen reads. No
    // chores assigned today → null (no ring), not 0% — those read differently.
    getBoard('routine').then((board) => {
      if (!board) return;
      for (const bm of board.members) {
        const c = cards.find((card) => card.id === bm.id);
        if (!c) continue;
        c.completion = bm.tasks.length ? bm.tasks.filter((t) => t.done).length / bm.tasks.length : null;
      }
    });
    getRewards().then((r) => {
      if (r) rewardsData = r;
    });
  });

  // The assigned reward closest to affordable (or already affordable) for a
  // member — null if they have nothing assigned (Reward tab → Manage).
  function nearestReward(memberId) {
    const ids = rewardsData.assignments[memberId] || [];
    if (!ids.length) return null;
    const balance = rewardsData.balances[memberId] ?? 0;
    const catalogById = Object.fromEntries(rewardsData.catalog.map((r) => [r.id, r]));
    const options = ids
      .map((id) => catalogById[id])
      .filter(Boolean)
      .map((r) => ({ ...r, gap: r.cost - balance }));
    if (!options.length) return null;
    options.sort((a, b) => a.gap - b.gap);
    return options[0];
  }
</script>

<div class="screen">
  <TasksTabs active="profile" onSelect={(id) => onSubTab?.(id)} />
  <div class="grid">
    {#each cards as c}
      {@const m = byId(c.id)}
      {#if m}
        {@const near = nearestReward(m.id)}
        <PersonCard
          id={m.id}
          name={m.name}
          color={m.color}
          tint={m.tint}
          tintBorder={m.tintBorder}
          monogram={m.mono}
          points={c.points}
          completion={c.completion}
          footer="{c.today ?? 0} stars earned today"
        >
          {#if near}
            <div class="nearest">
              <Icon name="card_giftcard" size={20} color={m.color} />
              {#if near.gap <= 0}
                <span>Ready to redeem: <strong>{near.name}</strong>!</span>
              {:else}
                <span>
                  <strong>{near.gap}</strong> more
                  <Icon name="star" size={15} fill color="var(--gold)" />
                  for {near.name}
                </span>
              {/if}
            </div>
          {:else}
            <div class="nearest muted">No reward set — see the Reward tab</div>
          {/if}
        </PersonCard>
      {/if}
    {/each}
  </div>
</div>

<style>
  .screen {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  /* auto-fit, not a fixed 2x2 — see TasksChoreScreen for why. */
  .grid {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
    grid-auto-rows: minmax(280px, 1fr);
    gap: 20px;
    overflow-y: auto;
    align-content: start;
  }
  .nearest {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    color: var(--ink);
    background: #fff;
    border-radius: 14px;
    padding: 12px 14px;
  }
  .nearest.muted {
    color: var(--ink-faint);
    font-size: 15px;
  }
</style>
