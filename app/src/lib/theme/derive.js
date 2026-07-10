// Derive a PersonCard/AvatarChip's cosmetic fields (tint, tintBorder, monogram)
// from just a member's `color` + `name` — so a live roster (config/members.json)
// only has to supply id/name/color; the bundled mock data still hand-picks
// tint/tintBorder for a closer match to the reference design.

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

const toHex = (n) =>
  Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, '0');

// Blend `hex` toward white by `amount` (0 = no change, 1 = pure white).
function towardWhite(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  const mix = (c) => c * (1 - amount) + 255 * amount;
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

export const tintFor = (color) => towardWhite(color, 0.92);
export const tintBorderFor = (color) => towardWhite(color, 0.82);
export const monoFor = (name) => (name || '').trim()[0]?.toUpperCase() || '?';
