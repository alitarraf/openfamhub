<script>
  // On-device settings — sleep schedule + screensaver timings, behind the
  // same parent PIN gate as Budget (one unlock covers both — see auth.js).
  // Values persist server-side (SQLite settings store) and broadcast over
  // /api/live so every wall/PWA re-applies without a reload.
  import Icon from '../components/Icon.svelte';
  import AvatarChip from '../components/AvatarChip.svelte';
  import { getSettings, saveSettings, unlockBudget } from '../api.js';
  import { members } from '../roster.svelte.js';
  import { refreshTick } from '../refresh.svelte.js';

  // Field metadata mirrors the server whitelist (server/settings/index.js).
  const FIELDS = [
    { key: 'sleepStartHour', label: 'Sleep starts', unit: 'h', min: 0, max: 23, hint: 'Wall blacks out at this hour' },
    { key: 'sleepEndHour', label: 'Sleep ends', unit: 'h', min: 0, max: 23, hint: 'Wall wakes at this hour' },
    {
      key: 'screensaverIdleMin',
      label: 'Screensaver after',
      unit: 'min',
      min: 1,
      max: 120,
      hint: 'Idle time before the photo slideshow'
    },
    {
      key: 'screensaverCycleSec',
      label: 'Photo changes every',
      unit: 's',
      min: 5,
      max: 300,
      hint: 'Slideshow interval'
    }
  ];

  // Scheduled-notification kill-switches (0/1 server-side) — "the reminders
  // got annoying" should be a tap here, not an .env edit.
  const TOGGLES = [
    { key: 'pushChoreReminder', label: 'Chore reminder', hint: "Morning push to the parents' phones" },
    { key: 'pushDinnerDigest', label: 'Dinner digest', hint: 'Afternoon "what’s for dinner" push' }
  ];

  // Just-for-fun toggles (0/1 server-side). Kept separate from Notifications so
  // its "stops the scheduled pushes" copy doesn't wrongly apply.
  const FUN = [
    { key: 'celebrateChores', label: 'Chore celebrations', hint: 'Confetti + a chime when a kid finishes a chore' }
  ];

  const DEFAULTS = {
    sleepStartHour: 22,
    sleepEndHour: 7,
    screensaverIdleMin: 3,
    screensaverCycleSec: 20,
    pushChoreReminder: 1,
    pushDinnerDigest: 1,
    celebrateChores: 1
  };

  // Same locked-first pattern as BudgetScreen: never flash editable values
  // before the server has said this session is actually unlocked.
  let locked = $state(true);
  let values = $state({ ...DEFAULTS });
  let dirty = $state(false);
  let saved = $state(false);
  let saveError = $state('');

  let picked = $state(null);
  let pin = $state('');
  let pinError = $state('');
  let submitting = $state(false);

  function hydrate() {
    getSettings(DEFAULTS)
      .then((s) => {
        locked = false;
        // Don't clobber in-flight edits when the heartbeat refetches.
        if (!dirty) values = { ...s };
      })
      .catch((err) => {
        if (err.locked) locked = true;
      });
  }

  $effect(() => {
    refreshTick(); // re-run on each heartbeat — also re-checks the 15-min unlock expiry
    hydrate();
  });

  function step(key, delta) {
    const f = FIELDS.find((x) => x.key === key);
    const next = values[key] + delta;
    if (next < f.min || next > f.max) return;
    values = { ...values, [key]: next };
    dirty = true;
    saved = false;
    saveError = '';
  }

  function flip(key) {
    values = { ...values, [key]: values[key] ? 0 : 1 };
    dirty = true;
    saved = false;
    saveError = '';
  }

  async function save() {
    saveError = '';
    const result = await saveSettings(values);
    if (result.ok) {
      values = { ...result.settings };
      dirty = false;
      saved = true;
    } else if (result.locked) {
      locked = true;
    } else {
      saveError = result.error;
    }
  }

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
      hydrate();
    } else {
      pinError = result.error;
      pin = '';
    }
    submitting = false;
  }
</script>

