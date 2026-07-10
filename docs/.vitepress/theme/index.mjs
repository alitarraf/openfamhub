// Custom theme = the VitePress default theme plus a small CSS override.
// The only change is enlarging the home hero image (see custom.css) — the
// dashboard screenshot is a tall portrait shot, and the stock hero clamps it
// to ~392px, which reads as a thumbnail rather than the product.
import DefaultTheme from 'vitepress/theme';
import './custom.css';

export default DefaultTheme;
