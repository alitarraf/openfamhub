<script>
  import { onMount } from 'svelte';
  import Frame from './lib/Frame.svelte';
  import BottomTabBar from './lib/components/BottomTabBar.svelte';
  import HomeScreen from './lib/screens/HomeScreen.svelte';
  import CalendarScreen from './lib/screens/CalendarScreen.svelte';
  import TasksChoreScreen from './lib/screens/TasksChoreScreen.svelte';
  import TasksRewardScreen from './lib/screens/TasksRewardScreen.svelte';
  import TasksTodoScreen from './lib/screens/TasksTodoScreen.svelte';
  import TasksProfileScreen from './lib/screens/TasksProfileScreen.svelte';
  import MealsScreen from './lib/screens/MealsScreen.svelte';
  import BudgetScreen from './lib/screens/BudgetScreen.svelte';
  import JournalScreen from './lib/screens/JournalScreen.svelte';
  import SettingsScreen from './lib/screens/SettingsScreen.svelte';

  import { hydrateAvatars } from './lib/avatars.svelte.js';
  import { hydrateRoster } from './lib/roster.svelte.js';
  import { startRefresh } from './lib/refresh.svelte.js';
  import { startLive } from './lib/live.js';
  import { startSleepSchedule, isAsleep, manualSleep } from './lib/sleep.svelte.js';
  import { startScreensaverIdleWatch, isScreensaverActive, forceScreensaver } from './lib/screensaver.svelte.js';
  import SleepOverlay from './lib/components/SleepOverlay.svelte';
  import ScreensaverOverlay from './lib/components/ScreensaverOverlay.svelte';
  import BabysitterOverlay from './lib/components/BabysitterOverlay.svelte';
  import { startBabysitter, isBabysitterLocked, enterBabysitter } from './lib/babysitter.svelte.js';
  import CelebrationLayer from './lib/components/CelebrationLayer.svelte';
  import { reloadCelebrateConfig, primeAudio } from './lib/celebrate.js';

  let app = $state('home'); // home | calendar | tasks | meals
  let tasksTab = $state('chore'); // profile | todo | chore | reward
  // Set when Home's meal card is tapped, so MealsScreen (already mounted —
  // see the .pane comment below) knows which recipe to jump straight to.
  let mealsOpenSlug = $state(null);
  // Same pattern for Home's calendar hero: tapping a day jumps CalendarScreen
  // straight to that day; tapping "Next two weeks" jumps to month view on
  // today. { date, view } — date is null for the month-view request (anchor
  // resets to today rather than wherever Calendar was last left).
  let calendarRequest = $state(null);

  function onHomeQuickAction(action) {
    if (action === 'sleep') manualSleep();
    else if (action === 'screensaver') forceScreensaver();
    // One tap drops the wall into the babysitter lockdown (a parent on their
    // way out); leaving it needs a parent PIN — see BabysitterOverlay.
    else if (action === 'babysitter') enterBabysitter();
    // Settings isn't a bottom tab — the Home gear opens it, any tab press leaves it.
    else if (action === 'settings') app = 'settings';
  }

  function onHomeOpenMeal(slug) {
    if (!slug) return;
    mealsOpenSlug = slug;
    app = 'meals';
  }

  function onHomeOpenDay(date) {
    calendarRequest = { date, view: 'day' };
    app = 'calendar';
  }

  function onHomeOpenMonth() {
    calendarRequest = { date: null, view: 'month' };
    app = 'calendar';
  }

  onMount(() => {
    // Pull the live family roster once — any size, not just the bundled demo's
    // four. Screens reconcile their own per-member state to it as it lands
    // (see roster.svelte.js's syncListToRoster). Falls back to mock, never blocks.
    hydrateRoster();
    // Pull per-member photos from Todoist once; chips fall back to monograms
    // until (and if) this lands. Cosmetic — never blocks render.
    hydrateAvatars();
    // Start the shared heartbeat so every (kept-alive) screen re-hydrates
    // periodically instead of going stale until the kiosk reloads.
    startRefresh();
    // Live updates: a write on any device shows up here in under a second
    // (SSE); the heartbeat above remains the fallback when the stream drops.
    startLive();
    // Scheduled/manual sleep (blackout) and idle screensaver (clock banner).
    startSleepSchedule();
    startScreensaverIdleWatch();
    // Babysitter lock state (global, server-side) — reload-proof: if the wall
    // was left locked, a reboot/reload lands right back in the lockdown.
    startBabysitter();
    // Kid chore-celebration on/off (re-read live on 'settings' — see live.js).
    reloadCelebrateConfig();
    // Unlock WebAudio on the first tap (browsers require a gesture) so the
    // celebration chime can play without a further interaction.
    window.addEventListener('pointerdown', primeAudio, { once: true });
  });
</script>

<Frame>
  <div class="app">
    <!-- All screens stay mounted; only the active one is shown (display:none
         otherwise). This kills the mock→live flash on tab switch — a screen is
         only hydrated once (its onMount fires at startup) and keeps its live
         $state instead of remounting to mock every time. -->
    <div class="view">
      <div class="pane" class:active={app === 'home'}>
        <HomeScreen
          onQuickAction={onHomeQuickAction}
          onOpenMeal={onHomeOpenMeal}
          onOpenDay={onHomeOpenDay}
          onOpenMonth={onHomeOpenMonth}
        />
      </div>
      <div class="pane" class:active={app === 'calendar'}>
        <CalendarScreen openRequest={calendarRequest} onOpenRequestConsumed={() => (calendarRequest = null)} />
      </div>
      <div class="pane" class:active={app === 'tasks' && tasksTab === 'chore'}>
        <TasksChoreScreen onSubTab={(t) => (tasksTab = t)} />
      </div>
      <div class="pane" class:active={app === 'tasks' && tasksTab === 'todo'}>
        <TasksTodoScreen onSubTab={(t) => (tasksTab = t)} />
      </div>
      <div class="pane" class:active={app === 'tasks' && tasksTab === 'reward'}>
        <TasksRewardScreen onSubTab={(t) => (tasksTab = t)} />
      </div>
      <div class="pane" class:active={app === 'tasks' && tasksTab === 'profile'}>
        <TasksProfileScreen onSubTab={(t) => (tasksTab = t)} />
      </div>
      <div class="pane" class:active={app === 'meals'}>
        <MealsScreen openSlug={mealsOpenSlug} onOpenSlugConsumed={() => (mealsOpenSlug = null)} />
      </div>
      <div class="pane" class:active={app === 'budget'}>
        <BudgetScreen />
      </div>
      <div class="pane" class:active={app === 'journal'}>
        <JournalScreen />
      </div>
      <div class="pane" class:active={app === 'settings'}>
        <SettingsScreen />
      </div>
    </div>
    <BottomTabBar scale="wall" active={app} onSelect={(id) => (app = id)} />
  </div>
  <!-- Confetti canvas: always mounted, paints only during a burst, sits below
       the full-screen overlays (see its z-index). -->
  <CelebrationLayer />
  {#if isBabysitterLocked()}<BabysitterOverlay />{/if}
  {#if isScreensaverActive()}<ScreensaverOverlay />{/if}
  {#if isAsleep()}<SleepOverlay />{/if}
</Frame>

<style>
  .app {
    height: 100%;
    padding: 40px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .view {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  /* Every screen is mounted; only the active pane takes layout space. */
  .pane {
    display: none;
    flex: 1;
    min-height: 0;
    flex-direction: column;
  }
  .pane.active {
    display: flex;
  }
</style>
