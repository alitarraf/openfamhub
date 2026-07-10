/* Provider registry — one pluggable implementation per data domain, selected by
 * an env var (falls back to the first/default key below if unset).
 *
 * This app ships exactly one implementation per domain today. The registry
 * exists so swapping one out (e.g. Todoist -> a CalDAV/Google Tasks tasks
 * provider, or Mealie -> a plain grocery-list provider) is a config change plus
 * one new file in server/sources/ implementing the same named exports as its
 * neighbor — not a rewrite of server/index.js, which only ever imports the
 * *ProviderName exports below.
 *
 * Each domain's contract is just "the set of named exports its current
 * implementation has" (see server/sources/*.js for the reference shape) — kept
 * loose on purpose; the domains genuinely do different things (tasks vs.
 * weather vs. photos), so a single rigid interface would force awkward
 * no-op methods rather than add real flexibility.
 */
import * as todoist from '../sources/todoist.js';
import * as ical from '../sources/ical.js';
import * as mealie from '../sources/mealie.js';
import * as monarch from '../sources/monarch.js';
import * as weather from '../sources/weather.js';
import * as photos from '../sources/photos.js';

const DOMAINS = {
  tasks: { todoist },
  calendar: { ical },
  meals: { mealie },
  budget: { monarch },
  weather: { weather },
  photos: { photos }
};

function pick(domain, envVar) {
  const impls = DOMAINS[domain];
  const requested = (process.env[envVar] || '').trim();
  const key = requested || Object.keys(impls)[0];
  const impl = impls[key];
  if (!impl) {
    throw new Error(`unknown ${domain} provider "${key}" (options: ${Object.keys(impls).join(', ')})`);
  }
  return impl;
}

export const taskProvider = pick('tasks', 'PROVIDER_TASKS');
export const calendarProvider = pick('calendar', 'PROVIDER_CALENDAR');
export const mealsProvider = pick('meals', 'PROVIDER_MEALS');
export const budgetProvider = pick('budget', 'PROVIDER_BUDGET');
export const weatherProvider = pick('weather', 'PROVIDER_WEATHER');
export const photosProvider = pick('photos', 'PROVIDER_PHOTOS');
