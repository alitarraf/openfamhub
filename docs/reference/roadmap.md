# Roadmap

Where OpenFamHub is headed. Nothing here is scheduled or promised — these are the
directions we consider worth building, roughly in priority order. See the
[changelog](/reference/changelog) for what has already shipped.

## Voice assistant

The flagship future direction: hands-free control of the things the wall already does —
add a grocery item, ask what's for dinner, mark a chore done.

The architecture principle is that **the kiosk is only a microphone and a screen**.
OpenFamHub targets very low-power display hardware (the reference device is a 2011-era
thin client), so all speech compute runs on a separate always-on box on your LAN — the
same machine that typically hosts Mealie. The existing REST API is already the "tool
surface"; voice is a new input method, not a new subsystem.

Planned in independently shippable tiers:

1. **Push-to-talk.** A mic button on the wall records audio and sends it to the server,
   which forwards it to a [faster-whisper](https://github.com/SYSTRAN/faster-whisper)
   container for transcription. The transcript goes through an intent router that calls
   the existing API endpoints, and the wall shows a visual confirmation. No wake word,
   no TTS — proves the whole chain first.
2. **Hybrid intent parsing.** A deterministic grammar handles the core verbs (fast,
   offline, predictable); an LLM fallback (e.g. Claude Haiku, already used as Mealie's
   AI provider) handles free-form phrasing and turns it into a structured API call.
3. **Wake word.** Either a lightweight audio streamer on the kiosk
   ([wyoming-satellite](https://github.com/rhasspy/wyoming-satellite)) with
   [openWakeWord](https://github.com/dscripka/openWakeWord) running on the server box,
   or a dedicated voice puck (Home Assistant Voice PE / ESP32-S3-BOX) in the room.
4. **Spoken replies.** [Piper](https://github.com/rhasspy/piper) TTS on the server box
   and a small speaker at the wall, enabling short follow-ups ("add eggs" — "anything
   else?").

**Privacy note:** every tier can run fully local (whisper + Piper on your own hardware)
except the optional LLM intent fallback; a grammar-only or local-LLM mode keeps audio
and text off the cloud entirely.

One deliberate non-option: Chromium's built-in Web Speech API. Kiosk Chromium builds
lack the Google speech service keys, so it is not a reliable base.

## Presence-aware display — hardware half

The software half has shipped: `POST /api/presence` wakes the screensaver on every
connected display, with an optional shared-token header. What remains is the sensor
itself — a PIR/mmWave module (a few dollars of ESP32) that HTTP-POSTs motion events.
A reference firmware sketch and a recommended sensor will land here once one has been
tested for real.

## Photo pipeline upgrade

Let journal photos uploaded from the PWA feed the screensaver, or use a self-hosted
[Immich](https://immich.app/) instance as the screensaver source instead of a manually
managed photos folder.

## AI meal-planning assist

"Plan next week": an LLM proposes a week of meals from your Mealie recipe library, and
you accept with one tap into the meal plan. Later, a voice command.

## Recently shipped

Moved off this page — details in the [changelog](/reference/changelog):

- **Instant updates** — SSE stream (`/api/live`), sub-second cross-device sync.
- **Web push notifications** — chore reminder + dinner digest to the parents' phones.
- **On-device settings** — sleep schedule + screensaver timings, parent-PIN gated.
- **Weekly & monthly recaps** — auto-posted as Journal entries, browsable forever.
- **Hardening** — schema migrations, nightly SQLite backups, per-feed calendar
  degradation, CI with a bundle-size budget, economy/auth test suites, lint/format.
