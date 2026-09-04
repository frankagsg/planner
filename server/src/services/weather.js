import config from '../config.js';
import { getSetting } from '../lib/settings.js';

// In-memory cache so a flaky network or rate limit doesn't break the UI.
let cache = { key: null, at: 0, data: null };
const CACHE_MS = 10 * 60 * 1000; // 10 minutes

function resolveLocation() {
  const lat = getSetting('weather.lat') ?? config.weather.lat;
  const lon = getSetting('weather.lon') ?? config.weather.lon;
  const label = getSetting('weather.label') ?? config.weather.label;
  const units = getSetting('weather.units') ?? config.weather.units;
  return { lat, lon, label, units };
}

function wmoToCondition(code) {
  // Open-Meteo WMO weather codes -> friendly text + icon key.
  const map = {
    0: ['Clear', 'sun'],
    1: ['Mostly clear', 'sun'],
    2: ['Partly cloudy', 'cloud-sun'],
    3: ['Overcast', 'cloud'],
    45: ['Fog', 'fog'],
    48: ['Rime fog', 'fog'],
    51: ['Light drizzle', 'drizzle'],
    53: ['Drizzle', 'drizzle'],
    55: ['Heavy drizzle', 'drizzle'],
    61: ['Light rain', 'rain'],
    63: ['Rain', 'rain'],
    65: ['Heavy rain', 'rain'],
    66: ['Freezing rain', 'rain'],
    67: ['Freezing rain', 'rain'],
    71: ['Light snow', 'snow'],
    73: ['Snow', 'snow'],
    75: ['Heavy snow', 'snow'],
    77: ['Snow grains', 'snow'],
    80: ['Rain showers', 'rain'],
    81: ['Rain showers', 'rain'],
    82: ['Violent showers', 'rain'],
    85: ['Snow showers', 'snow'],
    86: ['Snow showers', 'snow'],
    95: ['Thunderstorm', 'storm'],
    96: ['Thunderstorm', 'storm'],
    99: ['Thunderstorm', 'storm'],
  };
  return map[code] || ['—', 'cloud'];
}

async function fetchOpenMeteo({ lat, lon, units }) {
  const tempUnit = units === 'imperial' ? 'fahrenheit' : 'celsius';
  const windUnit = units === 'imperial' ? 'mph' : 'kmh';
  const precipUnit = units === 'imperial' ? 'inch' : 'mm';
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m',
    hourly: 'temperature_2m,precipitation_probability,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
    temperature_unit: tempUnit,
    wind_speed_unit: windUnit,
    precipitation_unit: precipUnit,
    timezone: 'auto',
    forecast_days: '7',
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!resp.ok) throw new Error(`open-meteo ${resp.status}`);
  const j = await resp.json();

  const [curText, curIcon] = wmoToCondition(j.current.weather_code);
  const nowIso = j.current.time;
  const hourIdx = Math.max(0, j.hourly.time.findIndex((t) => t >= nowIso));
  const hourly = j.hourly.time.slice(hourIdx, hourIdx + 12).map((t, i) => {
    const idx = hourIdx + i;
    const [text, icon] = wmoToCondition(j.hourly.weather_code[idx]);
    return {
      time: t,
      temp: Math.round(j.hourly.temperature_2m[idx]),
      precipProb: j.hourly.precipitation_probability?.[idx] ?? null,
      icon,
      text,
    };
  });
  const daily = j.daily.time.map((t, i) => {
    const [text, icon] = wmoToCondition(j.daily.weather_code[i]);
    return {
      date: t,
      hi: Math.round(j.daily.temperature_2m_max[i]),
      lo: Math.round(j.daily.temperature_2m_min[i]),
      precipProb: j.daily.precipitation_probability_max?.[i] ?? null,
      sunrise: j.daily.sunrise?.[i] ?? null,
      sunset: j.daily.sunset?.[i] ?? null,
      icon,
      text,
    };
  });

  return {
    current: {
      temp: Math.round(j.current.temperature_2m),
      feelsLike: Math.round(j.current.apparent_temperature),
      humidity: j.current.relative_humidity_2m,
      precip: j.current.precipitation,
      wind: Math.round(j.current.wind_speed_10m),
      icon: curIcon,
      text: curText,
    },
    hourly,
    daily,
  };
}

