/* Weather source — Open-Meteo (https://open-meteo.com), a free, no-API-key
 * weather API. Replaces OpenWeatherMap's free /data/2.5/ tier, which was
 * capped at 5 days of forecast (3-hour steps × 40 = 120h) — a real ceiling,
 * not a bug (see DEVLOG). Open-Meteo gives true daily forecasts out to 16
 * days, with real per-day high/low instead of an aggregation-from-3-hour-
 * steps approximation, and needs no signup/billing at all.
 *
 * Config: WEATHER_LAT, WEATHER_LON, WEATHER_UNITS (imperial|metric, default
 * imperial), WEATHER_PLACE (a plain display label — Open-Meteo's forecast
 * endpoint doesn't reverse-geocode a city name like OWM's /weather did).
 * WEATHER_API_KEY is no longer used.
 *
 * The pure transforms (mapCurrent / mapForecast / condKey) are exported so they
 * can be checked against a fixture without network (server/test).
 */
const BASE = 'https://api.open-meteo.com/v1/forecast';
const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const FORECAST_DAYS = 10;

const env = (k) => (process.env[k] || '').trim();
const cfg = () => ({
  lat: env('WEATHER_LAT'),
  lon: env('WEATHER_LON'),
  units: env('WEATHER_UNITS') || 'imperial',
  place: env('WEATHER_PLACE')
});

export const hasWeather = () => {
  const c = cfg();
  return !!(c.lat && c.lon);
};

// Open-Meteo's WMO weather code (https://open-meteo.com/en/docs, table 4677)
// -> the WX keys the frontend already maps (sunny | partly | cloudy | rain |
// snow). See app/src/lib/weather.js.
export function condKey(code) {
  if (code === 0 || code === 1) return 'sunny'; // clear, mainly clear
  if (code === 2) return 'partly'; // partly cloudy
  if (code === 3 || code === 45 || code === 48) return 'cloudy'; // overcast, fog
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow'; // snow fall/grains/showers
  // drizzle, freezing drizzle/rain, rain, showers, thunderstorm
  return 'rain';
}

// `current` block -> { wx, temp, hi, lo, place }. hi/lo are filled in by
// fetchWeather from today's `daily` entry — Open-Meteo's current conditions
// carry no daily min/max on their own.
export function mapCurrent(current, place) {
  const c = current || {};
  return {
    wx: condKey(c.weather_code),
    temp: Math.round(c.temperature_2m),
    hi: null,
    lo: null,
    place: place || ''
  };
}

// `daily` block (parallel arrays) -> [{ date, day, wx, hi, lo, today }].
// Open-Meteo's first entry is always "today" in the requested timezone
// (we pass timezone=auto, resolved server-side from lat/lon).
export function mapForecast(daily) {
  const d = daily || {};
  const dates = d.time || [];
  const todayStr = dates[0];
  return dates.map((date, i) => {
    const dt = new Date(`${date}T00:00:00Z`);
    return {
      date, // 'YYYY-MM-DD' — lets the client align this to a specific calendar date
      day: DOW[dt.getUTCDay()],
      wx: condKey((d.weather_code || [])[i]),
      hi: Math.round((d.temperature_2m_max || [])[i]),
      lo: Math.round((d.temperature_2m_min || [])[i]),
      today: date === todayStr
    };
  });
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo -> ${res.status}`);
  return res.json();
}

/**
 * Live weather for the configured location.
 * Returns { today: {wx,temp,hi,lo,place}, week: [{date,day,wx,hi,lo,today}] }.
 * Throws if unconfigured or Open-Meteo errors, so the route falls back to mock.
 */
export async function fetchWeather() {
  const c = cfg();
  if (!hasWeather()) throw new Error('weather not configured (lat/lon)');
  const q = new URLSearchParams({
    latitude: c.lat,
    longitude: c.lon,
    current: 'temperature_2m,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min',
    temperature_unit: c.units === 'metric' ? 'celsius' : 'fahrenheit',
    timezone: 'auto',
    forecast_days: String(FORECAST_DAYS)
  });
  const json = await getJson(`${BASE}?${q}`);
  const today = mapCurrent(json.current, c.place);
  const week = mapForecast(json.daily);
  const todayForecast = week.find((d) => d.today) || week[0];
  if (todayForecast) {
    today.hi = todayForecast.hi;
    today.lo = todayForecast.lo;
    // Also use the day's overall-forecast icon, not the instantaneous current
    // one — `current.weather_code` can say "sunny" right now while the day's
    // summary (same code the week view shows) says "cloudy" because clouds
    // are expected later. Two different icons for "today" between the Home
    // hero and the week view read as a bug, not two valid answers to two
    // different questions — so keep them in lockstep. `temp` stays live/current.
    today.wx = todayForecast.wx;
  }
  return { today, week };
}
