<script>
  // Companion PWA — /m. Chores (view + complete) and Journal (browse + add
  // entries) — the PRD's fuller mobile scope (calendar/agenda, rewards,
  // meals/grocery) stays deferred. A separate purpose-built page, not a
  // reflow of the wall's screens; the wall's fixed 1080x1920 Frame isn't
  // responsive and reflowing every wall screen is a much bigger job than
  // this narrower scope needs.
  //
  // Journal entry authoring lives here, not on the wall — nothing is
  // authored on-device by design (no on-wall "add a chore" UI either); this
  // is also the one screen in the whole app with actual free-text typing.
  import { onMount } from 'svelte';
  import { members, byId, hydrateRoster } from './lib/roster.svelte.js';
  import { hydrateAvatars } from './lib/avatars.svelte.js';
  import { cat } from './lib/data/mock.js';
  import AvatarChip from './lib/components/AvatarChip.svelte';
  import TaskRow from './lib/components/TaskRow.svelte';
  import Icon from './lib/components/Icon.svelte';

  let stage = $state('loading'); // loading | pick | pin | main
  let picked = $state(null); // the member object being logged in as
  let me = $state(null); // { memberId } once logged in
  let pin = $state('');
  let error = $state('');
  let submitting = $state(false);
  let balance = $state(0);
  let tasks = $state([]);
  let loadingChores = $state(false);

  let tab = $state('chores'); // chores | journal
  // Browser-facing Mealie URL (from /api/config). Blank = no Meals launcher tab.
  let mealieUrl = $state('');
  let journalView = $state('list'); // list | compose
  let entries = $state([]);
  let journalTags = $state([]);
  let loadingJournal = $state(false);
  let tagById = $derived(Object.fromEntries(journalTags.map((t) => [t.id, t])));

  // Composer form state.
  let text = $state('');
  let selectedTag = $state(null);
  let selectedMembers = $state([]);
  let photoFile = $state(null);
  let photoPreview = $state('');
  let posting = $state(false);
  let postError = $state('');

  // --- Babysitter emergency info (parents only) --------------------------
  // A parent edits what the wall shows a sitter in babysitter lockdown:
  // parent phone numbers, emergency contacts, and notes. The "Sitter" tab
  // only appears for parents (whoever's in the babysitter payload's parents
  // list — server-derived from BUDGET_UNLOCK_MEMBERS); a kid's session 403s.
  let sitterInfo = $state({ parents: [], contacts: [], notes: '' });
  let phoneInputs = $state({}); // { memberId: phone }
  let contactRows = $state([]); // [{ name, phone }]
  let notesInput = $state('');
  let savingSitter = $state(false);
  let sitterError = $state('');
  let sitterSaved = $state(false);
  let isParent = $derived(!!me && sitterInfo.parents.some((p) => p.id === me.memberId));

  onMount(async () => {
    hydrateAvatars(); // cosmetic, never blocks — see App.svelte's same call
    // Unlike the wall (App.svelte), this determines who can even log in, so
    // it's awaited rather than fire-and-forget — the picker below must show
    // the real roster, not linger on the mock one.
    await hydrateRoster();
    // Cosmetic, never blocks: learn whether a Mealie launcher tab should show.
    fetch('/api/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => { if (cfg?.mealieUrl) mealieUrl = cfg.mealieUrl; })
      .catch(() => {});
    try {
      const res = await fetch('/api/mobile/me');
      if (res.ok) {
        me = await res.json();
        stage = 'main';
        loadChores();
        loadSitter();
        checkPush();
      } else {
        stage = 'pick';
      }
    } catch {
      stage = 'pick';
    }
  });

  // --- Web push (chore reminder / dinner digest) -------------------------
  // Hidden entirely unless the server has VAPID keys AND the browser exposes
  // the Push API in a secure context (HTTPS via `tailscale serve`, in our
  // deployment) — an inert bell would only invite taps that can't work.
  let pushState = $state('hidden'); // hidden | off | on | busy

  const b64ToBytes = (b64) => {
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  };

  async function checkPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      const res = await fetch('/api/push/status');
      if (!res.ok) return; // 401/503 — logged out or push unconfigured
      const status = await res.json();
      if (!status.configured) return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      pushState = sub ? 'on' : 'off';
    } catch {
      /* stays hidden */
    }
  }

  async function togglePush() {
    if (pushState !== 'on' && pushState !== 'off') return;
    const was = pushState;
    pushState = 'busy';
    try {
      const reg = await navigator.serviceWorker.ready;
      if (was === 'on') {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint })
          });
          await sub.unsubscribe();
        }
        pushState = 'off';
      } else {
        if ((await Notification.requestPermission()) !== 'granted') {
          pushState = 'off';
          return;
        }
        const { key } = await (await fetch('/api/push/vapid-key')).json();
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
        const res = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub.toJSON())
        });
        pushState = res.ok ? 'on' : 'off';
      }
    } catch {
      pushState = was;
    }
  }

  function pick(m) {
    picked = m;
    pin = '';
    error = '';
    stage = 'pin';
  }

  function backToPick() {
    picked = null;
    pin = '';
    error = '';
    stage = 'pick';
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
    error = '';
    try {
      const res = await fetch('/api/mobile/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: picked.id, pin })
      });
      const data = await res.json();
      if (res.ok) {
        me = data;
        stage = 'main';
        loadChores();
        loadSitter();
      } else {
        error = data.error || 'Wrong PIN';
        pin = '';
      }
    } catch {
      error = 'Connection failed';
      pin = '';
    }
    submitting = false;
  }

  async function loadChores() {
    loadingChores = true;
    try {
      const res = await fetch('/api/mobile/chores');
      if (res.ok) {
        const data = await res.json();
        tasks = data.tasks;
        balance = data.balance;
      }
    } catch {
      /* leave whatever's already shown */
    }
    loadingChores = false;
  }

  async function toggle(t) {
    const next = !t.done;
    t.done = next;
    try {
      const res = await fetch(`/api/mobile/chores/${t.id}/${next ? 'close' : 'reopen'}`, { method: 'POST' });
      if (res.ok) {
        balance = (await res.json()).balance;
      } else {
        t.done = !next;
      }
    } catch {
      t.done = !next;
    }
  }

  async function logout() {
    await fetch('/api/mobile/logout', { method: 'POST' }).catch(() => {});
    me = null;
    picked = null;
    tasks = [];
    entries = [];
    tab = 'chores';
    journalView = 'list';
    stage = 'pick';
  }

  function selectTab(t) {
    tab = t;
    if (t === 'journal' && !entries.length && !loadingJournal) loadJournal();
    if (t === 'sitter') loadSitter();
  }

  // Load the babysitter info + seed the editor form. Public read; also tells
  // us who the parents are (drives whether the Sitter tab shows at all).
  async function loadSitter() {
    try {
      const res = await fetch('/api/babysitter');
      if (!res.ok) return;
      const data = await res.json();
      sitterInfo = data;
      phoneInputs = Object.fromEntries(data.parents.map((p) => [p.id, p.phone || '']));
      contactRows = data.contacts.map((c) => ({ ...c }));
      notesInput = data.notes || '';
    } catch {
      /* leave the form as-is; nothing to seed */
    }
  }

  function addContact() {
    contactRows = [...contactRows, { name: '', phone: '' }];
    sitterSaved = false;
  }
  function removeContact(i) {
    contactRows = contactRows.filter((_, idx) => idx !== i);
    sitterSaved = false;
  }

  async function saveSitter() {
    savingSitter = true;
    sitterError = '';
    sitterSaved = false;
    const payload = {
      parentPhones: phoneInputs,
      contacts: contactRows.filter((c) => (c.name || '').trim() || (c.phone || '').trim()),
      notes: notesInput
    };
    try {
      const res = await fetch('/api/babysitter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        sitterInfo = data;
        phoneInputs = Object.fromEntries(data.parents.map((p) => [p.id, p.phone || '']));
        contactRows = data.contacts.map((c) => ({ ...c }));
        notesInput = data.notes || '';
        sitterSaved = true;
      } else {
        sitterError = data.error || 'Could not save';
      }
    } catch {
      sitterError = 'Connection failed';
    }
    savingSitter = false;
  }

  async function loadJournal() {
    loadingJournal = true;
    try {
      const res = await fetch('/api/journal');
      if (res.ok) {
        const data = await res.json();
        entries = data.entries;
        journalTags = data.tags;
      }
    } catch {
      /* leave whatever's already shown */
    }
    loadingJournal = false;
  }

  function openComposer() {
    text = '';
    selectedTag = null;
    selectedMembers = [];
    photoFile = null;
    photoPreview = '';
    postError = '';
    journalView = 'compose';
  }

  function onPhotoChange(e) {
    const file = e.target.files?.[0] || null;
    photoFile = file;
    photoPreview = file ? URL.createObjectURL(file) : '';
  }

  function toggleMember(id) {
    selectedMembers = selectedMembers.includes(id) ? selectedMembers.filter((m) => m !== id) : [...selectedMembers, id];
  }

  async function saveEntry() {
    if (!text.trim() || posting) return;
    posting = true;
    postError = '';
    const form = new FormData();
    form.append('text', text.trim());
    if (selectedTag) form.append('tag', selectedTag);
    form.append('memberIds', JSON.stringify(selectedMembers));
    if (photoFile) form.append('photo', photoFile);
    try {
      const res = await fetch('/api/journal', { method: 'POST', body: form });
      const data = await res.json();
      if (res.ok) {
        entries = [data.entry, ...entries];
        journalView = 'list';
      } else {
        postError = data.error || 'Could not save';
      }
    } catch {
      postError = 'Connection failed';
    }
    posting = false;
  }

  // Optimistic remove — self-service only; the server re-checks authorship
  // regardless of what the UI already hid.
  async function deleteEntry(id) {
    const prev = entries;
    entries = entries.filter((e) => e.id !== id);
    const res = await fetch(`/api/journal/${id}/delete`, { method: 'POST' }).catch(() => null);
    if (!res || !res.ok) entries = prev;
  }
