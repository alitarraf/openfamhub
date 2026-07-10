// Weather condition map: Material Symbols icon + color token per condition.
// Icons render filled (FILL 1) via the Icon component's `fill` prop.
export const WX = {
  sunny: { icon: 'sunny', color: 'var(--warn)' }, // #E0A11B
  partly: { icon: 'partly_cloudy_day', color: 'var(--warn)' },
  cloudy: { icon: 'cloud', color: 'var(--ink-faint)' }, // #98A2B3
  rain: { icon: 'rainy', color: 'var(--p-sky)' }, // #2E8BC0
  snow: { icon: 'weather_snowy', color: '#7FB1D8' }
};

const LABELS = {
  sunny: 'Sunny',
  partly: 'Partly cloudy',
  cloudy: 'Cloudy',
  rain: 'Rain',
  snow: 'Snow'
};

export const wxLabel = (wx) => LABELS[wx] ?? '';