<div class="screen">
  <div class="card appbar">
    <div class="title">Settings</div>
  </div>

  {#if locked}
    <div class="card lock-state">
      {#if !picked}
        <Icon name="lock" size={48} color="var(--ink-faint)" />
        <div class="empty-title">Settings are locked</div>
        <div class="empty-sub">A parent's PIN unlocks them for a bit.</div>
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
    <div class="card body">
      <div class="section">Display</div>
      {#each FIELDS as f}
        <div class="row">
          <div class="rtext">
            <div class="rlabel">{f.label}</div>
            <div class="rhint">{f.hint}</div>
          </div>
          <div class="stepper">
            <button
              class="stepbtn"
              onclick={() => step(f.key, -1)}
              disabled={values[f.key] <= f.min}
              aria-label="Decrease"
            >
              <Icon name="remove" size={26} color="var(--ink-soft)" />
            </button>
            <span class="val">{values[f.key]}<span class="unit">{f.unit}</span></span>
            <button
              class="stepbtn"
              onclick={() => step(f.key, 1)}
              disabled={values[f.key] >= f.max}
              aria-label="Increase"
            >
              <Icon name="add" size={26} color="var(--ink-soft)" />
            </button>
          </div>
        </div>
      {/each}

      <div class="section notif">Notifications</div>
      {#each TOGGLES as t}
        <div class="row">
          <div class="rtext">
            <div class="rlabel">{t.label}</div>
            <div class="rhint">{t.hint}</div>
          </div>
          <button
            class="switch"
            class:on={values[t.key] === 1}
            onclick={() => flip(t.key)}
            role="switch"
            aria-checked={values[t.key] === 1}
            aria-label={t.label}
          >
            <span class="knob"></span>
          </button>
        </div>
      {/each}
      <div class="rhint">
        These stop the scheduled pushes for everyone. Each phone's bell (in the mobile app) controls only that phone.
      </div>

      <div class="section">Fun</div>
      {#each FUN as t}
        <div class="row">
          <div class="rtext">
            <div class="rlabel">{t.label}</div>
            <div class="rhint">{t.hint}</div>
          </div>
          <button
            class="switch"
            class:on={values[t.key] === 1}
            onclick={() => flip(t.key)}
            role="switch"
            aria-checked={values[t.key] === 1}
            aria-label={t.label}
          >
            <span class="knob"></span>
          </button>
        </div>
      {/each}

      <div class="foot">
        {#if saveError}<span class="pin-error">{saveError}</span>{/if}
        {#if saved}<span class="saved"><Icon name="check" size={18} fill color="var(--good)" /> Saved</span>{/if}
        <button class="savebtn" onclick={save} disabled={!dirty}>Save</button>
      </div>
      <div class="note">
        Deeper config (family roster, data sources, tokens) lives in <code>.env</code> and
        <code>config/members.json</code>.
      </div>
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

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 28px 36px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .section {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 14px 0;
    border-bottom: 1px solid var(--hairline-2);
  }
  .rlabel {
    font-size: 22px;
    font-weight: 600;
    color: var(--ink);
  }
  .rhint {
    font-size: 15px;
    color: var(--ink-faint);
    margin-top: 2px;
  }
  .stepper {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .stepbtn {
    width: 56px;
    height: 56px;
    border-radius: 999px;
    border: none;
    background: var(--bg);
    box-shadow: var(--shadow-press);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .stepbtn:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .section.notif {
    margin-top: 18px;
  }
  .switch {
    width: 76px;
    height: 44px;
    border-radius: 999px;
    border: none;
    background: var(--hairline);
    padding: 4px;
    display: flex;
    align-items: center;
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .switch.on {
    background: var(--good);
    justify-content: flex-end;
  }
  .knob {
    width: 36px;
    height: 36px;
    border-radius: 999px;
    background: #fff;
    box-shadow: var(--shadow-press);
  }
  .val {
    min-width: 96px;
    text-align: center;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 34px;
    color: var(--ink);
  }
  .unit {
    font-size: 18px;
    color: var(--ink-faint);
    margin-left: 4px;
  }

  .foot {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 16px;
    margin-top: 8px;
  }
  .saved {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 16px;
    font-weight: 700;
    color: var(--good);
  }
  .savebtn {
    border: none;
    border-radius: 999px;
    background: var(--gold);
    color: #fff;
    font-family: inherit;
    font-size: 19px;
    font-weight: 700;
    padding: 14px 36px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .savebtn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .note {
    font-size: 15px;
    color: var(--ink-faint);
    margin-top: auto;
    padding-top: 16px;
  }
  .note code {
    font-family: ui-monospace, monospace;
    font-size: 14px;
    background: var(--bg);
    padding: 2px 6px;
    border-radius: 6px;
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
    background: var(--gold);
    border-color: var(--gold);
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
</style>
