<script>
  // Material Symbols Rounded glyph (ligature font). `name` is the ligature, e.g. "home".
  let { name, size = 24, fill = false, color = 'currentColor', weight = 400 } = $props();
</script>

<span
  class="ms"
  style="font-size:{size}px; color:{color}; font-variation-settings:'FILL' {fill ? 1 : 0}, 'wght' {weight};"
  >{name}</span
>
