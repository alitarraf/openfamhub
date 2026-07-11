import { defineConfig } from 'vitepress'

// One thing to change after you fork/publish: point these at your repo + Pages URL.
const GITHUB_URL = 'https://github.com/alitarraf/openfamhub'

export default defineConfig({
  title: 'OpenFamHub',
  description:
    'A subscription-free, self-hosted family command center for a wall-mounted touchscreen.',

  // Served at the openfamhub.com domain root (custom domain via CNAME), so the
  // base is '/'. If you fork and publish to a GitHub project URL instead
  // (alitarraf.github.io/openfamhub/), set this back to '/openfamhub/'.
  base: '/',
  cleanUrls: true,
  lastUpdated: true,

  // Dev-only: allow the WSL tailnet hostname (alipc-1) so it can be previewed
  // from the Mac. Never public-facing, so a blanket allow is fine. See
  // /mnt/d/readme.md → "Vite/dev servers must allow tailnet hostnames".
  vite: {
    server: { allowedHosts: true },
  },

  themeConfig: {
    logo: '/img/dashboard.png',

    search: {
      provider: 'local',
    },

    nav: [
      { text: 'Get Started', link: '/overview', activeMatch: '^/(overview|hardware|install|first-time-setup|networking)' },
      { text: 'Integrations', link: '/integrations/todoist', activeMatch: '^/integrations/' },
      { text: 'User Guide', link: '/guide/overview', activeMatch: '^/guide/' },
      { text: 'Reference', link: '/reference/configuration', activeMatch: '^/reference/' },
      { text: 'GitHub', link: GITHUB_URL },
    ],

    // Single sidebar, ordered as the steps you take to replicate the project:
    // understand it → build the hardware → install → configure → make it
    // reachable → wire integrations → mount it on the wall → learn the screens
    // → keep it updated → reference.
    sidebar: [
      {
        text: 'Get Started',
        items: [
          { text: 'Overview', link: '/overview' },
          { text: 'Hardware', link: '/hardware' },
          { text: 'Install', link: '/install' },
          { text: 'First-time setup', link: '/first-time-setup' },
          { text: 'Networking (Tailscale)', link: '/networking' },
        ],
      },
      {
        text: 'Integrations',
        items: [
          { text: 'Todoist', link: '/integrations/todoist' },
          { text: 'Calendar (iCal)', link: '/integrations/calendar' },
          { text: 'Mealie', link: '/integrations/mealie' },
          { text: 'Weather', link: '/integrations/weather' },
          { text: 'Budget (Monarch Money)', link: '/integrations/budget' },
        ],
      },
      {
        text: 'Deployment',
        items: [
          { text: 'Kiosk setup', link: '/kiosk' },
          { text: 'Self-hosting reference', link: '/self-hosting' },
        ],
      },
      {
        text: 'User Guide',
        items: [
          { text: 'Overview', link: '/guide/overview' },
          { text: 'Calendar', link: '/guide/calendar' },
          { text: 'Tasks & Chores', link: '/guide/tasks' },
          { text: 'Rewards', link: '/guide/rewards' },
          { text: 'Meals', link: '/guide/meals' },
          { text: 'Budget', link: '/guide/budget' },
          { text: 'Journal', link: '/guide/journal' },
          { text: 'Mobile (PWA)', link: '/guide/mobile' },
          { text: 'Settings', link: '/guide/settings' },
          { text: 'Babysitter mode', link: '/guide/babysitter' },
        ],
      },
      {
        text: 'Maintenance',
        items: [{ text: 'Updating', link: '/updating' }],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Configuration (all variables)', link: '/reference/configuration' },
          { text: 'API', link: '/reference/api' },
          { text: 'Roadmap', link: '/reference/roadmap' },
          { text: 'Changelog', link: '/reference/changelog' },
        ],
      },
    ],

    socialLinks: [{ icon: 'github', link: GITHUB_URL }],

    editLink: {
      pattern: `${GITHUB_URL}/edit/main/docs/:path`,
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Built with Claude Code — human-directed.',
    },
  },
})
