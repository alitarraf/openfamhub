/* Bundle budget — the PRD's "lean SPA" claim, measured instead of asserted.
 *
 * Sums the gzipped JS+CSS in dist/assets (what the Wyse's Chromium actually
 * parses per load; fonts/images stream separately and don't hit the JS
 * engine). Fails when the sum crosses BUNDLE_BUDGET_KB so a heavy dependency
 * shows up in CI, not as kiosk jank. Baseline at adoption (2026-07-03) was
 * ~85 KB gzipped — the budget leaves room to grow, not room to balloon.
 *
 * Run after `npm run build`:  node scripts/check-bundle-size.mjs
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = parseInt(process.env.BUNDLE_BUDGET_KB, 10) || 128;
const ASSETS = new URL('../dist/assets/', import.meta.url).pathname;

let total = 0;
const rows = [];
for (const f of readdirSync(ASSETS).sort()) {
  if (!/\.(js|css)$/.test(f)) continue;
  const gz = gzipSync(readFileSync(join(ASSETS, f))).length;
  total += gz;
  rows.push(`  ${(gz / 1024).toFixed(1).padStart(7)} KB gz  ${f}`);
}

console.log(rows.join('\n'));
const totalKb = total / 1024;
console.log(`  ${'-'.repeat(40)}\n  ${totalKb.toFixed(1).padStart(7)} KB gz  total (budget ${BUDGET_KB} KB)`);

if (totalKb > BUDGET_KB) {
  console.error(`\nBundle over budget: ${totalKb.toFixed(1)} KB gz > ${BUDGET_KB} KB.`);
  console.error('Either trim the dependency that grew it, or consciously raise BUNDLE_BUDGET_KB.');
  process.exit(1);
}
