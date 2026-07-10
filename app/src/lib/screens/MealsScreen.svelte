<script>
  import Icon from '../components/Icon.svelte';
  import TaskRow from '../components/TaskRow.svelte';
  import { fmtWeekRange, WEEKDAYS, MONTHS, WEEKDAY_NAMES, mealsForWeek } from '../calendar.js';
  import {
    getMealPlan,
    getRecipes,
    getRecipe,
    addRecipeToGrocery,
    addRecipeToMealPlan,
    getGroceryList,
    setGroceryItemDone
  } from '../api.js';
  import { dashboard } from '../data/mock.js';
  import { refreshTick, bumpRefresh } from '../refresh.svelte.js';

  // Grocy is dropped (single-app: Mealie only) — no Pantry tab.
  const SUBTABS = ['Meals', 'Recipes', 'Grocery'];
  let sub = $state('Meals');

  // Cross-screen jump: Home's meal-of-the-day card asks to open a recipe by
  // slug (see App.svelte's onHomeOpenMeal). This screen stays mounted the
  // whole time (see App.svelte), so a plain prop won't refire on a repeat tap
  // of the same recipe — App.svelte resets openSlug to null via
  // onOpenSlugConsumed between requests so this effect sees a real change.
  let { openSlug = null, onOpenSlugConsumed } = $props();
  $effect(() => {
    if (openSlug) {
      sub = 'Recipes';
      openRecipe({ slug: openSlug });
      onOpenSlugConsumed?.();
    }
  });

  const iso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // Same 4 slots as the weekly grid (server/sources/mealie.js SLOTS) — Mealie
  // supports more (snack/drink/dessert) but the grid only has these columns.
  const MEAL_SLOTS = [
    { key: 'breakfast', label: 'Breakfast' },
    { key: 'lunch', label: 'Lunch' },
    { key: 'dinner', label: 'Dinner' },
    { key: 'side', label: 'Snack' }
  ];

  // --- Recipes: list → detail. Read-only browse; authoring stays in Mealie's
  // own UI (this app never edits recipes). No mock fallback — a fabricated
  // recipe list would be worse than an empty one (fake ingredients on tap).
  let recipes = $state([]);
  let selectedRecipe = $state(null); // detail object, or null → showing the list
  let addingToGrocery = $state(false);
  let addedToGrocery = $state(false);

  // Add-to-meal-plan picker (date + slot), inline next to the grocery button.
  // Date is a plain Date (day-stepper, matching the week nav's chevron style)
  // rather than a native <input type=date> — that browser-chrome control read
  // as inconsistent with the rest of the design system.
  const fmtPlanDate = (d) =>
    `${WEEKDAY_NAMES[d.getDay()].slice(0, 3)}, ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
  let showPlanPicker = $state(false);
  let planDate = $state(new Date());
  let planSlot = $state('dinner');
  let addingToPlan = $state(false);
  let addedToPlan = $state(false);

  const shiftPlanDate = (n) => {
    const d = new Date(planDate);
    d.setDate(d.getDate() + n);
    planDate = d;
  };

  async function openRecipe(r) {
    addedToGrocery = false;
    showPlanPicker = false;
    addedToPlan = false;
    planDate = new Date();
    planSlot = 'dinner';
    selectedRecipe = await getRecipe(r.slug);
  }

  // Tap a meal-plan grid cell → jump to that recipe's detail (Recipes tab).
  // Only cells backed by a linked Mealie recipe are tappable — a freeform
  // title/text meal-plan entry, or the mock's placeholder names, have no slug.
  function openRecipeFromCell(cell) {
    if (!cell || !cell.slug) return;
    sub = 'Recipes';
    openRecipe(cell);
  }

  async function addSelectedToGrocery() {
    if (!selectedRecipe || addingToGrocery) return;
    addingToGrocery = true;
    const ok = await addRecipeToGrocery(selectedRecipe.id);
    addingToGrocery = false;
    addedToGrocery = ok;
    if (ok) bumpRefresh(); // so the Grocery tab / Home card show the new items now
  }

  async function confirmAddToMealPlan() {
    if (!selectedRecipe || addingToPlan) return;
    addingToPlan = true;
    const ok = await addRecipeToMealPlan(selectedRecipe.id, iso(planDate), planSlot);
    addingToPlan = false;
    addedToPlan = ok;
    if (ok) bumpRefresh(); // so the Meals grid shows the new entry now
  }

  // Re-fetched on every heartbeat while this tab is open, same as the grocery
  // list and meal plan below — a recipe added straight in Mealie's own UI
  // otherwise never appears here, since screens stay mounted for the whole
  // session and a one-shot `recipes.length === 0` guard only ever fires once.
  $effect(() => {
    if (sub === 'Recipes') {
      refreshTick();
      getRecipes().then((list) => (recipes = list));
    }
  });

  // --- Grocery: Mealie's single shopping list. Checked items stay in the list
  // (struck-through) rather than vanishing on tap — see server/sources/mealie.js.
  let grocery = $state(dashboard.grocery);
  $effect(() => {
    if (sub === 'Grocery') {
      refreshTick(); // re-run on each heartbeat while this tab is open
      getGroceryList(dashboard.grocery).then((g) => (grocery = g));
    }
  });

  async function toggleGroceryItem(it) {
    const next = !it.done;
    it.done = next;
    if (!it.id) return;
    const ok = await setGroceryItemDone(it.id, next);
    if (ok)
      bumpRefresh(); // so Home's Grocery card picks this up now, not next heartbeat
    else it.done = !next;
  }
  let anchor = $state(new Date());
  let week = $derived(mealsForWeek(anchor)); // mock scaffolding: dates + fallback menu
  let range = $derived(fmtWeekRange(week.days.map((d) => d.date)));

  // Live meal plan for the visible week, keyed by local 'YYYY-MM-DD'. Re-fetched
  // on mount, on every refresh heartbeat, and whenever the week changes; falls
  // back to null (→ the mock menu renders) if Mealie is down/unconfigured.
  let livePlan = $state(null);
  $effect(() => {
    refreshTick(); // re-run on each heartbeat
    const dates = week.days.map((d) => d.date);
    getMealPlan(iso(dates[0]), iso(dates[dates.length - 1]), null).then(
      (p) => (livePlan = p && p.days ? p.days : null)
    );
  });

  // A day's 4 slot cells: live if present for that date, else the mock names
  // normalized to the same { title, img } shape (img null → striped placeholder).
  function cellsFor(day) {
    const live = livePlan && livePlan[iso(day.date)];
    if (live) return live;
    return day.meals.map((name) => (name ? { title: name, img: null } : null));
  }

  const hideImg = (e) => (e.currentTarget.style.display = 'none'); // → striped fallback

  const shift = (n) => {
    const d = new Date(anchor);
    d.setDate(d.getDate() + 7 * n);
    anchor = d;
  };
</script>

<div class="screen">
  <!-- header -->
  <div class="card header">
    <div class="title">Meals</div>
    {#if sub === 'Meals'}
      <div class="wnav">
        <button class="wbtn" onclick={() => shift(-1)} aria-label="Previous week"
          ><Icon name="chevron_left" size={30} color="var(--ink-soft)" /></button
        >
        <span class="range">{range}</span>
        <button class="wbtn" onclick={() => shift(1)} aria-label="Next week"
          ><Icon name="chevron_right" size={30} color="var(--ink-soft)" /></button
        >
      </div>
    {/if}
  </div>

  <!-- sub tabs -->
  <div class="subtabs">
    {#each SUBTABS as t}
      <button class="chip" class:on={t === sub} onclick={() => (sub = t)}>{t}</button>
    {/each}
  </div>

  {#if sub === 'Meals'}
    <div class="card grid">
      <div class="ghead">
        <div></div>
        {#each week.slots as s}<div class="slot">{s}</div>{/each}
      </div>
      {#each week.days as day, r}
        <div class="drow" class:last={r === week.days.length - 1}>
          <div class="daycell">
            <span class="dnum">{day.date.getDate()}</span>
            <span class="ddow">{WEEKDAYS[r]}</span>
          </div>
          {#each cellsFor(day) as cell}
            <button
              class="thumb"
              class:tappable={cell?.slug}
              disabled={!cell?.slug}
              onclick={() => openRecipeFromCell(cell)}
            >
              {#if cell}
                {#if cell.img}
                  <img class="thumb-img" src={cell.img} alt="" loading="lazy" onerror={hideImg} />
                {/if}
                <div class="thumb-name">{cell.title}</div>
              {/if}
            </button>
          {/each}
        </div>
      {/each}
    </div>
  {:else if sub === 'Recipes'}
    {#if selectedRecipe}
      <div class="card detail">
        <button class="back" onclick={() => (selectedRecipe = null)}>
          <Icon name="chevron_left" size={26} color="var(--ink-soft)" /> Recipes
        </button>
        <div class="d-head">
          <div class="d-thumb">
            {#if selectedRecipe.img}
              <img src={selectedRecipe.img} alt="" onerror={hideImg} />
            {/if}
          </div>
          <div class="d-meta">
            <div class="d-title">{selectedRecipe.title}</div>
            <div class="d-sub">
              {#if selectedRecipe.servings}{selectedRecipe.servings} servings{/if}
              {#if selectedRecipe.time}· {selectedRecipe.time}{/if}
            </div>
            <div class="d-actions">
              <button class="add-btn" onclick={addSelectedToGrocery} disabled={addingToGrocery}>
                <Icon name="shopping_cart" size={20} color="#fff" />
                {addedToGrocery ? 'Added!' : addingToGrocery ? 'Adding…' : 'Add to grocery list'}
              </button>
              <button class="add-btn plan-btn" onclick={() => (showPlanPicker = !showPlanPicker)}>
                <Icon name="event" size={20} color="#fff" />
                {addedToPlan ? 'Added!' : 'Add to meal plan'}
              </button>
            </div>
            {#if showPlanPicker}
              <div class="plan-picker">
                <div class="plan-daystep">
                  <button class="wbtn sm" onclick={() => shiftPlanDate(-1)} aria-label="Previous day">
                    <Icon name="chevron_left" size={22} color="var(--ink-soft)" />
                  </button>
                  <span class="plan-date">{fmtPlanDate(planDate)}</span>
                  <button class="wbtn sm" onclick={() => shiftPlanDate(1)} aria-label="Next day">
                    <Icon name="chevron_right" size={22} color="var(--ink-soft)" />
                  </button>
                </div>
                <div class="plan-slots">
                  {#each MEAL_SLOTS as s}
                    <button class="chip sm" class:on={planSlot === s.key} onclick={() => (planSlot = s.key)}
                      >{s.label}</button
                    >
                  {/each}
                </div>
                <button class="plan-confirm" onclick={confirmAddToMealPlan} disabled={addingToPlan}>
                  {addingToPlan ? 'Adding…' : 'Confirm'}
                </button>
              </div>
            {/if}
          </div>
        </div>
        <div class="d-body">
          <div class="d-col">
            <div class="d-h">Ingredients</div>
            <ul>
              {#each selectedRecipe.ingredients as ing}<li>{ing}</li>{/each}
            </ul>
          </div>
          <div class="d-col d-col-wide">
            <div class="d-h">Instructions</div>
            <ol>
              {#each selectedRecipe.instructions as step}<li>{step}</li>{/each}
            </ol>
          </div>
        </div>
      </div>
    {:else if recipes.length === 0}
      <div class="card placeholder">
        <Icon name="restaurant_menu" size={56} color="var(--ink-faint)" />
        <div class="ph-title">No recipes yet</div>
        <div class="ph-sub">Add some in Mealie and they'll show up here.</div>
      </div>
    {:else}
      <div class="card rgrid">
        {#each recipes as r}
          <button class="rcard" onclick={() => openRecipe(r)}>
            <div class="rthumb">
              {#if r.img}<img src={r.img} alt="" loading="lazy" onerror={hideImg} />{/if}
            </div>
            <div class="rname">{r.title}</div>
            {#if r.time}<div class="rtime">{r.time}</div>{/if}
          </button>
        {/each}
      </div>
    {/if}
  {:else}
    <div class="card grocery">
      {#if grocery.items.length === 0}
        <div class="placeholder">
          <Icon name="shopping_cart" size={56} color="var(--ink-faint)" />
          <div class="ph-title">Grocery list is empty</div>
        </div>
      {:else}
        {#each grocery.items as it}
          <TaskRow title={it.title} icon="shopping_cart" done={it.done} onToggle={() => toggleGroceryItem(it)} />
        {/each}
      {/if}
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
  .card {
    background: var(--surface);
    border-radius: 28px;
    box-shadow: var(--shadow);
  }

  .header {
    padding: 26px 36px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .title {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 44px;
    color: var(--ink);
  }
  .wnav {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .wbtn {
    width: 56px;
    height: 56px;
    border: none;
    border-radius: 999px;
    background: var(--bg);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .range {
    font-family: var(--font-display);
    font-size: 26px;
    color: var(--ink);
    font-weight: 500;
  }

  .subtabs {
    display: flex;
    gap: 10px;
  }
  .chip {
    padding: 14px 28px;
    border-radius: 999px;
    font-size: 20px;
    font-weight: 600;
    color: var(--ink-soft);
    background: var(--surface);
    box-shadow: var(--shadow);
    border: none;
    cursor: pointer;
  }
  .chip.on {
    font-weight: 700;
    color: #fff;
    background: var(--ink);
    box-shadow: none;
  }

  .grid {
    flex: 1;
    min-height: 0;
    padding: 24px 28px;
    display: flex;
    flex-direction: column;
  }
  .ghead {
    display: grid;
    grid-template-columns: 90px repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 12px;
  }
  .slot {
    text-align: center;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  .drow {
    display: grid;
    grid-template-columns: 90px repeat(4, 1fr);
    gap: 12px;
    align-items: stretch;
    padding: 8px 0;
    border-bottom: 1px solid var(--hairline-2);
    flex: 1;
  }
  .drow.last {
    border-bottom: none;
  }
  .daycell {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding-right: 6px;
  }
  .dnum {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 32px;
    color: var(--ink);
  }
  .ddow {
    font-size: 15px;
    font-weight: 600;
    color: var(--ink-faint);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .thumb {
    border: none;
    padding: 0;
    margin: 0;
    font: inherit;
    border-radius: 14px;
    overflow: hidden;
    position: relative;
    display: flex;
    align-items: flex-end;
    cursor: default;
    background: repeating-linear-gradient(45deg, #eef1f6, #eef1f6 9px, #f7f9fc 9px, #f7f9fc 18px);
  }
  .thumb.tappable {
    cursor: pointer;
  }
  .thumb.tappable:active {
    opacity: 0.85;
  }
  .thumb-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .thumb-name {
    position: relative;
    z-index: 1;
    width: 100%;
    background: rgba(255, 255, 255, 0.82);
    padding: 8px 10px;
    font-size: 15px;
    font-weight: 600;
    color: #3d4757;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .placeholder {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }
  .ph-title {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 32px;
    color: var(--ink);
  }
  .ph-sub {
    font-size: 18px;
    color: var(--ink-soft);
  }

  /* Recipes: card grid */
  .rgrid {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 24px 28px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    align-content: start;
    gap: 18px;
  }
  .rcard {
    border: none;
    background: var(--bg);
    border-radius: 18px;
    overflow: hidden;
    cursor: pointer;
    text-align: left;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  .rthumb {
    aspect-ratio: 4/3;
    background: repeating-linear-gradient(45deg, #eef1f6, #eef1f6 9px, #f7f9fc 9px, #f7f9fc 18px);
  }
  .rthumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .rname {
    padding: 12px 14px 2px;
    font-weight: 700;
    font-size: 17px;
    color: var(--ink);
  }
  .rtime {
    padding: 0 14px 12px;
    font-size: 14px;
    color: var(--ink-faint);
  }

  /* Recipes: detail view */
  .detail {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 20px 32px 32px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .back {
    align-self: flex-start;
    display: flex;
    align-items: center;
    gap: 4px;
    border: none;
    background: none;
    cursor: pointer;
    font-size: 18px;
    font-weight: 600;
    color: var(--ink-soft);
    padding: 4px;
  }
  .d-head {
    display: flex;
    gap: 24px;
    align-items: flex-start;
  }
  .d-thumb {
    flex: none;
    width: 220px;
    aspect-ratio: 4/3;
    border-radius: 18px;
    overflow: hidden;
    background: repeating-linear-gradient(45deg, #eef1f6, #eef1f6 9px, #f7f9fc 9px, #f7f9fc 18px);
  }
  .d-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .d-meta {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .d-title {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 32px;
    color: var(--ink);
  }
  .d-sub {
    font-size: 17px;
    color: var(--ink-faint);
    display: flex;
    gap: 6px;
  }
  .d-actions {
    display: flex;
    gap: 12px;
  }
  .add-btn {
    align-self: flex-start;
    display: flex;
    align-items: center;
    gap: 8px;
    border: none;
    border-radius: 999px;
    padding: 12px 22px;
    background: var(--good);
    color: #fff;
    font-weight: 700;
    font-size: 16px;
    cursor: pointer;
  }
  .add-btn:disabled {
    opacity: 0.7;
    cursor: default;
  }
  .plan-btn {
    background: var(--person);
  }
  .plan-picker {
    display: flex;
    align-items: center;
    gap: 20px;
    flex-wrap: wrap;
    background: var(--bg);
    border-radius: 20px;
    padding: 16px 20px;
  }
  .plan-daystep {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .wbtn.sm {
    width: 40px;
    height: 40px;
  }
  .plan-date {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--ink);
    min-width: 108px;
    text-align: center;
  }
  .plan-slots {
    display: flex;
    gap: 8px;
  }
  .chip.sm {
    padding: 9px 16px;
    font-size: 15px;
  }
  .plan-confirm {
    border: none;
    border-radius: 999px;
    padding: 10px 24px;
    background: var(--ink);
    color: #fff;
    font-weight: 700;
    font-size: 15px;
    cursor: pointer;
    margin-left: auto;
  }
  .plan-confirm:disabled {
    opacity: 0.7;
    cursor: default;
  }
  .d-body {
    display: flex;
    gap: 32px;
  }
  .d-col {
    flex: 1;
  }
  .d-col-wide {
    flex: 2;
  }
  .d-h {
    font-weight: 700;
    font-size: 16px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ink-faint);
    margin-bottom: 10px;
  }
  .d-col ul,
  .d-col ol {
    margin: 0;
    padding-left: 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .d-col li {
    font-size: 17px;
    color: var(--ink);
    line-height: 1.4;
  }

  /* Grocery */
  .grocery {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
</style>
