<script>
  import TasksTabs from '../components/TasksTabs.svelte';
  import PersonCard from '../components/PersonCard.svelte';
  import TaskRow from '../components/TaskRow.svelte';
  import { choreCards, segments, cat } from '../data/mock.js';
  import { byId, syncListToRoster } from '../roster.svelte.js';
  import { getBoard, setChoreDone, getBalances } from '../api.js';
  import { refreshTick, bumpRefresh } from '../refresh.svelte.js';
  import { celebrationsOn, playChime } from '../celebrate.js';

  let { onSubTab } = $props();
  // Per-member celebration token: bumped when a kid completes a chore, passed to
  // PersonCard which pops the avatar, ticks the star, and fires confetti.
  let celebrateTokens = $state({});
  // Kids only, and only when the setting is on. Fires the chime here (audio must
  // start from the tap gesture) and bumps the card's token for the visuals.
  function maybeCelebrate(card, completing) {
    if (!completing || !celebrationsOn() || !byId(card.id)?.kid) return;
    celebrateTokens[card.id] = (celebrateTokens[card.id] || 0) + 1;
    playChime();
  }
  // Deep-reactive local copy so completing a chore awards points live. Seeded
  // from the mock's 4-member demo content; a live roster with more (or fewer,
  // or differently-named) members is reconciled onto it below.
  let cards = $state(structuredClone(choreCards));
  const emptyCard = () => ({ points: 0, completion: 0, earnedToday: 0, tasks: [] });

  // Live: replace each person's task list with their assigned Routine·Chore tasks
  // from Todoist (one shared project, split by assignee), and their persisted
  // point balance from the economy DB (flat 1 pt/chore — see server/economy).
  // No board (no creds / no assignees) → cards stay full mock.
  // Runs on mount, again on every refresh heartbeat, and as soon as the live
  // roster lands (syncListToRoster reads it, so this effect re-fires then too).
  $effect(() => {
    refreshTick(); // re-run on each heartbeat
    syncListToRoster(cards, emptyCard);
    hydrate();
  });
  async function hydrate() {
    const board = await getBoard('routine');
    if (board) {
      for (const bm of board.members) {
        const card = cards.find((c) => c.id === bm.id);
        if (!card) continue;
        card.tasks = bm.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          done: t.done,
          icon: 'task_alt',
          catKey: 'sky',
          points: 1
        }));
      }
    }
    const balances = await getBalances();
    if (balances) {
      for (const card of cards) {
        if (card.id in balances) card.points = balances[card.id];
      }
    }
  }

  // Flip the checkbox optimistically for instant feedback, then close/reopen in
  // Todoist + award/revert a point server-side (the source of truth for points —
  // see server/economy). Mock tasks (no id) stay local, no server round trip.
  async function toggle(card, task) {
    const next = !task.done;
    task.done = next;
    if (!task.id) {
      // Mock/demo task (no creds): keep points local so the zero-cred wall and
      // the docs demo still tick + celebrate. No server truth to reconcile.
      card.points = Math.max(0, (card.points || 0) + (next ? 1 : -1));
      maybeCelebrate(card, next);
      return;
    }
    const { ok, balance } = await setChoreDone(task.id, next, card.id);
    if (ok) {
      card.points = balance;
      task.error = false;
      bumpRefresh(); // so Profile/Reward screens see the new balance now
      // Celebrate only on a confirmed completion — never on a failed write, so
      // a kid never sees confetti for a chore that then un-checks itself.
      maybeCelebrate(card, next);
    } else {
      // Save failed after server-side retries (usually a network/DNS blip).
      // Revert the optimistic flip and flag the row briefly so the tap isn't a
      // silent no-op — the parent can just tap again.
      task.done = !next;
      task.error = true;
      setTimeout(() => (task.error = false), 2500);
    }
  }
  const earned = (c) => c.tasks.filter((t) => t.done).reduce((s, t) => s + (t.points || 0), 0);
  const completion = (c) => (c.tasks.length ? c.tasks.filter((t) => t.done).length / c.tasks.length : 0);
</script>

<div class="screen">
  <TasksTabs active="chore" onSelect={(id) => onSubTab?.(id)} />
  <div class="grid">
    {#each cards as c}
      {@const m = byId(c.id)}
      {#if m}
        <PersonCard
          id={m.id}
          name={m.name}
          color={m.color}
          tint={m.tint}
          tintBorder={m.tintBorder}
          monogram={m.mono}
          points={c.points}
          completion={completion(c)}
          celebrate={celebrateTokens[m.id] || 0}
          {segments}
          footer={`${earned(c)} stars earned today`}
        >
          {#each c.tasks as t}
            <TaskRow
              title={t.title}
              icon={t.icon}
              iconColor={cat[t.catKey][0]}
              iconBg={cat[t.catKey][1]}
              points={t.points}
              done={t.done}
              error={t.error}
              onToggle={() => toggle(c, t)}
            />
          {/each}
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
  /* auto-fit, not a fixed 2x2 — a roster bigger than 4 wraps to more rows and
     scrolls, instead of a family of 7 losing 3 people off a fixed grid. */
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
</style>
