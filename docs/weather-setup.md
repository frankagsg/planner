# Weather Setup

The planner supports two providers. Choose one with `WEATHER_PROVIDER` in `.env`.

## Option A — Open-Meteo (default, no API key)

[Open-Meteo](https://open-meteo.com/) is free and requires **no signup or key**.
This is the default and recommended for a home kiosk.

```dotenv
WEATHER_PROVIDER=openmeteo
WEATHER_API_KEY=
WEATHER_LAT=40.7128
WEATHER_LON=-74.0060
WEATHER_LABEL=New York, NY
WEATHER_UNITS=imperial      # imperial (°F) or metric (°C)
```

That's it — restart the backend and weather works.

## Option B — OpenWeatherMap (needs a free API key)

1. Create an account at <https://openweathermap.org/>.
2. Go to **API keys**, copy your key (new keys can take a little while to
   activate).
3. Configure `.env`:

```dotenv
WEATHER_PROVIDER=openweathermap
WEATHER_API_KEY=your_openweathermap_key_here
WEATHER_LAT=40.7128
WEATHER_LON=-74.0060
WEATHER_LABEL=New York, NY
WEATHER_UNITS=imperial
```

4. Restart the backend.

> The API key is **only** read by the backend from `.env`. It is never sent to
> or bundled into the frontend.

## Setting the location

- Defaults come from `.env` (`WEATHER_LAT` / `WEATHER_LON` / `WEATHER_LABEL`).
- You can override the location any time from **Settings → Weather** without
  editing files. Find coordinates by searching your town on
  <https://www.latlong.net/> or right-clicking in Google Maps.

## Behavior & resilience

- Results are cached for 10 minutes to avoid hammering the provider.
- On a network error the widget serves the **last known** reading (marked
  "last known") instead of breaking.
- If weather is completely unavailable, the widget shows a small "Weather
  unavailable" card — **the rest of the planner keeps working**.
- Turn the widget off entirely in **Settings → Weather**.
