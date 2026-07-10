<script>
  // A per-person colored dot. Calendar cells show one dot per person who has events.
  let { color = 'var(--person)', size = 10 } = $props();
</script>

<span class="dot" style="width:{size}px; height:{size}px; background:{color};"></span>

<style>
  .dot {
    border-radius: 999px;
    display: inline-block;
    flex: none;
  }
</style>
