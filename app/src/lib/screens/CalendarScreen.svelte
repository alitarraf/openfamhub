<script>
  import CalendarToolbar from '../components/CalendarToolbar.svelte';
  import MonthView from './calendar/MonthView.svelte';
  import WeekView from './calendar/WeekView.svelte';
  import DayView from './calendar/DayView.svelte';
  import { addDays, addMonths } from '../calendar.js';
  import { hydrateCalendar } from '../events.svelte.js';
  import { refreshTick } from '../refresh.svelte.js';

  let view = $state('week'); // day | week | month
  let anchor = $state(new Date());

  // Cross-screen jump: Home's calendar hero asks to open a specific day, or
  // month view on today (see App.svelte's onHomeOpenDay/onHomeOpenMonth). This
  // screen stays mounted the whole time, so a plain prop won't refire on a
  // repeat tap — App.svelte resets openRequest to null via
  // onOpenRequestConsumed between requests so this effect sees a real change.
  let { openRequest = null, onOpenRequestConsumed } = $props();
  $effect(() => {
    if (openRequest) {
      view = openRequest.view;
      anchor = openRequest.date ?? new Date();
      onOpenRequestConsumed?.();
    }
  });

  // Hydrate live events for the visible window whenever the view/anchor changes,
  // and again on every refresh heartbeat. Falls back to mock inside the store on
  // any failure (no feed / API down).
  $effect(() => {
    refreshTick(); // re-run on each heartbeat
    const span = view === 'month' ? 21 : view === 'week' ? 10 : 3;
    hydrateCalendar(addDays(anchor, -span), addDays(anchor, span));
  });

  function nav(dir) {
    if (view === 'month') anchor = addMonths(anchor, dir);
    else if (view === 'week') anchor = addDays(anchor, 7 * dir);
    else anchor = addDays(anchor, dir);
  }
  const goToday = () => (anchor = new Date());
</script>

<div class="screen">
  {#if view === 'month'}
    <MonthView
      {anchor}
      onDayClick={(date) => {
        anchor = date;
        view = 'day';
      }}
    />
  {:else if view === 'week'}
    <WeekView
      {anchor}
      onDayClick={(date) => {
        anchor = date;
        view = 'day';
      }}
    />
  {:else}
    <DayView {anchor} />
  {/if}
  <CalendarToolbar
    {view}
    {anchor}
    onView={(v) => (view = v)}
    onPrev={() => nav(-1)}
    onNext={() => nav(1)}
    onToday={goToday}
  />
</div>

<style>
  .screen {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
</style>
