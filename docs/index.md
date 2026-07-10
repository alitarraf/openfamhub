---
layout: home

hero:
  name: OpenFamHub
  text: Your family's command center, self-hosted.
  tagline: A subscription-free wall dashboard for a touchscreen — shared calendar, chores with a real points-and-rewards economy, meal planning, budget, and a family journal. Built on tools you already use. No monthly fee, no cloud account, your data on your own hardware.
  image:
    src: /img/dashboard.png
    alt: OpenFamHub dashboard on a wall-mounted touchscreen
  actions:
    - theme: brand
      text: Get Started
      link: /overview
    - theme: alt
      text: Build the hardware
      link: /hardware
    - theme: alt
      text: View on GitHub
      link: https://github.com/alitarraf/openfamhub

features:
  - icon: 📅
    title: Calendar
    details: Month / week / day views, per-person color coding, pulled from any iCal feed — Google Calendar, iCloud, or anything that publishes ICS.
    link: /guide/calendar
  - icon: ✅
    title: Tasks & Chores
    details: A shared Todoist project split per family member. Tap to complete; chore completions award points that actually persist.
    link: /guide/tasks
  - icon: ⭐
    title: Rewards
    details: A configurable reward catalog. Redeeming deducts from a persisted point balance, all tracked in SQLite — the one genuinely stateful piece.
    link: /guide/rewards
  - icon: 🍽️
    title: Meals
    details: Weekly meal-plan grid, recipe browsing, and a shared grocery list via Mealie.
    link: /guide/meals
  - icon: 💰
    title: Budget
    details: A "safe to spend" hero number plus per-category rows, from an optional Monarch Money sidecar.
    link: /guide/budget
  - icon: 📔
    title: Journal
    details: A family feed of milestones, quotes, and everyday moments with photos — written from the phone, displayed on the wall.
    link: /guide/journal
---

<script setup>
import { withBase } from 'vitepress'
</script>

<div style="max-width:960px;margin:0 auto;padding:8px 24px 56px;text-align:center;">

## See it in action

<video :poster="withBase('/img/dashboard.png')" autoplay loop muted playsinline controls style="display:block;width:100%;max-width:420px;margin:1.25rem auto 0;border-radius:16px;box-shadow:0 10px 34px rgba(0,0,0,0.16);">
  <source :src="withBase('/img/product-tour.webm')" type="video/webm" />
  <source :src="withBase('/img/product-tour.mp4')" type="video/mp4" />
  <img :src="withBase('/img/dashboard.png')" alt="OpenFamHub dashboard" style="width:100%;border-radius:16px;" />
</video>

<p style="margin-top:.75rem;font-size:.9em;opacity:.7;">A quick tour of the wall — Home, Calendar, Chores, Rewards, Meals, Budget, and Journal.</p>

</div>
