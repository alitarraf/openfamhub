// Custom theme = the VitePress default theme with a custom home Layout.
// Layout.vue fills two hero slots: the hero image becomes the wall dashboard
// with the companion phone overlapping its corner, and a "one wall, everything
// at a glance" showcase (concise list + looping product tour) replaces the
// stock feature grid.
import DefaultTheme from 'vitepress/theme';
import Layout from './Layout.vue';
import './custom.css';

export default {
  ...DefaultTheme,
  Layout
};
