<script>
  import Icon from '../components/Icon.svelte';
  import AvatarChip from '../components/AvatarChip.svelte';
  import { budget as budgetMock, cat } from '../data/mock.js';
  import { getBudget, unlockBudget } from '../api.js';
  import { members } from '../roster.svelte.js';
  import { refreshTick } from '../refresh.svelte.js';

  // Past this age, the "updated" caption switches to a warning treatment —
  // Monarch's scraping is documented as fragile (unofficial API, session
  // expiry), so a stale snapshot showing a confidently-wrong number is a
  // real failure mode here, not a hypothetical.
  const STALE_MS = 24 * 60 * 60 * 1000;

  const PERIODS = [
    ['month', 'This Month'],
    ['last', 'Last Month'],
    ['ytd', 'Year to Date']
  ];
  const PERIOD_SUB = { month: 'this month', last: 'last month', ytd: 'so far this year' };
  const MONTH_NAMES = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ];
  const lastMonthName = MONTH_NAMES[(new Date().getMonth() + 11) % 12];
  const PERIOD_EMPTY = {
    last: `Needs the budget sidecar to have run in ${lastMonthName} — it'll show up once a full month's been captured.`,
    ytd: 'Needs at least one live sync from the budget sidecar this year.'
  };
  let period = $state('month');

  let data = $state(budgetMock);
  // Only 'month' has a legitimate demo/mock substitute — showing the shared
  // demo numbers under a "Last Month" or "Year to Date" label would fabricate
  // history that doesn't exist, the opposite of this screen's one honest
  // number premise. Those two periods track their own real absence instead.
  let periodUnavailable = $state(false);

  // Budget is the one wall screen that isn't login-free — a parent PIN
  // (server-side, see auth.js) gates the underlying data, not just this UI.
  // `locked` starts true so the hero/rows never flash mock numbers before the
  // first real fetch comes back one way or the other.
  let locked = $state(true);
  let picked = $state(null);
  let pin = $state('');
  let pinError = $state('');
  let submitting = $state(false);

  function fetchPeriod() {
    const p = period;
    if (p === 'month') {
      periodUnavailable = false;
      getBudget(budgetMock, p)
        .then((d) => {
          locked = false;
          data = d;
        })
        .catch((err) => {
          if (err.locked) locked = true;
        });
      return;
    }
    getBudget(null, p)
      .then((d) => {
        locked = false;
        periodUnavailable = !d;
        if (d) data = d;
      })
      .catch((err) => {
        if (err.locked) locked = true;
      });
  }

  $effect(() => {
    refreshTick(); // re-run on each heartbeat
    period; // read inside the effect so a period change re-runs it
    fetchPeriod(); // always attempts — the response itself decides locked/unlocked
  });

  function pick(m) {
    picked = m;
    pin = '';
    pinError = '';
  }

  function backToPick() {
    picked = null;
    pin = '';
    pinError = '';
  }

  function pressDigit(d) {
    if (pin.length >= 4 || submitting) return;
    pin += d;
    if (pin.length === 4) submitPin();
  }
  function backspace() {
    pin = pin.slice(0, -1);
  }

  async function submitPin() {
    submitting = true;
    pinError = '';
    const result = await unlockBudget(picked.id, pin);
    if (result.ok) {
      locked = false;
      picked = null;
      pin = '';
      fetchPeriod();
    } else {
      pinError = result.error;
      pin = '';
    }
    submitting = false;
  }

  let totals = $derived(data.totals || { budget: 0, spent: 0, left: 0 });
  // Biggest spend first — sorted here rather than server-side so it applies
  // uniformly to the real API (any period) and the demo/mock fallback alike,
  // in one place, instead of keeping mock.js's ordering manually in sync.
  let sortedBudgets = $derived([...(data.budgets || [])].sort((a, b) => b.spent - a.spent));
  // Staleness only means something for the current month — "last month"
  // legitimately stopped updating the moment the month ended, that's not a
  // failure to warn about.
  let isStale = $derived(
    period === 'month' && (!data.updated || Date.now() - new Date(data.updated).getTime() > STALE_MS)
  );

  function updatedLabel(iso) {
    if (!iso) return 'never updated';
    const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (min < 1) return 'updated just now';
    if (min < 60) return `updated ${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 48) return `updated ${hr}h ago`;
    return `updated ${Math.round(hr / 24)}d ago`;
  }

  // budget=0 (unbudgeted spend) still shows a full/over bar rather than
  // dividing by zero — there's no ratio to show, but the spend is real.
  function pctOf(row) {
    if (row.budget <= 0) return row.spent > 0 ? 100 : 0;
    return Math.max(0, Math.min(100, (row.spent / row.budget) * 100));
  }
</script>

<div class="screen">
  {#if locked}
    <div class="card appbar">
      <div class="title">Budget</div>
    </div>
    <div class="card lock-state">
      {#if !picked}
        <Icon name="lock" size={48} color="var(--ink-faint)" />
        <div class="empty-title">Budget is locked</div>
        <div class="empty-sub">A parent's PIN unlocks it for a bit.</div>
        <div class="members">
          {#each members() as m}
            <button class="member" onclick={() => pick(m)}>
              <AvatarChip id={m.id} name={m.name} color={m.color} monogram={m.mono} size={72} showName={false} />
              <span>{m.name}</span>
            </button>
          {/each}
        </div>
      {:else}
        <button class="back" onclick={backToPick}
          ><Icon name="chevron_left" size={20} color="var(--ink-soft)" /> Back</button
        >
        <AvatarChip
          id={picked.id}
          name={picked.name}
          color={picked.color}
          monogram={picked.mono}
          size={72}
          showName={false}
        />
        <div class="empty-title">Enter PIN for {picked.name}</div>
        <div class="dots">
          {#each Array(4) as _, i}<span class="dot" class:filled={i < pin.length}></span>{/each}
        </div>
        {#if pinError}<div class="pin-error">{pinError}</div>{/if}
        <div class="keypad">
          {#each ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as d}
            <button class="key" onclick={() => pressDigit(d)} disabled={submitting}>{d}</button>
          {/each}
          <span></span>
          <button class="key" onclick={() => pressDigit('0')} disabled={submitting}>0</button>
          <button class="key ghost" onclick={backspace} disabled={submitting} aria-label="Backspace">
            <Icon name="backspace" size={20} color="var(--ink-soft)" />
          </button>
        </div>
      {/if}
    </div>
  {:else}
    <div class="card appbar">
      <div class="title">Budget</div>
      <div class="seg">
        {#each PERIODS as [id, label]}
          <button class="segbtn" class:on={period === id} onclick={() => (period = id)}>{label}</button>
        {/each}
      </div>
    </div>

    {#if periodUnavailable}
      <div class="card empty-state">
        <Icon name="history" size={56} color="var(--ink-faint)" />
        <div class="empty-title">Not tracked yet</div>
        <div class="empty-sub">{PERIOD_EMPTY[period]}</div>
      </div>
    {:else}
      <div class="card hero">
        <div class="amount" style="color:{totals.left >= 0 ? 'var(--good)' : 'var(--bad)'};">
          {totals.left < 0 ? '−' : ''}${Math.abs(Math.round(totals.left)).toLocaleString()}
        </div>
        <div class="sub">
          {totals.left >= 0 ? `left to spend ${PERIOD_SUB[period]}` : `over budget ${PERIOD_SUB[period]}`}
        </div>
        <div class="updated" class:stale={isStale}>
          {#if isStale}<Icon name="warning" size={16} fill color="var(--warn)" />{/if}
          {updatedLabel(data.updated)}
        </div>
      </div>

      {#if !data.budgets?.length}
        <div class="card empty-state">
          <Icon name="savings" size={56} color="var(--ink-faint)" />
          <div class="empty-title">No budget configured yet</div>
          <div class="empty-sub">Set up categories in Monarch Money — they'll show up here once the sidecar syncs.</div>
        </div>
      {:else}
        <div class="rows">
          {#each sortedBudgets as row}
            {@const over = row.left < 0}
            <div class="card row">
              <span class="tile" style="background:{cat[row.catKey]?.[1] || cat.sky[1]};">
                <Icon name={row.icon || 'category'} size={26} color={cat[row.catKey]?.[0] || cat.sky[0]} />
              </span>
              <div class="rbody">
                <div class="rhead">
                  <span class="rname">{row.category}</span>
                  <span class="ramt" class:over>
                    {over ? `$${Math.round(-row.left)} over` : `$${Math.round(row.left)} left`}
                  </span>
                </div>
                <div class="track">
                  <div class="fill" class:over style="width:{pctOf(row)}%;"></div>
                </div>
                <div class="rfoot">${row.spent} of ${row.budget}</div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
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
  .card {
    background: var(--surface);
    border-radius: 28px;
    box-shadow: var(--shadow);
  }

  .appbar {
    padding: 20px 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .title {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 30px;
    color: var(--ink);
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
    padding: 10px 18px;
    border-radius: 999px;
    font-size: 15px;
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

  .hero {
    padding: 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .amount {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 96px;
    line-height: 1;
  }
  .sub {
    font-size: 19px;
    color: var(--ink-soft);
    font-weight: 600;
  }
  .updated {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    color: var(--ink-faint);
    margin-top: 4px;
  }
  .updated.stale {
    color: var(--warn);
    font-weight: 700;
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 40px;
    text-align: center;
  }
  .empty-title {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 24px;
    color: var(--ink-soft);
  }
  .empty-sub {
    font-size: 17px;
    color: var(--ink-faint);
    max-width: 420px;
  }

  .lock-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 40px;
    text-align: center;
  }
  .members {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 20px;
    margin-top: 10px;
  }
  .member {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    border: none;
    background: none;
    padding: 12px;
    border-radius: 20px;
    cursor: pointer;
  }
  .member:active {
    background: var(--bg);
  }
  .member span {
    font-size: 15px;
    font-weight: 600;
    color: var(--ink);
  }
  .back {
    align-self: flex-start;
    display: flex;
    align-items: center;
    border: none;
    background: none;
    font-size: 15px;
    font-weight: 600;
    color: var(--ink-soft);
    cursor: pointer;
    padding: 4px;
  }
  .dots {
    display: flex;
    gap: 12px;
  }
  .dot {
    width: 14px;
    height: 14px;
    border-radius: 999px;
    border: 2px solid var(--hairline);
  }
  .dot.filled {
    background: var(--person);
    border-color: var(--person);
  }
  .pin-error {
    color: var(--bad);
    font-weight: 600;
    font-size: 14px;
  }
  .keypad {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    width: 100%;
    max-width: 240px;
  }
  .key {
    aspect-ratio: 1;
    border-radius: 999px;
    border: none;
    background: var(--bg);
    box-shadow: var(--shadow-press);
    font-size: 22px;
    font-weight: 700;
    color: var(--ink);
    cursor: pointer;
  }
  .key.ghost {
    background: none;
    box-shadow: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .key:disabled {
    opacity: 0.6;
  }

  .rows {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
    overflow-y: auto;
  }
  .row {
    padding: 20px 24px;
    display: flex;
    align-items: center;
    gap: 18px;
  }
  .tile {
    flex: none;
    width: 48px;
    height: 48px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .rbody {
    flex: 1;
    min-width: 0;
  }
  .rhead {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .rname {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 20px;
    color: var(--ink);
  }
  .ramt {
    font-size: 16px;
    font-weight: 700;
    color: var(--good);
  }
  .ramt.over {
    color: var(--bad);
  }
  .track {
    height: 10px;
    border-radius: 999px;
    background: var(--hairline-2);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    border-radius: 999px;
    background: var(--good);
  }
  .fill.over {
    background: var(--bad);
  }
  .rfoot {
    margin-top: 8px;
    font-size: 14px;
    color: var(--ink-faint);
    font-weight: 600;
  }
</style>
