<script>
  // Base white surface with the one flat shadow.
  let { radius = 24, pad = 24, children, ...rest } = $props();
</script>

<div class="card" style="border-radius:{radius}px; padding:{pad}px;" {...rest}>
  {@render children?.()}
</div>

<style>
  .card {
    background: var(--surface);
    box-shadow: var(--shadow);
  }
</style>
