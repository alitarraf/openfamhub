# Weather

Uses [Open-Meteo](https://open-meteo.com) — free, no signup, no API key.

```bash [.env]
WEATHER_LAT=       # decimal latitude
WEATHER_LON=       # decimal longitude
WEATHER_UNITS=     # imperial or metric
WEATHER_PLACE=     # display label — Open-Meteo doesn't reverse-geocode a city name
```

Gives a real 10-day forecast with true daily high/low (not an approximation from
3-hour steps). Leave `WEATHER_LAT`/`WEATHER_LON` blank and the weather card falls back
to bundled demo data.
