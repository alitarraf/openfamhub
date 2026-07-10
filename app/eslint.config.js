import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

// Svelte 5 runes are compiler keywords, not runtime globals — the svelte
// parser knows them inside .svelte/.svelte.js, but the shared stores are
// plain-parsed unless listed in `files` below, so declare them for eslint.
const runes = {
  $state: 'readonly',
  $derived: 'readonly',
  $effect: 'readonly',
  $props: 'readonly',
  $bindable: 'readonly',
  $inspect: 'readonly',
  $host: 'readonly'
};

export default [
  { ignores: ['dist/', 'node_modules/'] },
  js.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.browser, ...runes }
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Unkeyed {#each} is deliberate here: every list re-renders wholesale from
      // a fresh fetch (no in-place mutation), and keying changes DOM-reuse
      // behavior in a UI that's already been verified on the kiosk hardware.
      'svelte/require-each-key': 'off',
      // Worth knowing about, but the flagged Map/Date instances are reassigned,
      // not mutated in place — don't fail the build over them.
      'svelte/prefer-svelte-reactivity': 'warn'
    }
  },
  {
    // The companion-PWA service worker runs in a worker scope, not a window.
    files: ['public/sw.js'],
    languageOptions: { globals: globals.serviceworker }
  },
  {
    // Build/test tooling runs under Node, not the browser.
    files: ['scripts/**', 'test/**', 'vite.config.js'],
    languageOptions: { globals: globals.node }
  }
];
