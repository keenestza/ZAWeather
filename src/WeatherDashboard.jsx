import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  MapPin,
  Wind,
  CalendarDays,
  Trash2,
  RefreshCw,
  CloudRain,
  Sunrise,
  Sunset,
  Thermometer,
  Compass,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./weather.css";

const STORAGE_KEYS = {
  locations: "weather-dashboard-locations",
  active: "weather-dashboard-active",
};

const DEFAULT_LOCATIONS = [
  {
    id: "gordons-bay-za",
    name: "Gordon's Bay",
    admin1: "Western Cape",
    country: "South Africa",
    latitude: -34.1581,
    longitude: 18.8668,
  },
];

const WEATHER_CODES = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Severe thunderstorm with hail",
};

function safeParseLocations(value) {
  if (!value) return DEFAULT_LOCATIONS;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_LOCATIONS;
    const cleaned = parsed.filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.latitude === "number" &&
        typeof item.longitude === "number"
    );
    return cleaned.length ? cleaned : DEFAULT_LOCATIONS;
  } catch {
    return DEFAULT_LOCATIONS;
  }
}

function getWindLabel(speed) {
  if (speed < 5) return "Light";
  if (speed < 15) return "Gentle";
  if (speed < 30) return "Moderate";
  if (speed < 45) return "Fresh";
  if (speed < 60) return "Strong";
  return "Very strong";
}

function formatHour(value) {
  return new Date(value).toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDay(value) {
  return new Date(value).toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatSunTime(value) {
  return new Date(value).toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getWeatherIcon(code, isDay = true) {
  if (code === 0) return isDay ? "🌞" : "🌙";
  if ([1, 2].includes(code)) return isDay ? "🌤️" : "☁️";
  if (code === 3) return "☁️";
  if ([45, 48].includes(code)) return "🌫️";
  if ([51, 53, 55, 56, 57].includes(code)) return "🌦️";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "🌧️";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "❄️";
  if ([95, 96, 99].includes(code)) return "⛈️";
  return isDay ? "🌡️" : "🌙";
}

function WeatherIcon({ code, isDay = true, size = 28 }) {
  return (
    <span title={WEATHER_CODES[code] || "Unknown"} style={{ fontSize: `${size}px` }}>
      {getWeatherIcon(code, isDay)}
    </span>
  );
}

function Card({ title, icon, children, right }) {
  return (
    <section className="card">
      <div className="card-header">
        <h2>
          {icon}
          <span>{title}</span>
        </h2>
        {right ? <div>{right}</div> : null}
      </div>
      <div>{children}</div>
    </section>
  );
}

function StatBox({ icon, label, value }) {
  return (
    <div className="stat-box">
      <div className="stat-label">
        {icon}
        <span>{label}</span>
      </div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{label}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="chart-tooltip-row">
          <span>{entry.name}</span>
          <strong>
            {Math.round(Number(entry.value) || 0)}
            {entry.unit || ""}
          </strong>
        </div>
      ))}
    </div>
  );
}

