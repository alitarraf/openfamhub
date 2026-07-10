<script>
  // Full-screen lockdown shown while babysitter mode is active. Displays the
  // emergency info a sitter needs and seals off the dashboard — the only way
  // out is a parent's PIN. State is global/server-side (babysitter.svelte.js),
  // so this also survives a kiosk reload. Editing the info happens in the PWA,
  // never here.
  import Icon from './Icon.svelte';
  import AvatarChip from './AvatarChip.svelte';
  import { babysitterInfo, exitBabysitter } from '../babysitter.svelte.js';

  const info = $derived(babysitterInfo());
  const isEmpty = $derived(!info.notes && !info.contacts.length && !info.parents.some((p) => p.phone));

  // 'info' = the emergency card · 'exit' = the parent PIN pad.
  let mode = $state('info');
  let picked = $state(null);
  let pin = $state('');
  let pinError = $state('');
  let submitting = $state(false);

  function toExit() {
    mode = 'exit';
    picked = null;
    pin = '';
    pinError = '';
  }
  function toInfo() {
    mode = 'info';
    picked = null;
    pin = '';
    pinError = '';
  }
  function pick(p) {
    picked = p;
    pin = '';
    pinError = '';
  }
  function pressDigit(d) {
    if (pin.length >= 4 || submitting) return;
    pin += d;
    if (pin.length === 4) submit();
  }
  function backspace() {
    pin = pin.slice(0, -1);
  }
  async function submit() {
    submitting = true;
    pinError = '';
    const result = await exitBabysitter(picked.id, pin);
    // On success the store flips `active` off and this overlay unmounts.
    if (!result.ok) {
      pinError = result.error;
      pin = '';
    }
    submitting = false;
  }
</script>