</script>

<div class="page">
  {#if stage === 'loading'}
    <div class="center"><div class="spinner"></div></div>
  {:else if stage === 'pick'}
    <div class="center">
      <h1>Who's this?</h1>
      <div class="members">
        {#each members() as m}
          <button class="member" onclick={() => pick(m)}>
            <AvatarChip id={m.id} name={m.name} color={m.color} monogram={m.mono} size={84} showName={false} />
            <span>{m.name}</span>
          </button>
        {/each}
      </div>
    </div>
  {:else if stage === 'pin'}
    <div class="center">
      <button class="back" onclick={backToPick}
        ><Icon name="chevron_left" size={22} color="var(--ink-soft)" /> Back</button
      >
      <AvatarChip
        id={picked.id}
        name={picked.name}
        color={picked.color}
        monogram={picked.mono}
        size={84}
        showName={false}
      />
      <h1>Enter PIN for {picked.name}</h1>
      <div class="dots">
        {#each Array(4) as _, i}<span class="dot" class:filled={i < pin.length}></span>{/each}
      </div>
      {#if error}<div class="error">{error}</div>{/if}
      <div class="keypad">
        {#each ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as d}
          <button class="key" onclick={() => pressDigit(d)} disabled={submitting}>{d}</button>
        {/each}
        <span></span>
        <button class="key" onclick={() => pressDigit('0')} disabled={submitting}>0</button>
        <button class="key ghost" onclick={backspace} disabled={submitting} aria-label="Backspace">
          <Icon name="backspace" size={22} color="var(--ink-soft)" />
        </button>
      </div>
    </div>
  {:else if stage === 'main' && tab === 'journal' && journalView === 'compose'}
    <div class="composer">
      <button class="back" onclick={() => (journalView = 'list')}
        ><Icon name="chevron_left" size={22} color="var(--ink-soft)" /> Back</button
      >

      <label class="photo-box" class:has={photoPreview}>
        {#if photoPreview}
          <img src={photoPreview} alt="" />
        {:else}
          <Icon name="photo_camera" size={30} color="var(--ink-faint)" />
          <span>Add a photo (optional)</span>
        {/if}
        <input type="file" accept="image/*" onchange={onPhotoChange} hidden />
      </label>

      <div class="field">
        <div class="flabel">What happened?</div>
        <textarea bind:value={text} maxlength="500" placeholder="Write what happened…" rows="4"></textarea>
      </div>

      <div class="field">
        <div class="flabel">Tag it</div>
        <div class="chiprow">
          {#each journalTags as t}
            {@const on = selectedTag === t.id}
            <button
              class="tagchip"
              style="background:{on ? cat[t.catKey][0] : cat[t.catKey][1]}; color:{on ? '#fff' : cat[t.catKey][0]};"
              onclick={() => (selectedTag = on ? null : t.id)}
            >
              <Icon name={t.icon} size={16} fill={on} color={on ? '#fff' : cat[t.catKey][0]} />
              {t.label}
            </button>
          {/each}
        </div>
      </div>

      <div class="field">
        <div class="flabel">Who's this about?</div>
        <div class="chiprow">
          {#each members() as m}
            {@const on = selectedMembers.includes(m.id)}
            <button
              class="mchip"
              style="background:{on ? m.color : 'var(--bg)'}; color:{on ? '#fff' : 'var(--ink-soft)'};"
              onclick={() => toggleMember(m.id)}
            >
              {m.mono}
            </button>
          {/each}
        </div>
      </div>

      <div class="postingas">
        <span class="palabel">Posting as</span>
        <AvatarChip
          id={me.memberId}
          name={byId(me.memberId)?.name}
          color={byId(me.memberId)?.color}
          monogram={byId(me.memberId)?.mono}
          size={40}
          showName={false}
        />
        <span class="pname">{byId(me.memberId)?.name}</span>
      </div>

      {#if postError}<div class="error">{postError}</div>{/if}

      <button class="save" disabled={!text.trim() || posting} onclick={saveEntry}>{posting ? 'Saving…' : 'Save'}</button
      >
    </div>
  {:else if stage === 'main'}
    <div class="main">
      <div class="head">
        <div>
          <div class="hello">Hi, {byId(me.memberId)?.name}</div>
          {#if tab === 'chores'}<div class="bal">
              <Icon name="star" size={20} fill color="var(--gold)" />
              {balance}
            </div>{/if}
        </div>
        <div class="headbtns">
          {#if isParent}
            <button
              class="bell"
              class:on={tab === 'sitter'}
              onclick={() => selectTab(tab === 'sitter' ? 'chores' : 'sitter')}
              aria-label={tab === 'sitter' ? 'Close babysitter info' : 'Edit babysitter info'}
            >
              <Icon
                name="escalator_warning"
                size={22}
                fill={tab === 'sitter'}
                color={tab === 'sitter' ? 'var(--gold-ink)' : 'var(--ink-faint)'}
              />
            </button>
          {/if}
          {#if pushState !== 'hidden'}
            <button
              class="bell"
              class:on={pushState === 'on'}
              onclick={togglePush}
              disabled={pushState === 'busy'}
              aria-label={pushState === 'on' ? 'Turn notifications off' : 'Turn notifications on'}
            >
              <Icon
                name={pushState === 'on' ? 'notifications_active' : 'notifications_off'}
                size={22}
                fill={pushState === 'on'}
                color={pushState === 'on' ? 'var(--gold-ink)' : 'var(--ink-faint)'}
              />
            </button>
          {/if}
          <button class="logout" onclick={logout}>Log out</button>
        </div>
      </div>

      <div class="switcher">
        <button class="stab" class:on={tab === 'chores'} onclick={() => selectTab('chores')}>Chores</button>
        <button class="stab" class:on={tab === 'journal'} onclick={() => selectTab('journal')}>Journal</button>
        {#if mealieUrl}
          <!-- A launcher, not an in-app view: a real anchor (reliable from a
               standalone PWA, unlike window.open) that opens Mealie's own app. -->
          <a class="stab meals" href={mealieUrl} target="_blank" rel="noopener">Meals ↗</a>
        {/if}
      </div>

      {#if tab === 'chores'}
        <div class="list">
          {#if loadingChores && !tasks.length}
            <div class="empty">Loading…</div>
          {:else if !tasks.length}
            <div class="empty">No chores assigned today.</div>
          {:else}
            {#each tasks as t}
              <TaskRow title={t.title} icon="task_alt" done={t.done} points={1} onToggle={() => toggle(t)} />
            {/each}
          {/if}
        </div>
      {:else if tab === 'journal'}
        <button class="add-btn" onclick={openComposer}>
          <Icon name="add" size={20} color="#fff" /> Add an entry
        </button>
        <div class="jlist">
          {#if loadingJournal && !entries.length}
            <div class="empty">Loading…</div>
          {:else if !entries.length}
            <div class="empty">No entries yet — add the first one.</div>
          {:else}
            {#each entries as e (e.id)}
              {@const author = byId(e.authorId)}
              {@const t = e.tag ? tagById[e.tag] : null}
              <div class="jcard" style="border-left-color:{author?.color || 'var(--hairline)'};">
                <div class="jhead">
                  <AvatarChip
                    id={author?.id}
                    name={author?.name}
                    color={author?.color || 'var(--person)'}
                    monogram={author?.mono}
                    size={28}
                    showName={false}
                  />
                  <span class="jname">{author?.name || e.authorId}</span>
                  {#if t}<span class="jtag" style="background:{cat[t.catKey][1]}; color:{cat[t.catKey][0]};"
                      >{t.label}</span
                    >{/if}
                  {#if e.authorId === me.memberId}
                    <button class="jdel" onclick={() => deleteEntry(e.id)} aria-label="Delete entry">
                      <Icon name="delete" size={18} color="var(--ink-faint)" />
                    </button>
                  {/if}
                </div>
                <div class="jtext">{e.text}</div>
              </div>
            {/each}
          {/if}
        </div>
      {:else if tab === 'sitter'}
        <div class="sitter">
          <p class="sitter-intro">
            What the wall shows a babysitter in lockdown. Tap the emergency icon on the wall to lock it; a parent's PIN
            returns to the dashboard.
          </p>

          <div class="sfield">
            <div class="slabel">Parent phone numbers</div>
            {#each sitterInfo.parents as p}
              <div class="prow">
                <AvatarChip id={p.id} name={p.name} color={p.color} size={40} showName={false} />
                <div class="pname">{p.name}</div>
                <input
                  class="sinput"
                  type="tel"
                  placeholder="Phone"
                  bind:value={phoneInputs[p.id]}
                  oninput={() => (sitterSaved = false)}
                />
              </div>
            {/each}
          </div>

          <div class="sfield">
            <div class="slabel">Emergency contacts</div>
            {#each contactRows as c, i}
              <div class="crow">
                <input class="sinput" placeholder="Name" bind:value={c.name} oninput={() => (sitterSaved = false)} />
                <input
                  class="sinput"
                  type="tel"
                  placeholder="Phone"
                  bind:value={c.phone}
                  oninput={() => (sitterSaved = false)}
                />
                <button class="crm" onclick={() => removeContact(i)} aria-label="Remove contact">
                  <Icon name="close" size={18} color="var(--ink-faint)" />
                </button>
              </div>
            {/each}
            <button class="addrow" onclick={addContact}>
              <Icon name="add" size={18} color="var(--ink-soft)" /> Add contact
            </button>
          </div>

          <div class="sfield">
            <div class="slabel">Notes for the sitter</div>
            <textarea
              class="snotes"
              rows="6"
              maxlength="2000"
              placeholder="Bedtime, allergies, house rules, anything they should know…"
              bind:value={notesInput}
              oninput={() => (sitterSaved = false)}></textarea>
          </div>

          {#if sitterError}<div class="serror">{sitterError}</div>{/if}
          <button class="ssave" onclick={saveSitter} disabled={savingSitter}>
            {savingSitter ? 'Saving…' : sitterSaved ? 'Saved ✓' : 'Save'}
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  :global(html, body) {
    margin: 0;
    background: var(--bg);
  }
  .page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  .center {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    padding: 32px;
    text-align: center;
  }
  h1 {
    font-family: var(--font-display);
    font-size: 24px;
    font-weight: 600;
    color: var(--ink);
    margin: 0;
  }
  .spinner {
    width: 32px;
    height: 32px;
    border-radius: 999px;
    border: 3px solid var(--hairline);
    border-top-color: var(--person);
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .members {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
    width: 100%;
    max-width: 360px;
  }
  .member {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    border: none;
    background: none;
    padding: 16px;
    border-radius: 20px;
    cursor: pointer;
  }
  .member:active {
    background: var(--surface);
  }
  .member span {
    font-size: 16px;
    font-weight: 600;
    color: var(--ink);
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
  }
  .dots {
    display: flex;
    gap: 14px;
  }
  .dot {
    width: 16px;
    height: 16px;
    border-radius: 999px;
    border: 2px solid var(--hairline);
  }
  .dot.filled {
    background: var(--person);
    border-color: var(--person);
  }
  .error {
    color: var(--bad, #e0664b);
    font-weight: 600;
    font-size: 15px;
  }
  .keypad {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
    width: 100%;
    max-width: 280px;
  }
  .key {
    aspect-ratio: 1;
    border-radius: 999px;
    border: none;
    background: var(--surface);
    box-shadow: var(--shadow);
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

  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 20px;
    gap: 16px;
    max-width: 480px;
    margin: 0 auto;
    width: 100%;
    box-sizing: border-box;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .hello {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 22px;
    color: var(--ink);
  }
  .bal {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 700;
    font-size: 18px;
    color: var(--gold-ink);
    margin-top: 4px;
  }
  .headbtns {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .bell {
    width: 40px;
    height: 40px;
    border-radius: 999px;
    border: none;
    background: var(--surface);
    box-shadow: var(--shadow);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .bell.on {
    background: var(--gold-soft);
  }
  .bell:disabled {
    opacity: 0.5;
  }
  .logout {
    border: none;
    background: none;
    color: var(--ink-faint);
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .empty {
    text-align: center;
    color: var(--ink-faint);
    padding: 40px 0;
  }

  .switcher {
    display: flex;
    gap: 6px;
    background: var(--surface);
    border-radius: 16px;
    padding: 6px;
    box-shadow: var(--shadow);
  }
  .stab {
    flex: 1;
    text-align: center;
    padding: 10px;
    border-radius: 12px;
    font-size: 15px;
    font-weight: 700;
    color: var(--ink-faint);
    background: transparent;
    border: none;
    cursor: pointer;
  }
  .stab.on {
    color: var(--gold-ink);
    background: var(--gold-soft);
  }
  /* The Meals launcher is an <a>, not a <button> — normalize it to match. */
  .stab.meals {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    text-decoration: none;
  }

  .add-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: none;
    border-radius: 14px;
    padding: 14px;
    background: var(--person);
    color: #fff;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
  }
  .jlist {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .jcard {
    background: var(--surface);
    box-shadow: var(--shadow);
    border-radius: 16px;
    border-left: 4px solid;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .jhead {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .jname {
    font-weight: 700;
    font-size: 15px;
    color: var(--ink);
  }
  .jtag {
    font-size: 12px;
    font-weight: 700;
    border-radius: 999px;
    padding: 3px 9px;
  }
  .jdel {
    margin-left: auto;
    border: none;
    background: none;
    cursor: pointer;
    display: flex;
  }
  .jtext {
    font-size: 15px;
    color: var(--ink);
    line-height: 1.4;
  }

  /* --- Composer --- */
  .composer {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 20px;
    max-width: 480px;
    margin: 0 auto;
    width: 100%;
    box-sizing: border-box;
  }
  .photo-box {
    border: 2px dashed var(--hairline);
    border-radius: 16px;
    height: 140px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: var(--ink-faint);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    overflow: hidden;
  }
  .photo-box.has {
    border-style: solid;
    padding: 0;
  }
  .photo-box img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .flabel {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 15px;
    color: var(--ink);
  }
  textarea {
    border: 1px solid var(--hairline);
    border-radius: 14px;
    padding: 14px;
    font: inherit;
    font-size: 16px;
    color: var(--ink);
    resize: vertical;
    box-sizing: border-box;
  }
  .chiprow {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .tagchip {
    display: flex;
    align-items: center;
    gap: 6px;
    border: none;
    border-radius: 999px;
    padding: 9px 14px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }
  .mchip {
    width: 40px;
    height: 40px;
    border-radius: 999px;
    border: none;
    font-weight: 700;
    font-size: 15px;
    cursor: pointer;
  }
  .postingas {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .palabel {
    font-size: 13px;
    color: var(--ink-faint);
    font-weight: 600;
    margin-right: 2px;
  }
  .pname {
    font-weight: 700;
    font-size: 15px;
    color: var(--ink);
  }
  .save {
    border: none;
    border-radius: 14px;
    padding: 16px;
    background: var(--person);
    color: #fff;
    font-size: 17px;
    font-weight: 700;
    cursor: pointer;
  }
  .save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Babysitter editor */
  .sitter {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .sitter-intro {
    font-size: 14px;
    line-height: 1.45;
    color: var(--ink-faint);
    margin: 0;
  }
  .sfield {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .slabel {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  .sinput {
    border: 1px solid var(--hairline);
    border-radius: 12px;
    padding: 12px 14px;
    font: inherit;
    font-size: 16px;
    color: var(--ink);
    background: var(--surface);
    box-sizing: border-box;
    min-width: 0;
    width: 100%;
  }
  .prow {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .prow .pname {
    font-size: 16px;
    font-weight: 600;
    color: var(--ink);
    width: 64px;
    flex-shrink: 0;
  }
  .crow {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .crow .sinput:first-child {
    flex: 1.2;
  }
  .crow .sinput:nth-child(2) {
    flex: 1;
  }
  .crm {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 999px;
    background: var(--bg);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .addrow {
    align-self: flex-start;
    display: flex;
    align-items: center;
    gap: 6px;
    border: none;
    background: none;
    padding: 6px 4px;
    font: inherit;
    font-size: 15px;
    font-weight: 600;
    color: var(--ink-soft);
    cursor: pointer;
  }
  .snotes {
    width: 100%;
  }
  .serror {
    color: var(--bad);
    font-weight: 600;
    font-size: 14px;
  }
  .ssave {
    border: none;
    border-radius: 14px;
    padding: 15px;
    background: var(--gold);
    color: #fff;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
  }
  .ssave:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
