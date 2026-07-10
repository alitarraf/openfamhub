<script>
  import Icon from './Icon.svelte';
  // A redeemable reward. Locked when balance < cost.
  // variant "row"  — horizontal (icon · name/cost · button).
  // variant "tile" — vertical (icon tile, name, cost, full-width button).
  let {
    name,
    cost,
    icon = 'card_giftcard', // 'redeem' isn't a valid Material Symbols Rounded ligature — renders as tofu
    iconColor = 'var(--person)',
    iconBg = 'var(--person-tint)',
    color = 'var(--person)',
    locked = false,
    variant = 'row',
    onRedeem
  } = $props();
</script>

{#if variant === 'tile'}
  <div class="tile" class:locked>
    <span class="ic tileic" style="background:{locked ? 'var(--bg)' : iconBg};">
      <Icon name={icon} size={28} color={locked ? 'var(--ink-faint)' : iconColor} />
    </span>
    <div class="name">{name}</div>
    <div class="cost">
      <Icon name="star" size={18} fill color="var(--gold)" />
      <span class="costnum">{cost}</span>
    </div>
    {#if locked}
      <button class="btn block locked-btn" disabled>Locked</button>
    {:else}
      <button class="btn block" style="background:{color};" onclick={() => onRedeem?.()}>Redeem</button>
    {/if}
  </div>
{:else}
  <div class="reward" class:locked>
    <span class="ic" style="background:{locked ? 'var(--bg)' : iconBg};">
      <Icon name={icon} size={26} color={locked ? 'var(--ink-faint)' : iconColor} />
    </span>
    <div class="meta">
      <div class="name">{name}</div>
      <div class="cost">
        <Icon name="star" size={16} fill color="var(--gold)" />
        <span class="costnum">{cost}</span>
      </div>
    </div>
    {#if locked}
      <button class="btn locked-btn" disabled>Locked</button>
    {:else}
      <button class="btn" style="background:{color};" onclick={() => onRedeem?.()}>Redeem</button>
    {/if}
  </div>
{/if}

<style>
  .reward {
    display: flex;
    align-items: center;
    gap: 14px;
    background: var(--surface);
    border: 1px solid var(--hairline);
    border-radius: var(--r-md);
    padding: 14px;
  }
  .reward.locked,
  .tile.locked {
    opacity: 0.6;
  }
  .tile {
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: var(--surface);
    border-radius: 18px;
    padding: 18px;
  }
  .ic {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
  }
  .tileic {
    width: 52px;
    height: 52px;
    border-radius: 14px;
  }
  .meta {
    flex: 1;
  }
  .name {
    font-size: 17px;
    font-weight: 600;
    color: var(--ink);
  }
  .tile .name {
    font-size: 19px;
  }
  .cost {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .costnum {
    font-size: 14px;
    font-weight: 700;
    color: var(--gold-ink);
  }
  .btn {
    border: none;
    color: #fff;
    font-weight: 700;
    font-size: 15px;
    border-radius: 999px;
    padding: 10px 20px;
    cursor: pointer;
    flex: none;
  }
  .btn.block {
    width: 100%;
    padding: 12px;
    font-size: 17px;
  }
  .locked-btn {
    background: var(--hairline-2);
    color: var(--ink-faint);
    cursor: default;
  }
</style>
