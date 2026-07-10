<script>
  import TasksTabs from '../components/TasksTabs.svelte';
  import AvatarChip from '../components/AvatarChip.svelte';
  import RewardCard from '../components/RewardCard.svelte';
  import Icon from '../components/Icon.svelte';
  import { cat } from '../data/mock.js';
  import { members } from '../roster.svelte.js';
  import { getRewards, assignReward, unassignReward, redeemReward, setRewardHidden } from '../api.js';
  import { refreshTick, bumpRefresh } from '../refresh.svelte.js';

  let { onSubTab } = $props();

  // Master catalog (server/config/rewards.js) + who's working toward what
  // (assignments, on-wall via Manage) + live balances — one shared reward
  // list, curated per member. No mock fallback: an empty catalog reads better
  // than a fabricated one (see getRecipes for the same call).
  let catalog = $state([]);
  let assignments = $state({}); // { memberId: [rewardId, ...] }
  let balances = $state({}); // { memberId: points }
  let showManage = $state(false);

  $effect(() => {
    refreshTick(); // re-run on each heartbeat
    getRewards().then((r) => {
      if (!r) return;
      catalog = r.catalog;
      assignments = r.assignments;
      balances = r.balances;
    });
  });

  let byRewardId = $derived(Object.fromEntries(catalog.map((r) => [r.id, r])));

  async function redeem(memberId, rewardId) {
    const { ok, balance } = await redeemReward(rewardId, memberId);
    if (!ok) return;
    balances = { ...balances, [memberId]: balance };
    assignments = { ...assignments, [memberId]: (assignments[memberId] || []).filter((id) => id !== rewardId) };
    bumpRefresh(); // so Chore/Profile screens see the new balance now
  }

  async function toggleAssign(memberId, rewardId, on) {
    const ok = on ? await assignReward(rewardId, memberId) : await unassignReward(rewardId, memberId);
    if (!ok) return;
    const current = assignments[memberId] || [];
    assignments = {
      ...assignments,
      [memberId]: on ? [...current, rewardId] : current.filter((id) => id !== rewardId)
    };
  }

  // Hide/show a reward from the wall (no keyboard — creating/naming is
  // PWA-only). Hiding drops it off every member's redeem grid; the server also
  // clears its assignments, so mirror that locally for an instant update.
  async function toggleHide(rewardId, hidden) {
    const ok = await setRewardHidden(rewardId, hidden);
    if (!ok) return;
    catalog = catalog.map((r) => (r.id === rewardId ? { ...r, hidden } : r));
    if (hidden) {
      assignments = Object.fromEntries(
        Object.entries(assignments).map(([mid, ids]) => [mid, ids.filter((id) => id !== rewardId)])
      );
    }
    bumpRefresh();
  }
</script>

