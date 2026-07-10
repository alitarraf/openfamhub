<script>
  // Photo slideshow (data/photos/, see server/sources/photos.js) when photos
  // exist, dark ambient background otherwise — clock+date bottom-left,
  // weather bottom-right in both cases (photo-frame convention). Any tap
  // dismisses.
  import Icon from './Icon.svelte';
  import { fmtLongDate } from '../calendar.js';
  import { dismissScreensaver, screensaverCycleMs } from '../screensaver.svelte.js';
  import { getPhotos, getWeather } from '../api.js';
  import { WX } from '../weather.js';
  import { weather as mockWeather } from '../data/mock.js';

  // From the settings store (20s default) — read at mount, which is fine:
  // this component only exists while the screensaver is active.
  const CYCLE_MS = screensaverCycleMs();

  let now = $state(new Date());
  $effect(() => {
    const id = setInterval(() => (now = new Date()), 1000);
    return () => clearInterval(id);
  });
  let time = $derived(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
  let date = $derived(fmtLongDate(now));

  // Fetched once per screensaver activation (this component is only mounted
  // while active — see App.svelte's {#if isScreensaverActive()}), so a photo
  // dropped into the folder shows up next time the screensaver kicks in.
  let photos = $state([]);
  let index = $state(0);
  $effect(() => {
    getPhotos().then((files) => {
      photos = files;
      index = 0;
    });
  });
  $effect(() => {
    if (!photos.length) return;
    const id = setInterval(() => (index = (index + 1) % photos.length), CYCLE_MS);
    return () => clearInterval(id);
  });

  let wx = $state(mockWeather);
  let wxLoaded = $state(false);
  $effect(() => {
    getWeather(mockWeather).then((w) => {
      if (w?.today) wx = w.today;
      wxLoaded = true;
    });
  });
  let cond = $derived(WX[wx.wx] ?? WX.sunny);
</script>

<button class="scr" onclick={dismissScreensaver} aria-label="Dismiss screensaver">
  {#if photos.length}
    {#key photos[index]}
      <img class="photo" src="/api/photos/img/{photos[index]}" alt="" />
    {/key}
    <div class="wash"></div>
  {/if}

  <div class="corner bl">
    <div class="ptime">{time}</div>
    <div class="pdate">{date}</div>
  </div>
  <div class="corner br" style:visibility={wxLoaded ? 'visible' : 'hidden'}>
    <Icon name={cond.icon} size={40} fill color="#fff" />
    <div class="ptemp">{Math.round(wx.temp)}°</div>
    {#if wx.hi != null}<div class="phl">H{Math.round(wx.hi)}° L{Math.round(wx.lo)}°</div>{/if}
  </div>
</button>

<style>
  .scr {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: var(--ink);
    border: none;
    padding: 0;
    cursor: pointer;
  }
  .photo {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .wash {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
  }
  .corner {
    position: absolute;
    bottom: 56px;
    color: #fff;
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
  }
  .bl {
    left: 56px;
    text-align: left;
  }
  .br {
    right: 56px;
    text-align: right;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }
  .ptime {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 96px;
    line-height: 1;
  }
  .pdate {
    font-size: 26px;
    font-weight: 500;
    margin-top: 10px;
  }
  .ptemp {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 44px;
    line-height: 1.1;
  }
  .phl {
    font-size: 18px;
    font-weight: 500;
    opacity: 0.85;
  }
</style>
