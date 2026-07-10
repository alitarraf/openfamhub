<script>
  import TasksTabs from '../components/TasksTabs.svelte';
  import AvatarChip from '../components/AvatarChip.svelte';
  import Icon from '../components/Icon.svelte';
  import { todoColumns } from '../data/mock.js';
  import { byId, syncListToRoster } from '../roster.svelte.js';
  import { getBoard, setTaskDone } from '../api.js';
  import { refreshTick } from '../refresh.svelte.js';

  let { onSubTab } = $props();
  let cols = $state(structuredClone(todoColumns));
  const emptyCol = () => ({ items: [] });

  // Live: replace each person's column with their assigned To-Do tasks from the
  // shared Todoist project. The task `id` is preserved so a tap can close it in
  // Todoist. Due dates aren't surfaced yet (read-only) → blank. No board (no
  // creds / no assignees) → columns stay full mock (mock rows carry no id).
  // Runs on mount and again on every refresh heartbeat.
  $effect(() => {
    refreshTick(); // re-run on each heartbeat
    syncListToRoster(cols, emptyCol);
    hydrate();
  });
  async function hydrate() {
    const board = await getBoard('todo');
    if (!board) return;
    for (const bm of board.members) {
      const col = cols.find((c) => c.id === bm.id);
      if (!col) continue;
      col.items = bm.tasks.map((t) => ({ id: t.id, title: t.title, due: '', overdue: false, done: t.done }));
    }
  }

  // Tap-to-complete: flip optimistically, then close/reopen in Todoist. Mock rows
  // (no id) stay local. Revert the flip if the write fails so UI matches Todoist.
  async function toggle(it) {
    const next = !it.done;
    it.done = next;
    if (!it.id) return;
    const ok = await setTaskDone(it.id, next);
    if (!ok) it.done = !next;
  }
</script>

<div class="screen">
  <TasksTabs active="todo" onSelect={(id) => onSubTab?.(id)} />
  <div class="cols">
    {#each cols as col}
      {@const m = byId(col.id)}
      {#if m}
        <div class="col">
          <div class="colhead">
            <AvatarChip id={m.id} name={m.name} color={m.color} monogram={m.mono} size={64} />
          </div>
          {#each col.items as it}
            <button class="item" onclick={() => toggle(it)}>
              <span class="cb" class:done={it.done} style="border-color:{m.tintBorder};">
                {#if it.done}<Icon name="check" size={20} fill color="#fff" />{/if}
              </span>
              <span class="meta">
                <span class="title" class:done={it.done}>{it.title}</span>
                <span class="due" class:over={it.overdue && !it.done} class:done={it.done}>{it.due}</span>
              </span>
            </button>
          {/each}
        </div>
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
  /* auto-fit, not a fixed 4 — see TasksChoreScreen for why. */
  .cols {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    grid-auto-rows: minmax(200px, 1fr);
    gap: 18px;
    overflow-y: auto;
    align-content: start;
  }
  .col {
    background: var(--surface);
    border-radius: 24px;
    box-shadow: var(--shadow);
    padding: 20px 18px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow: hidden;
  }
  .colhead {
    display: flex;
    justify-content: center;
  }
  .item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    background: transparent;
    border: none;
    padding: 0;
    text-align: left;
    cursor: pointer;
  }
  .cb {
    width: 32px;
    height: 32px;
    border-radius: 999px;
    border: 2.5px solid #c7d3e0;
    flex: none;
    margin-top: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .cb.done {
    background: var(--good);
    border-color: var(--good) !important;
  }
  .meta {
    display: flex;
    flex-direction: column;
  }
  .title {
    font-size: 18px;
    font-weight: 600;
    color: var(--ink);
  }
  .title.done {
    color: var(--ink-faint);
    text-decoration: line-through;
  }
  .due {
    font-size: 15px;
    color: var(--ink-faint);
  }
  .due.over {
    color: var(--bad);
    font-weight: 600;
  }
  .due.done {
    color: var(--ink-faint);
  }
</style>