<div class="screen">
  <TasksTabs active="reward" onSelect={(id) => onSubTab?.(id)}>
    {#snippet trailing()}
      <button class="manage-btn" class:on={showManage} onclick={() => (showManage = !showManage)}>
        <Icon name="settings" size={18} color={showManage ? '#fff' : 'var(--ink-soft)'} />
        {showManage ? 'Done' : 'Manage'}
      </button>
    {/snippet}
  </TasksTabs>

  {#if showManage}
    <div class="card manage">
      <div class="mhead">
        Tap a member's initial to assign a reward, or the eye to hide one from the wall. Add new rewards from the phone
        app.
      </div>
      <div class="mgrid">
        {#each catalog as r}
          <div class="mcard" class:hidden={r.hidden}>
            <div class="mtop">
              <span class="ic" style="background:{cat[r.catKey][1]};">
                <Icon name={r.icon} size={26} color={cat[r.catKey][0]} />
              </span>
              <button
                class="hidebtn"
                onclick={() => toggleHide(r.id, !r.hidden)}
                aria-label="{r.hidden ? 'Show' : 'Hide'} {r.name}"
              >
                <Icon name={r.hidden ? 'visibility' : 'visibility_off'} size={20} color="var(--ink-soft)" />
              </button>
            </div>
            <div class="mname">{r.name}</div>
            <div class="mcost">
              <Icon name="star" size={16} fill color="var(--gold)" />
              <span>{r.cost}</span>
              {#if r.hidden}<span class="mhidden">Hidden</span>{/if}
            </div>
            <div class="mtoggles">
              {#each members() as m}
                {@const on = (assignments[m.id] || []).includes(r.id)}
                <button
                  class="mchip"
                  style="background:{on ? m.color : 'var(--bg)'}; color:{on ? '#fff' : 'var(--ink-soft)'};"
                  onclick={() => toggleAssign(m.id, r.id, !on)}
                  disabled={r.hidden}
                  aria-label="{on ? 'Remove' : 'Assign'} {r.name} {on ? 'from' : 'to'} {m.name}"
                >
                  {m.mono}
                </button>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <div class="rows">
      {#each members() as m}
        <div class="row" style="background:{m.tint}; border-color:{m.tintBorder};">
          <div class="rhead">
            <AvatarChip id={m.id} name={m.name} color={m.color} monogram={m.mono} size={64} showName={false} />
            <span class="rname">{m.name}</span>
            <span class="bal">
              <Icon name="star" size={22} fill color="var(--gold)" />
              <span class="balnum">{balances[m.id] ?? 0}</span>
            </span>
          </div>
          <div class="rgrid">
            {#each assignments[m.id] || [] as rewardId}
              {@const r = byRewardId[rewardId]}
              {#if r && !r.hidden}
                <RewardCard
                  variant="tile"
                  name={r.name}
                  cost={r.cost}
                  icon={r.icon}
                  iconColor={cat[r.catKey][0]}
                  iconBg={cat[r.catKey][1]}
                  color={m.color}
                  locked={(balances[m.id] ?? 0) < r.cost}
                  onRedeem={() => redeem(m.id, rewardId)}
                />
              {/if}
            {/each}
            {#if !(assignments[m.id] || []).length}
              <div class="empty">Nothing assigned yet — tap Manage to add a reward.</div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .screen {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .manage-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    border: none;
    border-radius: 18px;
    padding: 14px 20px;
    background: var(--bg);
    font-size: 17px;
    font-weight: 600;
    color: var(--ink-soft);
    cursor: pointer;
  }
  .manage-btn.on {
    background: var(--ink);
    color: #fff;
  }

  .rows {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 18px;
    overflow-y: auto;
  }
  .row {
    border: 1px solid;
    border-radius: 24px;
    padding: 22px;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .rhead {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .rname {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 26px;
    color: var(--ink);
  }
  .bal {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: #fff;
    border-radius: 999px;
    padding: 7px 16px;
    margin-left: auto;
  }
  .balnum {
    font-weight: 700;
    font-size: 22px;
    color: var(--gold-ink);
  }
  .rgrid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 14px;
    flex: 1;
  }
  .empty {
    grid-column: 1 / -1;
    align-self: center;
    font-size: 16px;
    color: var(--ink-faint);
    text-align: center;
    padding: 20px;
  }

  .manage {
    flex: 1;
    min-height: 0;
    padding: 24px 28px;
    display: flex;
    flex-direction: column;
    gap: 18px;
    overflow-y: auto;
  }
  .mhead {
    font-size: 16px;
    color: var(--ink-soft);
  }
  .mgrid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
    align-content: start;
  }
  .mcard {
    background: var(--bg);
    border-radius: 18px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .mcard.hidden {
    opacity: 0.55;
  }
  .mtop {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }
  .hidebtn {
    width: 40px;
    height: 40px;
    border: none;
    background: none;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .mhidden {
    font-size: 13px;
    font-weight: 700;
    color: var(--ink-faint);
    margin-left: 6px;
  }
  .ic {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .mname {
    font-weight: 700;
    font-size: 17px;
    color: var(--ink);
  }
  .mcost {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 14px;
    font-weight: 700;
    color: var(--gold-ink);
  }
  .mtoggles {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 6px;
  }
  .mchip {
    width: 38px;
    height: 38px;
    border-radius: 999px;
    border: none;
    font-weight: 700;
    font-size: 15px;
    cursor: pointer;
  }
  .mchip:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>
