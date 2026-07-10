<script>
  // Single day, per-person columns. Toolbar arrows step the day.
  import AvatarChip from '../../components/AvatarChip.svelte';
  import WeatherToday from '../../components/WeatherToday.svelte';
  import Icon from '../../components/Icon.svelte';
  import { weather, weatherWeek } from '../../data/mock.js';
  import { members } from '../../roster.svelte.js';
  import { eventsForDate, fmtLongDate, sameDay } from '../../calendar.js';
  import { getWeather } from '../../api.js';
  import { refreshTick } from '../../refresh.svelte.js';

  let { anchor = new Date() } = $props();
  const today = new Date();
  let dayEvents = $derived(eventsForDate(anchor));

  let wxNow = $state(weather);
  // Gate the weather card on the first real fetch so we never flash mock values
  // (e.g. a wrong temp/city) before hydrating to the configured location.
  let wxLoaded = $state(false);
  $effect(() => {
    refreshTick(); // re-run on each heartbeat
    getWeather({ today: weather, week: weatherWeek }).then((wx) => {
      wxNow = wx.today;
      wxLoaded = true;
    });
  });
  // Events the live iCal store couldn't attribute to a specific person (single
  // shared family feed, no per-person feeds configured — see events.svelte.js)
  // used to just vanish here, since every column only ever matched e.m === id.
  // Week/Month don't filter by person at all, which is why the same event was
  // visible everywhere except here. A synthetic "Everyone" column shows them
  // instead of silently dropping them; it only appears when there's actually
  // an unattributed event, so mock data (always fully attributed) is unchanged.
  let unmapped = $derived(dayEvents.filter((e) => !e.m));
  let cols = $derived([
    ...(unmapped.length ? [{ m: null, events: unmapped }] : []),
    ...members().map((m) => ({ m, events: dayEvents.filter((e) => e.m === m.id) }))
  ]);
  let timeStr = $derived(
    sameDay(anchor, today) ? new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''
  );
</script>

<div class="view">
  <div class="header">
    <div class="when">
      {#if timeStr}<span class="time">{timeStr}</span>{/if}
      <span class="date">{fmtLongDate(anchor)}</span>
    </div>
    <!-- Kept in layout (reserves its slot) but hidden until real weather loads,
         so it appears in place instead of popping in and pushing the layout. -->
    <div style:visibility={wxLoaded ? 'visible' : 'hidden'}>
      <WeatherToday wx={wxNow.wx} temp={wxNow.temp} hi={wxNow.hi} lo={wxNow.lo} place={wxNow.place} />
    </div>
  </div>

  <div class="cols">
    {#each cols as col}
      <div class="col">
        <div class="colhead">
          {#if col.m}
            <AvatarChip id={col.m.id} name={col.m.name} color={col.m.color} monogram={col.m.mono} size={64} />
          {:else}
            <div class="everyone">
              <span class="everyone-icon"><Icon name="groups" size={30} color="var(--ink-soft)" /></span>
              <span class="everyone-label">Everyone</span>
            </div>
          {/if}
        </div>
        {#if col.events.length}
          {#each col.events as e}
            <div class="event" style="border-left-color:{col.m?.color || 'var(--ink-faint)'};">
              <div class="etime">{e.time}</div>
              <div class="etitle">{e.title}</div>
            </div>
          {/each}
        {:else}
          <div class="empty">Nothing scheduled</div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .view {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 8px 8px 0;
  }
  .when {
    display: flex;
    align-items: baseline;
    gap: 18px;
  }
  .time {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 64px;
    color: var(--ink);
  }
  .date {
    font-size: 30px;
    color: var(--ink-soft);
    font-weight: 500;
  }
  /* auto-fit, not a fixed column count — a roster bigger than 4 wraps to more
     rows and scrolls, instead of squeezing every member into one row. */
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
  /* overflow-y: auto (was hidden) — a column with several events, or one long
     enough to wrap to multiple lines, used to just get hard-clipped at the
     card edge instead of showing the rest. Now it scrolls internally. */
  .col {
    background: var(--surface);
    border-radius: 24px;
    box-shadow: var(--shadow);
    padding: 22px 18px;
    display: flex;
    flex-direction: column;
    gap: 18px;
    overflow-y: auto;
  }
  .colhead {
    display: flex;
    justify-content: center;
    flex: none;
  }
  .everyone {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .everyone-icon {
    width: 64px;
    height: 64px;
    border-radius: 999px;
    background: var(--bg);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .everyone-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--ink-soft);
  }
  .event {
    border-left: 4px solid;
    padding: 4px 0 4px 12px;
    flex: none;
  }
  .etime {
    font-size: 17px;
    font-weight: 700;
    color: var(--ink);
  }
  /* explicit wrap (not just relying on div's default white-space:normal) so a
     long title, or one with no natural break point, always stays fully
     readable instead of relying on the column being wide/tall enough. */
  .etitle {
    font-size: 16px;
    color: var(--ink-soft);
    white-space: normal;
    overflow-wrap: break-word;
  }
  .empty {
    font-size: 16px;
    color: var(--ink-faint);
    text-align: center;
    padding: 12px 0;
  }
</style>
