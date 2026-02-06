
(() => {
  const API_KEY = "9386da1d064f37318d425f07bfdd21c5"; 
  const PROXY = url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
  const DEFAULT_TIMEOUT = 10000; //ms

  function formatDateParts(epochSeconds) {
    if (epochSeconds == null) return { date: "-", time: "-" };
    const d = new Date(epochSeconds * 1000);
    return {
      date: d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }),
      time: d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    };
  }

  async function fetchViaProxy(url, timeout = DEFAULT_TIMEOUT) {
    const proxied = PROXY(url);
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      const resp = await fetch(proxied, { signal: controller.signal });
      clearTimeout(id);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  }

  async function fetchAQIData(lat, lon) {
    try {
      const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`;
      const data = await fetchViaProxy(url);
      if (!data?.list?.length) return;
      const comps = data.list[0].components || {};
      document.getElementById("no2Value").innerText = comps.no2 ?? "-";
      document.getElementById("o3Value").innerText = comps.o3 ?? "-";
      document.getElementById("coValue").innerText = comps.co ?? "-";
      document.getElementById("so2Value").innerText = comps.so2 ?? "-";
    } catch (err) {
      console.warn("AQI fetch failed:", err.message || err);
      // keep UI graceful
      document.getElementById("no2Value").innerText = "-";
      document.getElementById("o3Value").innerText = "-";
      document.getElementById("coValue").innerText = "-";
      document.getElementById("so2Value").innerText = "-";
    }
  }

  async function nextFiveDays(lat, lon) {
    try {
      const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
      const data = await fetchViaProxy(url);
      if (!data?.list) return;

      const daily = {};
      data.list.forEach(item => {
        const date = item.dt_txt.split(" ")[0];
        if (!daily[date]) {
          daily[date] = {
            temp: Number(item.main.temp).toFixed(1),
            icon: item.weather?.[0]?.icon,
            day: new Date(date).toLocaleDateString(undefined, { weekday: 'long' })
          };
        }
      });

      const keys = Object.keys(daily).slice(0, 5);
      let html = "";
      keys.forEach(date => {
        const f = daily[date];
        const iconUrl = f.icon ? `https://openweathermap.org/img/wn/${f.icon}@2x.png` : "./cloud.png";
        html += `
          <div class="forecastRow d-flex align-items-center justify-content-between">
            <div class="d-flex gap-1 align-items-center">
              <img src="${iconUrl}" alt="icon" width="35px">
              <h6 class="m-0">${f.temp} &deg;C</h6>
            </div>
            <h6 class="m-0">${f.day}</h6>
            <h6 class="m-0">${date}</h6>
          </div>
        `;
      });

      document.getElementById("forecastContainer").innerHTML = html;
    } catch (err) {
      console.warn("Forecast fetch failed:", err.message || err);
      document.getElementById("forecastContainer").innerHTML = '<div class="text-muted">Forecast unavailable</div>';
    }
  }

  async function todayTemps(lat, lon) {
  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
    const data = await fetchViaProxy(url);
    if (!data?.list) return;

    const todayDate = new Date().toISOString().split("T")[0];
    const nextDay = new Date(Date.now() + 86400000).toISOString().split("T")[0];

    // Get all slots for today
    let todayList = data.list.filter(i => i.dt_txt.startsWith(todayDate));

    // If less than 6 slots, add from next day
    if (todayList.length < 6) {
      const nextDaySlots = data.list.filter(i => i.dt_txt.startsWith(nextDay));
      todayList = todayList.concat(nextDaySlots).slice(0, 6);
    } else {
      todayList = todayList.slice(0, 6);
    }

    let html = "";
    todayList.forEach(item => {
      const time = new Date(item.dt_txt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      const temp = Number(item.main.temp).toFixed(1);
      const icon = item.weather?.[0]?.icon
        ? `https://openweathermap.org/img/wn/${item.weather[0].icon}@2x.png`
        : "./cloudy.png";

      html += `
        <div class="todayTemp text-center">
          <h6 class="m-0">${time}</h6>
          <img src="${icon}" alt="icon" width="35px">
          <h5>${temp}&deg;C</h5>
        </div>
      `;
    });

    document.getElementById("todayTempContainer").innerHTML = html;
  } catch (err) {
    console.warn("Today temps fetch failed:", err.message || err);
    document.getElementById("todayTempContainer").innerHTML =
      '<div class="text-muted">Hourly data unavailable</div>';
  }
}

  async function fetchData() {
    const input = document.getElementById("cityInput");
    if (!input) { alert("Input not found"); return; }
    const cityName = (input.value || "").trim();
    if (!cityName) { alert("Please enter a city name."); return; }

    const prevCity = document.getElementById("cityName").innerText || "City Name";
    document.getElementById("cityName").innerText = "Loading...";

    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityName)}&appid=${API_KEY}&units=metric`;
      const data = await fetchViaProxy(url);

      if (!data || (data.cod && Number(data.cod) !== 200)) {
        document.getElementById("cityName").innerText = prevCity;
        alert(`Error: ${data?.message || "City not found or API issue."}`);
        return;
      }

      document.getElementById("cityName").innerText = data.name || cityName;
      document.getElementById("cityTemp").innerText = data.main?.temp ?? "-";
      document.getElementById("skyDesc").innerText = data.weather?.[0]?.description ?? "-";
      document.getElementById("humidity").innerText = data.main?.humidity ?? "-";
      document.getElementById("pressure").innerText = data.main?.pressure ?? "-";
      document.getElementById("feelsLike").innerText = data.main?.feels_like ?? "-";
      document.getElementById("visibility").innerText = data.visibility ?? "-";

      const dtParts = formatDateParts(data.dt);
      document.getElementById("date").innerText = dtParts.date;
      document.getElementById("time").innerText = dtParts.time;

      const sr = formatDateParts(data.sys?.sunrise);
      const ss = formatDateParts(data.sys?.sunset);
      document.getElementById("sunriseTime").innerText = sr.time ?? "-";
      document.getElementById("sunsetTime").innerText = ss.time ?? "-";

      const lat = data.coord?.lat, lon = data.coord?.lon;
      if (lat != null && lon != null) {
        fetchAQIData(lat, lon);
        nextFiveDays(lat, lon);
        todayTemps(lat, lon);
      }
    } catch (err) {
      console.error("fetchData error:", err);
      alert("Failed to fetch weather. See console for details.");
      document.getElementById("cityName").innerText = prevCity;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("cityInput");
    if (input) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); fetchData(); }
      });
    }
    const searchIcon = document.getElementById("searchIcon");
    if (searchIcon) searchIcon.addEventListener("click", fetchData);
    window.fetchData = fetchData;
  });

})();


