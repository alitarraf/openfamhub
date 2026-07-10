<script>
  // Calendar grid.
  //   "mini"     dashboard month, dots
  //   "twoweek"  dashboard: current week + next week (2 rows), dots
  //   "full"     calendar screen, event pills
  import AvatarChip from './AvatarChip.svelte';

  let { month, variant = 'mini', onDayClick } = $props();

  let cells = $derived.by(() => {
    if (variant === 'twoweek') {
      const todayIdx = (month.firstDay + month.today - 1) % 7; // weekday of today (Sun=0)
      const start = month.today - todayIdx; // Sunday of this week (may be <1)
      return Array.from({ length: 14 }, (_, i) => start + i);
    }
    const out = [];
    for (let i = 0; i < month.firstDay; i++) out.push(null);
    for (let d = 1; d <= month.daysInMonth; d++) out.push(d);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  });

  const dotsVariant = $derived(variant === 'full' ? 'full' : 'mini');

  // `d` is a day-of-month offset from `month`'s anchored month, not necessarily
  // within it (the twoweek variant spills into the adjacent month) — the Date
  // constructor rolls day-overflow/underflow into the correct adjacent month,
  // so this is correct for spillover cells too, not just in-range ones.
  const dateFor = (d) => new Date(month.year, month.monthIndex, d);
</script>

<div class="grid {dotsVariant}">
  {#each cells as d}
    {#if d == null}
      <div class="empty"></div>
    {:else}
      {@const inRange = d >= 1 && d <= month.daysInMonth}
      {@const disp = inRange ? d : d > month.daysInMonth ? d - month.daysInMonth : ''}
      {@const isToday = inRange && d === month.today}
      <button class="cell" class:today={isToday} class:muted={!inRange} onclick={() => onDayClick?.(dateFor(d))}>
        {#if isToday}
          <div class="num today-num">{disp}</div>
        {:else}
          <div class="num">{disp}</div>
        {/if}
        {#if variant === 'full'}
          <div class="evs">
            {#each (inRange && month.events[d]) || [] as e}
              <div class="ev" style="border-left-color:{e.color};"><span>{e.title}</span></div>
            {/each}
          </div>
        {:else}
          <div class="dots">
            {#each (inRange && month.dots[d]) || [] as person}
              {#if person}
                <AvatarChip
                  id={person.id}
                  name={person.name}
                  color={person.color}
                  monogram={person.mono}
                  size={24}
                  showName={false}
                />
              {:else}
                <span class="dot"></span>
              {/if}
            {/each}
          </div>
        {/if}
      </button>
    {/if}
  {/each}
</div>

<style>
  .grid {
    display: grid;
    /* minmax(0,·) — not the default minmax(auto,·) — so a long event title
       (nowrap) can't force its column wider than 1fr and squish its neighbors;
       the cell clips + ellipsizes instead. */
    grid-template-columns: repeat(7, minmax(0, 1fr));
  }
  .grid.mini {
    gap: 8px;
  }
  .grid.full {
    gap: 10px;
  }

  .mini .empty {
    height: 118px;
  }
  .full .empty {
    min-height: 198px;
  }

  .cell {
    border-radius: 18px;
    background: var(--surface-2);
    border: 1px solid var(--hairline-2);
    display: flex;
    flex-direction: column;
    min-width: 0; /* let the cell shrink to its track so pills clip, not overflow */
    width: 100%;
    margin: 0;
    padding: 0;
    appearance: none;
    font: inherit;
    text-align: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: transform 0.08s ease;
  }
  .cell:active {
    transform: scale(0.96);
    box-shadow: var(--shadow-press);
  }
  .mini .cell {
    height: 118px;
    padding: 12px 14px;
  }
  .full .cell {
    min-height: 198px;
    padding: 14px 12px;
  }
  .full .cell.today {
    background: #fbf6ea;
    border-color: #efd9a6;
  }
  .cell.muted {
    background: var(--bg);
  }
  .cell.muted .num {
    color: var(--ink-faint);
  }

  .num {
    font-family: var(--font-display);
    font-weight: 500;
    font-size: 26px;
    color: var(--ink);
    padding-left: 4px;
  }
  .full .num {
    margin-bottom: 10px;
  }
  .today-num {
    font-weight: 600;
    color: #fff;
    background: var(--gold);
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding-left: 0;
  }
  .mini .today-num {
    width: 48px;
    height: 48px;
    font-size: 28px;
  }
  .full .today-num {
    width: 46px;
    height: 46px;
    font-size: 26px;
    margin-bottom: 8px;
  }

  .dots {
    display: flex;
    gap: 6px;
    margin-top: auto;
    flex-wrap: wrap;
  }
  /* Fallback for events with no resolved member (unattributed live events) —
     avatars.svelte.js/roster.svelte.js can't give these a face, so a plain
     dot stands in. */
  .dot {
    width: 14px;
    height: 14px;
    border-radius: 999px;
    background: var(--ink-faint);
  }

  .ev {
    display: flex;
    align-items: center;
    background: #f7f9fc;
    border-left: 4px solid;
    border-radius: 7px;
    padding: 6px 9px;
    margin-bottom: 6px;
    overflow: hidden;
  }
  .ev span {
    font-size: 15px;
    font-weight: 600;
    color: #3d4757;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
