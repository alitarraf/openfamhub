<script>
  import Icon from './Icon.svelte';
  // Top bar: time/date · optional title · weather · settings.
  // clockSize defaults to the gallery size; screens on the wall pass a larger value.
  let {
    time = '',
    date = '',
    title = '',
    weatherIcon = 'sunny',
    temp = '',
    showWeather = true,
    showSettings = true,
    clockSize = 34,
    onSettings
  } = $props();
</script>

<div class="appbar">
  <div class="clock">
    <span class="time" style="font-size:{clockSize}px;">{time}</span>
    {#if date}<span class="date">{date}</span>{/if}
  </div>

  {#if title}<div class="title">{title}</div>{/if}

  <div class="right">
    {#if showWeather && temp}
      <div class="weather">
        <Icon name={weatherIcon} size={30} fill color="var(--warn)" />
        <span class="temp">{temp}</span>
      </div>
    {/if}
    {#if showSettings}
      <button class="settings" onclick={() => onSettings?.()} aria-label="Settings">
        <Icon name="settings" size={26} color="var(--ink-soft)" />
      </button>
    {/if}
  </div>
</div>

<style>
  .appbar {
    background: var(--surface);
    border-radius: 28px;
    box-shadow: var(--shadow);
    padding: 16px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }
  .clock {
    display: flex;
    flex-direction: column;
    line-height: 1.05;
  }
  .time {
    font-family: var(--font-display);
    font-weight: 600;
    color: var(--ink);
  }
  .date {
    font-size: 15px;
    color: var(--ink-soft);
    font-weight: 500;
  }
  .title {
    font-family: var(--font-display);
    font-weight: 500;
    font-size: 24px;
    color: var(--ink);
  }
  .right {
    display: flex;
    align-items: center;
    gap: 18px;
  }
  .weather {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .temp {
    font-family: var(--font-display);
    font-size: 24px;
    color: var(--ink);
  }
  .settings {
    width: 48px;
    height: 48px;
    border-radius: 999px;
    background: var(--bg);
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
</style>
