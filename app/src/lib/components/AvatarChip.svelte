<script>
  // Circle with a 3px person ring; placeholder = diagonal stripe + monogram.
  // Pass `progress` (0..1) to wrap it in a completion ring (conic-gradient).
  // A photo (explicit `photo`, else resolved from the Todoist avatar store by
  // `id`) overlays the monogram; if it fails to load, the monogram shows through.
  import { avatarUrl } from '../avatars.svelte.js';

  let {
    name = '',
    color = 'var(--person)',
    monogram = '',
    size = 60,
    showName = true,
    photo = '',
    progress = null,
    id = ''
  } = $props();

  let mono = $derived(monogram || (name ? name[0].toUpperCase() : ''));
  let pct = $derived(progress == null ? 0 : Math.max(0, Math.min(1, progress)) * 100);
  let monoSize = $derived(Math.round(size * 0.37));
  // Explicit photo prop wins; otherwise resolve from the Todoist avatar store.
  let src = $derived(photo || avatarUrl(id));
  let broken = $state(false);
</script>

{#snippet faceInner()}
  {mono}
  {#if src}
    {#key src}
      <img class="photo" class:broken {src} alt="" onerror={() => (broken = true)} />
    {/key}
  {/if}
{/snippet}

<div class="chip">
  {#if progress != null}
    <div
      class="ring"
      style="width:{size}px; height:{size}px; background:conic-gradient({color} {pct}%, var(--hairline) 0);"
    >
      <div class="face ringed" style="font-size:{monoSize}px; color:{color};">
        {@render faceInner()}
      </div>
    </div>
  {:else}
    <div
      class="face"
      style="width:{size}px; height:{size}px; border-color:{color}; font-size:{monoSize}px; color:{color};"
    >
      {@render faceInner()}
    </div>
  {/if}
  {#if showName && name}<span class="name">{name}</span>{/if}
</div>

<style>
  .chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .ring {
    border-radius: 999px;
    padding: 5px;
    flex: none;
  }
  .face {
    position: relative;
    overflow: hidden;
    width: 100%;
    height: 100%;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-display);
    font-weight: 600;
    background-color: #f7f9fc;
    background-image: repeating-linear-gradient(45deg, #eef1f6, #eef1f6 6px, #f7f9fc 6px, #f7f9fc 12px);
  }
  .face:not(.ringed) {
    border: 3px solid var(--person);
    flex: none;
  }
  .face.ringed {
    border: 3px solid #fff;
  }
  .photo {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 999px;
  }
  /* A failed load hides the img so the monogram underneath shows through. */
  .photo.broken {
    display: none;
  }
  .name {
    font-size: 14px;
    font-weight: 600;
    color: var(--ink);
  }
</style>
