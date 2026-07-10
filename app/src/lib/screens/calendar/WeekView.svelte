<script>
  import WeatherWeek from '../../components/WeatherWeek.svelte';
  import { weekDates, eventsForDate, fmtWeekRange, sameDay, WEEKDAYS } from '../../calendar.js';
  import { getWeather } from '../../api.js';
  import { weather, weatherWeek } from '../../data/mock.js';
  import { refreshTick } from '../../refresh.svelte.js';

  let { anchor = new Date(), onDayClick } = $props();
  const today = new Date();
  let dates = $derived(weekDates(anchor));
  let days = $derived(
    dates.map((d, i) => ({
      date: d,
      dow: WEEKDAYS[i],
      num: d.getDate(),
      isToday: sameDay(d, today),
      events: eventsForDate(d).map((e) => ({ color: e.color, title: e.title }))
    }))
  );

  // Render the mock week strip immediately, then hydrate from Open-Meteo — on
  // mount and on every refresh heartbeat.
  let wxWeek = $state(weatherWeek);
  // Gate the forecast strip on the first real fetch so we never flash the mock
  // week before hydrating to the configured location's forecast.
  let wxLoaded = $state(false);
  $effect(() => {
    refreshTick(); // re-run on each heartbeat
    getWeather({ today: weather, week: weatherWeek }).then((wx) => {
      if (wx.week && wx.week.length) wxWeek = wx.week;
      wxLoaded = true;
    });
  });

  const iso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // The forecast is always "today + next N days" (10, see weather.js),
  // regardless of which week is paged into view — matching it to `dates` by
  // array position breaks the moment you page forward/back a week. Live
  // forecast days carry a real `date` (see server/sources/weather.js), so
  // align to that exactly and show an explicit no-data cell for any date
  // outside the forecast window (past days, or 10+ days out).
  // Mock data has no `date` (it's a fixed fake week), so it keeps the old
  // positional match.
  let weekWx = $derived.by(() => {
    const isLive = wxWeek.some((d) => d.date);
    if (!isLive) return dates.map((d, i) => ({ ...wxWeek[i], today: sameDay(d, today) }));
    const byDate = new Map(wxWeek.map((d) => [d.date, d]));
    return dates.map((d) => {
      const f = byDate.get(iso(d));
      return f
        ? { ...f, today: sameDay(d, today) }
        : { day: WEEKDAYS[d.getDay()], today: sameDay(d, today), noData: true };
    });
  });
</script>

<div class="view">
  <div class="title">{fmtWeekRange(dates)}</div>
  <!-- Kept in layout (reserves its slot) but hidden until real weather loads,
       so it appears in place instead of popping in and pushing the days down. -->
  <div style:visibility={wxLoaded ? 'visible' : 'hidden'}>
    <WeatherWeek days={weekWx} />
  </div>
  <div class="cols">
    {#each days as day}
      <div
        class="col"
        class:today={day.isToday}
        role="button"
        tabindex="0"
        onclick={() => onDayClick?.(day.date)}
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onDayClick?.(day.date);
          }
        }}
      >
        <div class="chead">
          <div class="dow">{day.dow}</div>
          <div class="dnum" class:tnum={day.isToday}>{day.num}</div>
        </div>
        <div class="evs">
          {#each day.events as e}
            <div class="ev" style="border-left-color:{e.color};"><span>{e.title}</span></div>
          {/each}
        </div>
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
    gap: 20px;
  }
  .title {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 40px;
    color: var(--ink);
    padding: 4px 4px 0;
  }
  .cols {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 12px;
  }
  .col {
    background: var(--surface);
    border-radius: 20px;
    box-shadow: var(--shadow);
    padding: 16px 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow: hidden;
    cursor: pointer;
    text-align: left;
    transition: background var(--dur-fast) var(--ease);
  }
  .col.today {
    background: #fbf6ea;
  }
  /* Tap a day to jump to its Day view (wired in CalendarScreen). */
  .col:active {
    background: var(--surface-2);
  }
  .chead {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .dow {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--ink-faint);
  }
  .dnum {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 30px;
    color: var(--ink);
  }
  .tnum {
    width: 48px;
    height: 48px;
    border-radius: 999px;
    background: var(--gold);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .evs {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ev {
    background: #f7f9fc;
    border-left: 4px solid;
    border-radius: 7px;
    padding: 7px 9px;
    overflow: hidden;
  }
  .ev span {
    font-size: 14px;
    font-weight: 600;
    color: #3d4757;
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