export default function WeatherDashboard() {
  const [locations, setLocations] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_LOCATIONS;
    return safeParseLocations(window.localStorage.getItem(STORAGE_KEYS.locations));
  });
  const [activeId, setActiveId] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_LOCATIONS[0].id;
    return window.localStorage.getItem(STORAGE_KEYS.active) || DEFAULT_LOCATIONS[0].id;
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [weatherById, setWeatherById] = useState({});
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "ZAWeather";
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.locations, JSON.stringify(locations));
  }, [locations]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.active, activeId);
  }, [activeId]);

  useEffect(() => {
    if (!locations.find((location) => location.id === activeId) && locations[0]) {
      setActiveId(locations[0].id);
    }
  }, [locations, activeId]);

  async function fetchWeatherForLocations() {
    setLoadingWeather(true);
    setError("");

    try {
      const results = await Promise.all(
        locations.map(async (location) => {
          const params = new URLSearchParams({
            latitude: String(location.latitude),
            longitude: String(location.longitude),
            current: [
              "temperature_2m",
              "weather_code",
              "wind_speed_10m",
              "wind_direction_10m",
              "is_day",
              "precipitation",
            ].join(","),
            hourly: [
              "temperature_2m",
              "weather_code",
              "wind_speed_10m",
              "wind_direction_10m",
              "wind_gusts_10m",
              "precipitation_probability",
              "precipitation",
            ].join(","),
            daily: [
              "weather_code",
              "temperature_2m_max",
              "temperature_2m_min",
              "wind_speed_10m_max",
              "sunrise",
              "sunset",
              "precipitation_probability_max",
              "precipitation_sum",
            ].join(","),
            forecast_days: "7",
            timezone: "auto",
            temperature_unit: "celsius",
            wind_speed_unit: "kmh",
            precipitation_unit: "mm",
          });

          const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
          if (!response.ok) {
            throw new Error(`Weather request failed for ${location.name}`);
          }

          const data = await response.json();
          return [location.id, data];
        })
      );

      setWeatherById(Object.fromEntries(results));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load weather data.");
    } finally {
      setLoadingWeather(false);
    }
  }

  useEffect(() => {
    fetchWeatherForLocations();
  }, [locations]);

  useEffect(() => {
    if (!searchTerm || searchTerm.trim().length < 2) {
      setSearchResults([]);
      return undefined;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        setSearching(true);
        const params = new URLSearchParams({
          name: searchTerm.trim(),
          count: "6",
          language: "en",
        });

        const response = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`,
          { signal: controller.signal }
        );
        const data = await response.json();
        setSearchResults(Array.isArray(data.results) ? data.results : []);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setSearchResults([]);
        }
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [searchTerm]);

  const activeLocation = useMemo(
    () => locations.find((location) => location.id === activeId) || locations[0],
    [locations, activeId]
  );

  const activeWeather = activeLocation ? weatherById[activeLocation.id] : null;

  const hourlyRows = useMemo(() => {
    if (!activeWeather?.hourly?.time) return [];
    return activeWeather.hourly.time.slice(0, 24).map((time, index) => ({
      time,
      hourLabel: formatHour(time),
      temperature: activeWeather.hourly.temperature_2m?.[index] ?? 0,
      windSpeed: activeWeather.hourly.wind_speed_10m?.[index] ?? 0,
      windDirection: activeWeather.hourly.wind_direction_10m?.[index] ?? 0,
      gusts: activeWeather.hourly.wind_gusts_10m?.[index] ?? 0,
      weatherCode: activeWeather.hourly.weather_code?.[index] ?? 0,
      precipitationProbability: activeWeather.hourly.precipitation_probability?.[index] ?? 0,
      precipitation: activeWeather.hourly.precipitation?.[index] ?? 0,
    }));
  }, [activeWeather]);

  const dailyRows = useMemo(() => {
    if (!activeWeather?.daily?.time) return [];
    return activeWeather.daily.time.map((time, index) => ({
      time,
      weatherCode: activeWeather.daily.weather_code?.[index] ?? 0,
      max: activeWeather.daily.temperature_2m_max?.[index] ?? 0,
      min: activeWeather.daily.temperature_2m_min?.[index] ?? 0,
      windMax: activeWeather.daily.wind_speed_10m_max?.[index] ?? 0,
      sunrise: activeWeather.daily.sunrise?.[index] ?? null,
      sunset: activeWeather.daily.sunset?.[index] ?? null,
      precipitationProbabilityMax: activeWeather.daily.precipitation_probability_max?.[index] ?? 0,
      precipitationSum: activeWeather.daily.precipitation_sum?.[index] ?? 0,
    }));
  }, [activeWeather]);

  function addLocation(result) {
    const location = {
      id: `${result.latitude}-${result.longitude}`,
      name: result.name,
      admin1: result.admin1 || "",
      country: result.country || "",
      latitude: result.latitude,
      longitude: result.longitude,
    };

    const exists = locations.some((item) => item.id === location.id);
    if (!exists) {
      setLocations((current) => [...current, location]);
    }
    setActiveId(location.id);
    setSearchTerm("");
    setSearchResults([]);
  }

  function removeLocation(id) {
    setLocations((current) => current.filter((item) => item.id !== id));
  }

  return (
    <div className="app-shell">
      <div className="container">
        <div className="top-grid">
          <Card
            title="ZAWeather"
            icon={<CloudRain size={20} />}
            right={
              <button className="btn btn-secondary refresh-btn" onClick={fetchWeatherForLocations}>
                <RefreshCw size={16} className={loadingWeather ? "spin" : ""} />
                <span>{loadingWeather ? "Refreshing..." : "Refresh"}</span>
              </button>
            }
          >
            <p className="muted">
              ZAWeather — your South African weather dashboard powered by Open-Meteo.
            </p>

            <div className="search-wrap">
              <Search size={16} className="search-icon" />
              <input
                className="search-input"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Add another location, e.g. Cape Town or Durban"
              />
            </div>

            {(searchResults.length > 0 || searching) && (
              <div className="search-results">
                {searching ? (
                  <div className="search-row muted">Searching locations…</div>
                ) : (
                  searchResults.map((result) => (
                    <button
                      key={`${result.id}-${result.latitude}-${result.longitude}`}
                      className="search-row"
                      onClick={() => addLocation(result)}
                    >
                      <div>
                        <div className="result-name">{result.name}</div>
                        <div className="muted small">
                          {[result.admin1, result.country].filter(Boolean).join(", ")}
                        </div>
                      </div>
                      <span className="pill">Add</span>
                    </button>
                  ))
                )}
              </div>
            )}

            <div className="location-pills">
              {locations.map((location) => (
                <div
                  key={location.id}
                  className={`location-pill ${activeId === location.id ? "active" : ""}`}
                >
                  <button className="location-select" onClick={() => setActiveId(location.id)}>
                    <div className="location-pill-title">
                      {[location.name, location.admin1].filter(Boolean).join(", ")}
                    </div>
                    <div className="muted small">{location.country}</div>
                  </button>
                  {locations.length > 1 && (
                    <button
                      className="icon-btn"
                      onClick={() => removeLocation(location.id)}
                      aria-label={`Remove ${location.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card title="Current Conditions" icon={<MapPin size={20} />}>
            {activeLocation && activeWeather?.current ? (
              <div className="current-section">
                <div className="current-head">
                  <WeatherIcon
                    code={activeWeather.current.weather_code}
                    isDay={Boolean(activeWeather.current.is_day)}
                    size={34}
                  />
                  <div className="current-head-text">
                    <div className="current-title">
                      {[activeLocation.name, activeLocation.admin1].filter(Boolean).join(", ")}
                    </div>
                    <div className="muted">{activeLocation.country}</div>
                  </div>
                </div>

                <div className="big-temp">
                  {Math.round(Number(activeWeather.current.temperature_2m) || 0)}°C
                </div>
                <div className="muted">
                  {WEATHER_CODES[activeWeather.current.weather_code] || "Current weather"}
                </div>

                <div className="stats-grid">
                  <StatBox
                    icon={<Wind size={16} />}
                    label="Wind"
                    value={`${Math.round(Number(activeWeather.current.wind_speed_10m) || 0)} km/h`}
                  />
                  <StatBox
                    icon={<CloudRain size={16} />}
                    label="Rain now"
                    value={`${Number(activeWeather.current.precipitation || 0).toFixed(1)} mm`}
                  />
                  <StatBox
                    icon={<Sunrise size={16} />}
                    label="Sunrise"
                    value={dailyRows[0]?.sunrise ? formatSunTime(dailyRows[0].sunrise) : "—"}
                  />
                  <StatBox
                    icon={<Sunset size={16} />}
                    label="Sunset"
                    value={dailyRows[0]?.sunset ? formatSunTime(dailyRows[0].sunset) : "—"}
                  />
                </div>
              </div>
            ) : (
              <div className="muted">Loading current weather…</div>
            )}
          </Card>
        </div>

        {error ? <div className="error-box">{error}</div> : null}

        <div className="middle-grid">
          <Card title="Hourly Wind Chart (Next 24 Hours)" icon={<Wind size={20} />}>
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hourlyRows}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hourLabel" minTickGap={20} />
                  <YAxis yAxisId="left" unit=" km/h" />
                  <YAxis yAxisId="right" orientation="right" unit="%" />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="windSpeed"
                    name="Wind speed"
                    unit=" km/h"
                    stroke="#0284c7"
                    strokeWidth={3}
                    dot={false}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="gusts"
                    name="Gusts"
                    unit=" km/h"
                    stroke="#0f172a"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="6 4"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="precipitationProbability"
                    name="Rain chance"
                    unit="%"
                    stroke="#16a34a"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Rainfall (Next 24 Hours)" icon={<CloudRain size={20} />}>
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyRows}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hourLabel" minTickGap={20} />
                  <YAxis unit=" mm" />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="precipitation"
                    name="Precipitation"
                    unit=" mm"
                    stroke="#2563eb"
                    fill="#93c5fd"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="bottom-grid">
          <Card title="7-Day Forecast" icon={<CalendarDays size={20} />}>
            <div className="forecast-list">
              {dailyRows.map((day, index) => (
                <div key={day.time} className="forecast-row">
                  <div className="forecast-main">
                    <div className="forecast-left">
                      <WeatherIcon
                        code={day.weatherCode}
                        isDay={index === 0 ? Boolean(activeWeather?.current?.is_day) : true}
                      />
                      <div>
                        <div className="result-name">{formatDay(day.time)}</div>
                        <div className="muted small">
                          {WEATHER_CODES[day.weatherCode] || "Forecast"}
                        </div>
                      </div>
                    </div>
                    <div className="forecast-right">
                      <div>
                        {Math.round(day.max)}° / {Math.round(day.min)}°
                      </div>
                      <div className="muted small">Max wind {Math.round(day.windMax)} km/h</div>
                    </div>
                  </div>
                  <div className="forecast-meta">
                    <div>Rain chance {Math.round(day.precipitationProbabilityMax || 0)}%</div>
                    <div>Rain {Number(day.precipitationSum || 0).toFixed(1)} mm</div>
                    <div>Sunrise {day.sunrise ? formatSunTime(day.sunrise) : "—"}</div>
                    <div>Sunset {day.sunset ? formatSunTime(day.sunset) : "—"}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Hourly Conditions (Next 24 Hours)" icon={<Thermometer size={20} />}>
            <div className="hourly-list">
              {hourlyRows.map((hour) => (
                <div key={hour.time} className="hour-row hour-row-detailed">
                  <div className="hour-time">{formatHour(hour.time)}</div>

                  <div className="hour-condition">
                    <WeatherIcon code={hour.weatherCode} isDay size={24} />
                    <div>
                      <div className="result-name small">
                        {WEATHER_CODES[hour.weatherCode] || "Forecast"}
                      </div>
                      <div className="muted small">{Math.round(hour.temperature)}°C</div>
                    </div>
                  </div>

                  <div className="hour-metric">
                    <CloudRain size={16} />
                    <span>{Math.round(hour.precipitationProbability || 0)}%</span>
                  </div>

                  <div className="hour-metric">
                    <CloudRain size={16} />
                    <span>{Number(hour.precipitation || 0).toFixed(1)} mm</span>
                  </div>

                  <div className="hour-metric">
                    <Wind size={16} />
                    <span>{Math.round(hour.windSpeed)} km/h</span>
                  </div>

                  <div className="hour-metric">
                    <RefreshCw size={16} />
                    <span>Gusts {Math.round(hour.gusts)} km/h</span>
                  </div>

                  <div className="hour-metric">
                    <Compass size={16} />
                    <span>{Math.round(hour.windDirection)}°</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}