<div class="babysitter">
  {#if mode === 'info'}
    <div class="card">
      <header>
        <div class="badge"><Icon name="escalator_warning" size={34} fill color="var(--gold)" /></div>
        <div>
          <div class="title">Babysitter mode</div>
          <div class="subtitle">Emergency info & who to call</div>
        </div>
      </header>

      <div class="body">
        {#if isEmpty}
          <div class="empty">
            <Icon name="contact_phone" size={44} color="var(--ink-faint)" />
            <div class="empty-title">No emergency info yet</div>
            <div class="empty-sub">A parent can add phone numbers and notes from the family app.</div>
          </div>
        {:else}
          {#if info.parents.some((p) => p.phone)}
            <div class="section">Parents</div>
            <div class="parents">
              {#each info.parents as p}
                <div class="parent" class:missing={!p.phone}>
                  <AvatarChip id={p.id} name={p.name} color={p.color} size={56} showName={false} />
                  <div class="ptext">
                    <div class="pname">{p.name}</div>
                    <div class="pphone">{p.phone || 'No number set'}</div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}

          {#if info.contacts.length}
            <div class="section">Emergency contacts</div>
            <div class="contacts">
              {#each info.contacts as c}
                <div class="contact">
                  <div class="cname">{c.name}</div>
                  <div class="cphone">{c.phone}</div>
                </div>
              {/each}
            </div>
          {/if}

          {#if info.notes}
            <div class="section">Notes</div>
            <div class="notes">{info.notes}</div>
          {/if}
        {/if}
      </div>

      <button class="exit" onclick={toExit}>
        <Icon name="lock" size={20} color="var(--ink-soft)" /> Return to dashboard
      </button>
    </div>
  {:else}
    <div class="card pinpad">
      <button class="back" onclick={toInfo}>
        <Icon name="chevron_left" size={22} color="var(--ink-soft)" /> Back
      </button>
      {#if !picked}
        <Icon name="lock" size={44} color="var(--ink-faint)" />
        <div class="lock-title">A parent's PIN unlocks the wall</div>
        <div class="lock-sub">Only a parent can leave babysitter mode.</div>
        {#if info.parents.length}
          <div class="members">
            {#each info.parents as p}
              <button class="member" onclick={() => pick(p)}>
                <AvatarChip id={p.id} name={p.name} color={p.color} size={72} showName={false} />
                <span>{p.name}</span>
              </button>
            {/each}
          </div>
        {:else}
          <div class="no-parents">
            No parent account is set up to unlock this wall. Set
            <code>BUDGET_UNLOCK_MEMBERS</code> to a member with a PIN, then reload.
          </div>
        {/if}
      {:else}
        <AvatarChip id={picked.id} name={picked.name} color={picked.color} size={72} showName={false} />
        <div class="lock-title">Enter PIN for {picked.name}</div>
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
  {/if}
</div>

<style>
  .babysitter {
    position: fixed;
    inset: 0;
    z-index: 260;
    background: var(--bg);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px;
  }
  .card {
    background: var(--surface);
    border-radius: 32px;
    box-shadow: var(--shadow);
    width: 100%;
    max-width: 760px;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  header {
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 32px 40px 20px;
  }
  .badge {
    width: 68px;
    height: 68px;
    border-radius: 20px;
    background: var(--bg);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .title {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 34px;
    color: var(--ink);
  }
  .subtitle {
    font-size: 18px;
    color: var(--ink-faint);
    margin-top: 2px;
  }
  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 8px 40px 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .section {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink-faint);
    margin-top: 16px;
  }
  .parents {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .parent {
    display: flex;
    align-items: center;
    gap: 16px;
    background: var(--bg);
    border-radius: 20px;
    padding: 16px 20px;
  }
  .pname {
    font-size: 22px;
    font-weight: 600;
    color: var(--ink);
  }
  .pphone {
    font-family: var(--font-display);
    font-size: 30px;
    font-weight: 600;
    color: var(--ink);
    letter-spacing: 0.01em;
  }
  .parent.missing .pphone {
    font-family: inherit;
    font-size: 17px;
    font-weight: 500;
    color: var(--ink-faint);
  }
  .contacts {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .contact {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 4px;
    border-bottom: 1px solid var(--hairline-2);
  }
  .cname {
    font-size: 21px;
    font-weight: 600;
    color: var(--ink);
  }
  .cphone {
    font-family: var(--font-display);
    font-size: 26px;
    font-weight: 600;
    color: var(--ink);
    white-space: nowrap;
  }
  .notes {
    font-size: 20px;
    line-height: 1.5;
    color: var(--ink);
    white-space: pre-wrap;
    background: var(--bg);
    border-radius: 20px;
    padding: 20px 22px;
  }
  .empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 48px;
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
  .exit {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin: 0 40px 32px;
    padding: 18px;
    border: none;
    border-radius: 999px;
    background: var(--bg);
    box-shadow: var(--shadow-press);
    font-family: inherit;
    font-size: 19px;
    font-weight: 700;
    color: var(--ink-soft);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .pinpad {
    align-items: center;
    padding: 32px 40px 40px;
    gap: 14px;
    text-align: center;
  }
  .back {
    align-self: flex-start;
    display: flex;
    align-items: center;
    border: none;
    background: none;
    font-size: 16px;
    font-weight: 600;
    color: var(--ink-soft);
    cursor: pointer;
    padding: 4px;
    margin-bottom: 8px;
  }
  .lock-title {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 26px;
    color: var(--ink-soft);
  }
  .lock-sub {
    font-size: 17px;
    color: var(--ink-faint);
  }
  .members {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 24px;
    margin-top: 12px;
  }
  .no-parents {
    max-width: 420px;
    margin-top: 8px;
    font-size: 16px;
    line-height: 1.5;
    color: var(--ink-faint);
  }
  .no-parents code {
    font-family: inherit;
    font-weight: 700;
    color: var(--ink-soft);
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
    font-size: 16px;
    font-weight: 600;
    color: var(--ink);
  }
  .dots {
    display: flex;
    gap: 14px;
    margin-top: 6px;
  }
  .dot {
    width: 16px;
    height: 16px;
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
    font-size: 15px;
  }
  .keypad {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
    width: 100%;
    max-width: 300px;
    margin-top: 8px;
  }
  .key {
    aspect-ratio: 1;
    border-radius: 999px;
    border: none;
    background: var(--bg);
    box-shadow: var(--shadow-press);
    font-size: 26px;
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
