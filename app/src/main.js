// Self-hosted fonts (no CDN on the appliance). Weights kept to 400/500/600/700.
import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/hanken-grotesk/400.css';
import '@fontsource/hanken-grotesk/500.css';
import '@fontsource/hanken-grotesk/600.css';
import '@fontsource/hanken-grotesk/700.css';
// Material Symbols Rounded (ligature icon font). Subset to the used glyphs later for the Wyse.
import 'material-symbols/rounded.css';

import './lib/theme/tokens.css';
import './app.css';

import { mount } from 'svelte';
import App from './App.svelte';
import Mobile from './Mobile.svelte';

// /m is the companion PWA (phone, PIN login, view+complete chores only) — a
// separate purpose-built page, not a responsive reflow of the wall's screens.
// Everything else mounts the wall app (Frame-scaled 1080x1920 kiosk view).
const isMobile = window.location.pathname.startsWith('/m');
const app = mount(isMobile ? Mobile : App, { target: document.getElementById('app') });

// Only the mobile page is meant to be installed/used offline — the wall is a
// single always-on kiosk tab, a service worker there just adds cache-staleness
// risk for no benefit.
if (isMobile && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}

export default app;
