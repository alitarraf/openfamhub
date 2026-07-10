<script>
  import Icon from '../components/Icon.svelte';
  import AvatarChip from '../components/AvatarChip.svelte';
  import { journal as journalMock, cat } from '../data/mock.js';
  import { getJournal, heartJournalEntry } from '../api.js';
  import { byId } from '../roster.svelte.js';
  import { refreshTick } from '../refresh.svelte.js';
  import { MONTHS } from '../calendar.js';

  let view = $state('feed'); // 'feed' | 'timeline'
  let entries = $state(journalMock.entries);
  let onThisDay = $state(journalMock.onThisDay);
  let tags = $state(journalMock.tags);

  $effect(() => {
    refreshTick(); // re-run on each heartbeat
    getJournal(journalMock).then((d) => {
      entries = d.entries;
      onThisDay = d.onThisDay;
      tags = d.tags;
    });
  });

  let tagById = $derived(Object.fromEntries(tags.map((t) => [t.id, t])));

  // Tap-to-heart is anonymous, same trust model as every other on-wall tap
  // (no login on the wall by design) — optimistic bump, reconciled from the
  // server's real count once the request lands.
  async function heart(entry) {
    entry.hearts += 1;
    const n = await heartJournalEntry(entry.id);
    if (n != null) entry.hearts = n;
  }

  function timeAgo(iso) {
    const ms = Date.now() - new Date(iso).getTime();
    const min = Math.round(ms / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.round(hr / 24)}d ago`;
  }

  // Uploaded photos are stored by filename and served from /api/journal/img/.
  // An absolute path or full URL (e.g. the bundled demo photos) is used as-is.
  const photoSrc = (p) => (/^(https?:)?\/\//.test(p) || p.startsWith('/') ? p : `/api/journal/img/${p}`);

  const dayNum = (localDate) => Number(localDate.slice(8, 10));
  const monthAbbr = (localDate) => MONTHS[Number(localDate.slice(5, 7)) - 1].slice(0, 3).toUpperCase();

  // Entries already arrive newest-first; group consecutive same-month runs
  // for the timeline's month headers without re-sorting anything.
  let timelineGroups = $derived.by(() => {
    const groups = [];
    let current = null;
    for (const e of entries) {
      const label = `${MONTHS[Number(e.localDate.slice(5, 7)) - 1]} ${e.localDate.slice(0, 4)}`;
      if (!current || current.label !== label) {
        current = { label, items: [] };
        groups.push(current);
      }
      current.items.push(e);
    }
    return groups;
  });
</script>

{#snippet tagBadge(tag)}
  {#if tag}
    <span class="etag" style="background:{cat[tag.catKey][1]}; color:{cat[tag.catKey][0]};">
      <Icon name={tag.icon} size={14} fill color={cat[tag.catKey][0]} />
      {tag.label}
    </span>
  {/if}
{/snippet}

{#snippet memberChips(memberIds)}
  {#each memberIds || [] as mid}
    {@const m = byId(mid)}
    {#if m}<AvatarChip id={m.id} name={m.name} color={m.color} monogram={m.mono} size={26} showName={false} />{/if}
  {/each}
{/snippet}

<div class="screen">
  <div class="card appbar">
    <div class="title">Journal</div>
    <button class="toggle" onclick={() => (view = view === 'feed' ? 'timeline' : 'feed')}>
      <Icon name={view === 'feed' ? 'timeline' : 'dynamic_feed'} size={20} color="var(--ink-soft)" />
      {view === 'feed' ? 'Timeline' : 'Feed'}
    </button>
  </div>

  {#if !entries.length}
    <div class="card empty-state">
      <Icon name="auto_stories" size={56} color="var(--ink-faint)" />
      <div class="empty-title">No entries yet</div>
      <div class="empty-sub">Add one from the phone app to start the family journal.</div>
    </div>
  {:else if view === 'feed'}
    <div class="feed">
      {#each entries as e (e.id)}
        {@const author = byId(e.authorId)}
        <div class="card entry" style="border-left-color:{author?.color || 'var(--hairline)'};">
          {#if e.photoPath}
            <div class="photo"><img src={photoSrc(e.photoPath)} alt="" /></div>
          {/if}
          <div class="ehead">
            <AvatarChip
              id={author?.id}
              name={author?.name}
              color={author?.color || 'var(--person)'}
              monogram={author?.mono}
              size={40}
              showName={false}
            />
            <span class="ename">{author?.name || e.authorId}</span>
            {@render tagBadge(e.tag ? tagById[e.tag] : null)}
            <span class="etime">{timeAgo(e.createdAt)}</span>
          </div>
          <div class="etext">{e.text}</div>
          {#if e.memberIds?.length}
            <div class="emembers">{@render memberChips(e.memberIds)}</div>
          {/if}
          <button class="heart" onclick={() => heart(e)} aria-label="React">
            <Icon name="favorite" size={20} fill color="var(--p-rose)" />
            <span>{e.hearts}</span>
          </button>
        </div>
      {/each}
    </div>
  {:else}
    <div class="timeline">
      {#if onThisDay.length}
        <div class="card otd">
          <div class="otd-head"><Icon name="history" size={22} fill color="var(--gold-ink)" /> On this day</div>
          {#each onThisDay as e (e.id)}
            <div class="otd-item">
              <span class="otd-text">{e.text}</span>
              <span class="otd-year">{e.localDate.slice(0, 4)}</span>
            </div>
          {/each}
        </div>
      {/if}
      {#each timelineGroups as group}
        <div class="tmonth">{group.label}</div>
        {#each group.items as e (e.id)}
          <div class="trow">
            <div class="tdate">
              <div class="tnum">{dayNum(e.localDate)}</div>
              <div class="tmon">{monthAbbr(e.localDate)}</div>
            </div>
            <div class="card tcard">
              <div class="ttext">{e.text}</div>
              <div class="tmeta">
                {@render tagBadge(e.tag ? tagById[e.tag] : null)}
                {@render memberChips(e.memberIds)}
              </div>
            </div>
          </div>
        {/each}
      {/each}
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
    border-radius: 24px;
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
  .toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    border: none;
    border-radius: 18px;
    padding: 14px 20px;
    background: var(--bg);
    font-size: 17px;
    font-weight: 600;
    color: var(--ink-soft);
    cursor: pointer;
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
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

  /* --- Feed --- */
  .feed {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 18px;
    overflow-y: auto;
  }
  .entry {
    padding: 24px;
    border-left: 6px solid;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .photo {
    border-radius: 16px;
    overflow: hidden;
    max-height: 260px;
  }
  .photo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .ehead {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .ename {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 20px;
    color: var(--ink);
  }
  .etime {
    margin-left: auto;
    font-size: 15px;
    color: var(--ink-faint);
    font-weight: 600;
  }
  .etext {
    font-size: 19px;
    color: var(--ink);
    line-height: 1.4;
  }
  .emembers {
    display: flex;
    gap: 8px;
  }
  .heart {
    align-self: flex-start;
    display: flex;
    align-items: center;
    gap: 6px;
    border: none;
    background: var(--bg);
    border-radius: 999px;
    padding: 10px 16px;
    font-size: 16px;
    font-weight: 700;
    color: var(--ink-soft);
    cursor: pointer;
  }

  .etag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border-radius: 999px;
    padding: 6px 12px;
    font-size: 14px;
    font-weight: 700;
  }

  /* --- Timeline --- */
  .timeline {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
    padding-right: 4px;
  }
  .otd {
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: var(--gold-soft);
  }
  .otd-head {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 19px;
    color: var(--gold-ink);
  }
  .otd-item {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 17px;
    color: var(--ink);
  }
  .otd-year {
    color: var(--gold-ink);
    font-weight: 700;
    flex: none;
  }

  .tmonth {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 20px;
    color: var(--ink-faint);
    padding-left: 4px;
    margin-top: 4px;
  }
  .trow {
    display: flex;
    gap: 16px;
    align-items: flex-start;
  }
  .tdate {
    flex: none;
    width: 56px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .tnum {
    width: 48px;
    height: 48px;
    border-radius: 999px;
    background: var(--gold);
    color: #fff;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .tmon {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--ink-faint);
    margin-top: 4px;
  }
  .tcard {
    flex: 1;
    padding: 18px 22px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .ttext {
    font-size: 18px;
    color: var(--ink);
    line-height: 1.4;
  }
  .tmeta {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
</style>
