import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Lean SPA for a Chromium kiosk on the Wyse. Served on :8080.
// allowedHosts:true so it can be reached via the Tailscale MagicDNS hostname.
export default defineConfig({
  plugins: [svelte()],
  server: { host: true, port: 8080, strictPort: true, allowedHosts: true },
  preview: { host: true, port: 8080, strictPort: true, allowedHosts: true }
});