async function fetchOpenWeatherMap({ lat, lon, units }) {
  const key = config.weather.apiKey;
  if (!key) throw new Error('OpenWeatherMap API key missing (set WEATHER_API_KEY)');
  const u = units === 'imperial' ? 'imperial' : 'metric';
  const base = 'https://api.openweathermap.org/data/2.5';
  const cur = await fetch(
    `${base}/weather?lat=${lat}&lon=${lon}&units=${u}&appid=${key}`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!cur.ok) throw new Error(`openweathermap ${cur.status}`);
  const c = await cur.json();
  const fc = await fetch(
    `${base}/forecast?lat=${lat}&lon=${lon}&units=${u}&appid=${key}`,
    { signal: AbortSignal.timeout(8000) }
  );
  const f = fc.ok ? await fc.json() : { list: [] };

  const iconOf = (main) => {
    const m = String(main || '').toLowerCase();
    if (m.includes('clear')) return 'sun';
    if (m.includes('cloud')) return 'cloud';
    if (m.includes('rain') || m.includes('drizzle')) return 'rain';
    if (m.includes('snow')) return 'snow';
    if (m.includes('thunder')) return 'storm';
    if (m.includes('fog') || m.includes('mist')) return 'fog';
    return 'cloud';
  };

  const hourly = (f.list || []).slice(0, 12).map((it) => ({
    time: it.dt_txt,
    temp: Math.round(it.main.temp),
    precipProb: Math.round((it.pop ?? 0) * 100),
    icon: iconOf(it.weather?.[0]?.main),
    text: it.weather?.[0]?.description ?? '',
  }));

  // Aggregate 3-hourly forecast into days.
  const days = {};
  for (const it of f.list || []) {
    const d = it.dt_txt.slice(0, 10);
    days[d] = days[d] || { hi: -Infinity, lo: Infinity, pop: 0, main: it.weather?.[0]?.main };
    days[d].hi = Math.max(days[d].hi, it.main.temp_max);
    days[d].lo = Math.min(days[d].lo, it.main.temp_min);
    days[d].pop = Math.max(days[d].pop, Math.round((it.pop ?? 0) * 100));
  }
  const daily = Object.entries(days).slice(0, 7).map(([date, v]) => ({
    date,
    hi: Math.round(v.hi),
    lo: Math.round(v.lo),
    precipProb: v.pop,
    icon: iconOf(v.main),
    text: v.main,
  }));

  return {
    current: {
      temp: Math.round(c.main.temp),
      feelsLike: Math.round(c.main.feels_like),
      humidity: c.main.humidity,
      precip: c.rain?.['1h'] ?? 0,
      wind: Math.round(c.wind?.speed ?? 0),
      icon: iconOf(c.weather?.[0]?.main),
      text: c.weather?.[0]?.description ?? '',
    },
    hourly,
    daily,
  };
}

export async function getWeather({ force = false } = {}) {
  const loc = resolveLocation();
  const provider = config.weather.provider;
  const cacheKey = `${provider}:${loc.lat}:${loc.lon}:${loc.units}`;
  const now = Date.now();

  if (!force && cache.data && cache.key === cacheKey && now - cache.at < CACHE_MS) {
    return { ...cache.data, cached: true, location: loc };
  }

  try {
    const data =
      provider === 'openweathermap'
        ? await fetchOpenWeatherMap(loc)
        : await fetchOpenMeteo(loc);
    const payload = { ...data, provider, location: loc, fetchedAt: new Date().toISOString() };
    cache = { key: cacheKey, at: now, data: payload };
    return { ...payload, cached: false };
  } catch (err) {
    // Graceful degradation: serve stale cache if we have it.
    if (cache.data && cache.key === cacheKey) {
      return { ...cache.data, cached: true, stale: true, error: err.message, location: loc };
    }
    const e = new Error(`Weather unavailable: ${err.message}`);
    e.status = 503;
    throw e;
  }
}
