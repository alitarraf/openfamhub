<script>
  import Icon from '../components/Icon.svelte';
  import MonthGrid from '../components/MonthGrid.svelte';
  import WeatherToday from '../components/WeatherToday.svelte';
  import { weather, weatherWeek, dashboard } from '../data/mock.js';
  import { buildMonth, WEEKDAYS_MINI, addDays, fmtLongDate } from '../calendar.js';
  import { getTasks, getWeather, setTaskDone, getGroceryList, setGroceryItemDone, getMealPlan } from '../api.js';
  import { hydrateCalendar } from '../events.svelte.js';
  import { refreshTick, bumpRefresh } from '../refresh.svelte.js';

  let { onQuickAction, onOpenMeal, onOpenDay, onOpenMonth } = $props();
  const weekdays = WEEKDAYS_MINI;
  // $derived so the two-week hero re-renders if the live event store hydrates.
  let twoWeek = $derived(buildMonth(new Date()));

  // Live clock — was a static mock string before, never ticking. Only minutes
  // are shown, but a 1s tick keeps it correct-by-construction with no minute-
  // boundary alignment logic to get subtly wrong.
  let now = $state(new Date());
  $effect(() => {
    const id = setInterval(() => (now = new Date()), 1000);
    return () => clearInterval(id);
  });
  let clockTime = $derived(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
  let clockDate = $derived(fmtLongDate(now));

  // Render immediately from mock, then hydrate from the backend (each falls back
  // to mock if its source is unconfigured or the API is unreachable).
  let todos = $state(dashboard.todos);
  let grocery = $state(dashboard.grocery);
  let wxNow = $state(weather);
  // Gate the weather card on the first real fetch so we never flash mock values
  // (e.g. a wrong temp/city) before hydrating to the configured location.
  let wxLoaded = $state(false);
  let meal = $state({ ...dashboard.meal, slug: null });
  // Runs on mount and again on every refresh heartbeat so the wall stays current.
  $effect(() => {
    refreshTick(); // re-run on each heartbeat
    hydrate();
  });
  async function hydrate() {
    todos = await getTasks('todos', dashboard.todos);
    grocery = await getGroceryList(dashboard.grocery);
    wxNow = (await getWeather({ today: weather, week: weatherWeek })).today;
    wxLoaded = true;
    // Hero shows the next two weeks — hydrate that window of real events.
    const today = new Date();
    hydrateCalendar(addDays(today, -7), addDays(today, 21));

    // Today's dinner (Mealie). null day → Mealie down/unconfigured, keep the
    // mock; a real day with an empty Dinner slot means nothing's planned, which
    // is different from "no data" and shouldn't be papered over with the mock.
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const plan = await getMealPlan(iso, iso, null);
    const day = plan && plan.days && plan.days[iso];
    if (day) {
      const dinnerIdx = plan.slots.indexOf('Dinner');
      const cell = dinnerIdx >= 0 ? day[dinnerIdx] : null;
      meal = cell
        ? { slot: 'Dinner', dish: cell.title, detail: '', img: cell.img, slug: cell.slug }
        : { slot: 'Dinner', dish: 'Nothing planned', detail: '', img: null, slug: null };
    }
  }

  // Tap a To Do row → flip optimistically and close/reopen it in Todoist. Mock
  // items (no id) stay local; revert the flip if the write fails.
  async function toggleTodo(it) {
    const next = !it.done;
    it.done = next;
    if (!it.id) return;
    const ok = await setTaskDone(it.id, next);
    if (ok)
      bumpRefresh(); // so Tasks screen picks this up now, not next heartbeat
    else it.done = !next;
  }

  // Tap a Grocery row → same optimistic flip, but against Mealie's shopping list.
  async function toggleGrocery(it) {
    const next = !it.done;
    it.done = next;
    if (!it.id) return;
    const ok = await setGroceryItemDone(it.id, next);
    if (ok)
      bumpRefresh(); // so the Meals→Grocery tab picks this up now, not next heartbeat
    else it.done = !next;
  }
</script>

<div class="screen">
  <!-- AppBar -->
  <div class="card appbar">
    <div class="left">
      <div class="clock">
        <span class="time">{clockTime}</span>
        <span class="date">{clockDate}</span>
      </div>
      <div class="quick">
        <button class="qbtn" onclick={() => onQuickAction?.('sleep')} aria-label="Sleep">
          <Icon name="bedtime" size={34} fill color="var(--ink-soft)" />
        </button>
        <button class="qbtn" onclick={() => onQuickAction?.('screensaver')} aria-label="Screensaver">
          <Icon name="photo_library" size={34} color="var(--ink-soft)" />
        </button>
        <button class="qbtn" onclick={() => onQuickAction?.('babysitter')} aria-label="Babysitter mode">
          <Icon name="escalator_warning" size={34} fill color="var(--ink-soft)" />
        </button>
        <button class="qbtn" onclick={() => onQuickAction?.('settings')} aria-label="Settings">
          <Icon name="settings" size={34} color="var(--ink-soft)" />
        </button>
      </div>
    </div>
    <!-- Kept in layout (reserves its slot) but hidden until real weather loads,
         so it appears in place instead of popping in and pushing the layout. -->
    <div style:visibility={wxLoaded ? 'visible' : 'hidden'}>
      <WeatherToday wx={wxNow.wx} temp={wxNow.temp} hi={wxNow.hi} lo={wxNow.lo} place={wxNow.place} />
    </div>
  </div>

  <!-- Hero month calendar -->
  <div class="card hero">
    <div class="hero-head">
      <div class="hero-title">{twoWeek.label}</div>
      <button class="hero-sub" onclick={() => onOpenMonth?.()}>
        Next two weeks
        <Icon name="chevron_right" size={20} color="var(--ink-faint)" />
      </button>
    </div>
    <div class="weekrow">
      {#each weekdays as w}<div class="wd">{w}</div>{/each}
    </div>
    <MonthGrid month={twoWeek} variant="twoweek" onDayClick={(date) => onOpenDay?.(date)} />
  </div>

  <!-- Summary cards -->
  <div class="summary">
    <!-- To Do -->
    <div class="card sum">
      <div class="sum-head">
        <span class="tile" style="background:#E7F1F8;"><Icon name="checklist" size={26} color="#2E8BC0" /></span>
        <span class="sum-title">To Do</span>
      </div>
      <div class="checklist">
        {#each todos.items as it}
          <button class="crow" onclick={() => toggleTodo(it)}>
            <span class="cb" class:done={it.done}
              >{#if it.done}<Icon name="check" size={20} fill color="#fff" />{/if}</span
            >
            <span class="ctext" class:done={it.done}>{it.title}</span>
          </button>
        {/each}
      </div>
      <div class="sum-foot">{todos.left ?? todos.count}</div>
    </div>

    <!-- Grocery -->
    <div class="card sum">
      <div class="sum-head">
        <span class="tile" style="background:#EAF6F0;"><Icon name="shopping_cart" size={26} color="#2FA37C" /></span>
        <span class="sum-title">Grocery</span>
      </div>
      <div class="checklist">
        {#each grocery.items as it}
          <button class="crow" onclick={() => toggleGrocery(it)}>
            <span class="cb" class:done={it.done}
              >{#if it.done}<Icon name="check" size={20} fill color="#fff" />{/if}</span
            >
            <span class="ctext" class:done={it.done}>{it.title}</span>
          </button>
        {/each}
      </div>
      <div class="sum-foot">{grocery.count ?? grocery.left}</div>
    </div>

    <!-- Meals -->
    <div class="card sum">
      <div class="sum-head">
        <span class="tile" style="background:#F3E9CF;"><Icon name="restaurant_menu" size={26} color="#C9A24B" /></span>
        <span class="sum-title">Meals</span>
      </div>
      <!-- Only a live meal-plan entry with a linked Mealie recipe has a slug —
           same rule the Meals grid uses (openRecipeFromCell) — so the mock
           placeholder and "nothing planned" don't pretend to be tappable. -->
      <button class="meal-tap" disabled={!meal.slug} onclick={() => onOpenMeal?.(meal.slug)}>
        <div class="meal-photo">
          {#if meal.img}
            <img src={meal.img} alt="" onerror={(e) => (e.currentTarget.style.display = 'none')} />
          {:else}
            <span>dinner photo</span>
          {/if}
        </div>
        <div class="meal-slot">{meal.slot}</div>
        <div class="meal-dish">{meal.dish}</div>
      </button>
      <div class="sum-foot">{meal.detail}</div>
    </div>
  </div>
</div>

<style>
  .screen {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }
  .card {
    background: var(--surface);
    border-radius: 28px;
    box-shadow: var(--shadow);
  }

  .appbar {
    padding: 32px 40px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }
  .clock {
    display: flex;
    flex-direction: column;
    line-height: 1;
  }
  .time {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 72px;
    color: var(--ink);
  }
  .date {
    font-size: 26px;
    color: var(--ink-soft);
    font-weight: 500;
    margin-top: 6px;
  }
  .left {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 18px;
  }
  .quick {
    display: flex;
    flex-direction: row;
    gap: 12px;
  }
  .qbtn {
    width: 64px;
    height: 64px;
    border-radius: 18px;
    background: var(--bg);
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .hero {
    padding: 34px 40px;
  }
  .hero-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 24px;
  }
  .hero-title {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 52px;
    color: var(--ink);
  }
  .hero-sub {
    display: flex;
    align-items: center;
    gap: 2px;
    font-family: inherit;
    font-size: 22px;
    color: var(--ink-faint);
    font-weight: 600;
    background: none;
    border: none;
    padding: 6px;
    margin: -6px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: transform 0.08s ease;
  }
  .hero-sub:active {
    transform: scale(0.96);
  }
  .weekrow {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 8px;
    margin-bottom: 8px;
  }
  .wd {
    text-align: center;
    font-size: 20px;
    font-weight: 700;
    color: var(--ink-faint);
  }

  /* grid-template-rows is the fix: without it the single row auto-sizes to the
     tallest card's content (e.g. a long grocery list), which grows past the
     other cards and pushes the bottom nav off-screen. Clamping the row to the
     grid's own (flex-allocated) height lets each card's .checklist scroll
     internally instead, via its existing flex:1; min-height:0; overflow-y:auto. */
  .summary {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    grid-template-rows: minmax(0, 1fr);
    gap: 24px;
    flex: 1;
    min-height: 0;
  }
  .sum {
    padding: 28px;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .sum-head {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
  }
  .tile {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .sum-title {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 28px;
    color: var(--ink);
  }
  .checklist {
    display: flex;
    flex-direction: column;
    gap: 14px;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
  .crow {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 0;
    background: transparent;
    border: none;
    text-align: left;
    font: inherit;
    cursor: pointer;
  }
  .cb {
    width: 30px;
    height: 30px;
    border-radius: 999px;
    border: 2.5px solid #d6dce5;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .cb.done {
    background: var(--good);
    border-color: var(--good);
  }
  .ctext {
    font-size: 21px;
    color: var(--ink);
  }
  .ctext.done {
    color: var(--ink-faint);
    text-decoration: line-through;
  }
  .sum-foot {
    margin-top: auto;
    padding-top: 20px;
    font-size: 16px;
    font-weight: 600;
    color: var(--ink-faint);
  }

  .meal-tap {
    display: block;
    width: 100%;
    padding: 0;
    background: transparent;
    border: none;
    text-align: left;
    font: inherit;
    cursor: pointer;
  }
  .meal-tap:disabled {
    cursor: default;
  }
  .meal-photo {
    border-radius: 18px;
    overflow: hidden;
    height: 150px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: repeating-linear-gradient(45deg, #eef1f6, #eef1f6 10px, #f7f9fc 10px, #f7f9fc 20px);
  }
  .meal-photo span {
    font-family: ui-monospace, monospace;
    font-size: 14px;
    color: var(--ink-faint);
  }
  .meal-photo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .meal-slot {
    margin-top: 16px;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  .meal-dish {
    font-size: 21px;
    font-weight: 600;
    color: var(--ink);
    margin-top: 4px;
  }
</style>
