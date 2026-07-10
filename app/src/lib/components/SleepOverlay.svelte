<script>
  // App-level blackout ONLY — never `xset dpms` (kills touch-wake on these
  // monitors, see CLAUDE.md). Any tap wakes.
  import { wake } from '../sleep.svelte.js';
</script>

<button class="sleep" onclick={wake} aria-label="Wake"></button>

<style>
  .sleep {
    position: fixed;
    inset: 0;
    z-index: 300;
    background: #000;
    border: none;
    padding: 0;
    cursor: pointer;
  }
</style>
