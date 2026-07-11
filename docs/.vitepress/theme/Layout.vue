<script setup>
import DefaultTheme from 'vitepress/theme'
import { withBase } from 'vitepress'

const Layout = DefaultTheme.Layout

// Concise product surface — the six screens the tour walks through.
const surfaces = [
  { icon: '📅', title: 'Calendar', blurb: 'Every calendar, color-coded per person', link: '/guide/calendar' },
  { icon: '✅', title: 'Chores', blurb: 'Tap to complete — points that persist', link: '/guide/tasks' },
  { icon: '⭐', title: 'Rewards', blurb: 'A real catalog the kids save up for', link: '/guide/rewards' },
  { icon: '🍽️', title: 'Meals', blurb: "This week's plan and the grocery list", link: '/guide/meals' },
  { icon: '💰', title: 'Budget', blurb: 'One honest "safe to spend" number', link: '/guide/budget' },
  { icon: '📔', title: 'Journal', blurb: 'Family moments, written from your phone', link: '/guide/journal' }
]
</script>

<template>
  <Layout>
    <!-- Hero: the wall dashboard with the companion phone overlapping its corner -->
    <template #home-hero-image>
      <div class="hero-composite">
        <img
          class="hero-wall"
          :src="withBase('/img/dashboard.png')"
          alt="OpenFamHub dashboard on a wall-mounted touchscreen"
        />
        <div class="hero-phone">
          <img
            :src="withBase('/img/phone.png')"
            alt="The companion phone app showing the family journal"
          />
        </div>
      </div>
    </template>

    <!-- Feature section: concise list on the left, looping product tour on the right -->
    <template #home-features-after>
      <section class="showcase">
        <div class="showcase-inner">
          <div class="showcase-copy">
            <h2>One wall. Everything at a glance.</h2>
            <p class="showcase-lead">
              Six screens your family actually uses, on a touchscreen by the door —
              and an installable phone app for the two things you type.
            </p>
            <ul class="surface-list">
              <li v-for="s in surfaces" :key="s.title">
                <a :href="withBase(s.link)">
                  <span class="surface-icon" aria-hidden="true">{{ s.icon }}</span>
                  <span class="surface-text">
                    <strong>{{ s.title }}</strong>
                    <span class="surface-blurb">{{ s.blurb }}</span>
                  </span>
                </a>
              </li>
            </ul>
          </div>
          <div class="showcase-media">
            <div class="showcase-frame">
              <video
                :poster="withBase('/img/dashboard.png')"
                autoplay
                loop
                muted
                playsinline
              >
                <source :src="withBase('/img/product-tour.webm')" type="video/webm" />
                <source :src="withBase('/img/product-tour.mp4')" type="video/mp4" />
              </video>
            </div>
            <p class="showcase-caption">
              A quick loop through Home, Calendar, Chores, Rewards, Meals, Budget, and Journal.
            </p>
          </div>
        </div>
      </section>
    </template>
  </Layout>
</template>

<style scoped>
/* ── Hero composite: wall dashboard + overlapping phone ───────────────── */
.hero-composite {
  position: relative;
  width: 100%;
  max-width: 300px;
  margin: 0 auto;
  padding-right: 46px; /* room for the phone to sit off the wall's right edge */
  padding-bottom: 26px;
}
.hero-wall {
  display: block;
  width: 100%;
  border-radius: 20px;
  box-shadow: 0 22px 50px -22px rgba(20, 24, 33, 0.55);
}
.hero-phone {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 46%;
  padding: 5px;
  border-radius: 22px;
  background: #14181f;
  box-shadow: 0 18px 40px -12px rgba(20, 24, 33, 0.6);
}
.hero-phone img {
  display: block;
  width: 100%;
  border-radius: 17px;
}

@media (min-width: 640px) {
  .hero-composite { max-width: 400px; padding-right: 60px; }
}
@media (min-width: 960px) {
  .hero-composite { max-width: 460px; padding-right: 66px; }
}

/* ── Showcase: concise list left, looping tour right ──────────────────── */
.showcase {
  border-top: 1px solid var(--vp-c-divider);
  margin-top: 16px;
}
.showcase-inner {
  max-width: 1152px;
  margin: 0 auto;
  padding: 64px 24px 8px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 40px;
  align-items: center;
}
@media (min-width: 860px) {
  .showcase-inner {
    grid-template-columns: minmax(0, 1fr) 356px;
    gap: 56px;
    padding: 80px 32px 16px;
  }
}
.showcase-copy h2 {
  font-size: 28px;
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: -0.02em;
  text-wrap: balance;
  margin: 0;
}
@media (min-width: 860px) {
  .showcase-copy h2 { font-size: 32px; }
}
.showcase-lead {
  margin: 14px 0 26px;
  color: var(--vp-c-text-2);
  font-size: 15px;
  line-height: 1.6;
  max-width: 34ch;
}
.surface-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.surface-list a {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 12px;
  margin: 0 -12px;
  border-radius: 12px;
  text-decoration: none;
  transition: background-color 0.2s ease;
}
.surface-list a:hover { background: var(--vp-c-bg-soft); }
.surface-icon {
  flex: none;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  font-size: 20px;
  border-radius: 11px;
  background: var(--vp-c-bg-soft);
}
.surface-list a:hover .surface-icon { background: var(--vp-c-bg); }
.surface-text { display: flex; flex-direction: column; line-height: 1.35; }
.surface-text strong { color: var(--vp-c-text-1); font-weight: 600; font-size: 15px; }
.surface-blurb { color: var(--vp-c-text-2); font-size: 13.5px; }

.showcase-media { width: 100%; }
.showcase-frame {
  max-width: 356px;
  margin: 0 auto;
  border-radius: 18px;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
  box-shadow: 0 18px 44px -20px rgba(20, 24, 33, 0.5);
  border: 1px solid var(--vp-c-divider);
}
.showcase-frame video {
  display: block;
  width: 100%;
  height: auto;
}
.showcase-caption {
  margin: 14px 4px 0;
  font-size: 13px;
  color: var(--vp-c-text-3);
  text-align: center;
}
</style>
