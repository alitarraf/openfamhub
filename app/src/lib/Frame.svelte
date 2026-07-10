<script>
  // Renders the fixed 1080x1920 portrait wall and scales it to fit the review
  // viewport (browser over Tailscale). On the Wyse at native 1080x1920, scale = 1.
  let { children } = $props();
  let scale = $state(1);

  function fit() {
    scale = Math.min(window.innerWidth / 1080, window.innerHeight / 1920, 1);
  }

  $effect(() => {
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  });
</script>

<div class="stage">
  <div class="frame" style="transform:scale({scale});">
    {@render children?.()}
  </div>
</div>

<style>
  .stage {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #dfe3ea;
    overflow: hidden;
  }
  .frame {
    width: 1080px;
    height: 1920px;
    flex: none;
    transform-origin: center center;
    background: var(--bg);
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(39, 49, 63, 0.18);
  }
</style>
