let loading = false;
let hasCenteredOnce = false;
let tleLine1 = null;
let tleLine2 = null;

const astronautWikiData = new Map();

const PLACEHOLDER_IMG =
  "https://upload.wikimedia.org/wikipedia/commons/9/99/Question_mark_%28black%29.svg";

const PAGE_SIZE = 4;

const NATIONALITY_FLAGS = {
  american: '🇺🇸',
  russian: '🇷🇺',
  soviet: '🇷🇺',
  chinese: '🇨🇳',
  french: '🇫🇷',
  german: '🇩🇪',
  japanese: '🇯🇵',
  italian: '🇮🇹',
  canadian: '🇨🇦',
  british: '🇬🇧',
  danish: '🇩🇰',
  dutch: '🇳🇱',
  belgian: '🇧🇪',
  swedish: '🇸🇪',
  norwegian: '🇳🇴',
  saudi: '🇸🇦',
  emirati: '🇦🇪',
  indian: '🇮🇳',
  israeli: '🇮🇱',
  spanish: '🇪🇸',
  australian: '🇦🇺',
  belarusian: '🇧🇾',
  kazakhstani: '🇰🇿'
};

function flagFromDescription(description) {
  if (!description) return '';
  const lower = description.toLowerCase();
  for (const [key, flag] of Object.entries(NATIONALITY_FLAGS)) {
    if (lower.includes(key)) return flag;
  }
  return '';
}

const map = L.map('map', {
  zoomControl: true,
  minZoom: 2
}).setView([0, 0], 2);

const darkLayer = L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  { attribution: '&copy; OpenStreetMap & CARTO', subdomains: 'abcd', maxZoom: 20 }
);

const satelliteLayer = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 20 }
);

darkLayer.addTo(map);

let isSatellite = false;
const toggleBtn = document.querySelector(".map-overlay-btn");

if (toggleBtn) {
  toggleBtn.addEventListener("click", () => {
    if (!isSatellite) {
      map.removeLayer(darkLayer);
      satelliteLayer.addTo(map);
      toggleBtn.innerText = "✜ DARK VIEW";
    } else {
      map.removeLayer(satelliteLayer);
      darkLayer.addTo(map);
      toggleBtn.innerText = "✜ SATELLITE VIEW";
    }
    isSatellite = !isSatellite;
  });
}

const pastPath = L.polyline([], {
  color: "#3b82f6",
  weight: 2,
  opacity: 0.6
}).addTo(map);

const futurePath = L.polyline([], {
  color: "#3b82f6",
  weight: 2,
  opacity: 0.25,
  dashArray: "6, 8"
}).addTo(map);

let history = [];

function antimeridianSafe(points) {
  const segments = [[]];
  for (let i = 0; i < points.length; i++) {
    const cur = segments[segments.length - 1];
    if (i === 0) {
      cur.push(points[i]);
      continue;
    }
    if (Math.abs(points[i][1] - points[i - 1][1]) > 180) {
      segments.push([points[i]]);
    } else {
      cur.push(points[i]);
    }
  }
  return segments;
}

function pushOrbit(lat, lon) {
  history.push([lat, lon]);
  if (history.length > 140) history.shift();
  pastPath.setLatLngs(antimeridianSafe(history));
  futurePath.setLatLngs(antimeridianSafe(predictFuture(lat, lon)));
}

async function fetchTLE() {
  try {
    const res = await fetch("https://api.wheretheiss.at/v1/satellites/25544/tles");
    const data = await res.json();
    tleLine1 = data.line1;
    tleLine2 = data.line2;
  } catch (e) {}
}

function predictFuture(lat, lon) {
  if (tleLine1 && tleLine2 && typeof satellite !== 'undefined') {
    try {
      const satrec = satellite.twoline2satrec(tleLine1, tleLine2);
      const points = [];
      const now = Date.now();

      for (let i = 1; i <= 45; i++) {
        const t = new Date(now + i * 2 * 60 * 1000);
        const pv = satellite.propagate(satrec, t);
        if (!pv || !pv.position) continue;
        const gmst = satellite.gstime(t);
        const geo = satellite.eciToGeodetic(pv.position, gmst);
        points.push([
          satellite.degreesLat(geo.latitude),
          satellite.degreesLong(geo.longitude)
        ]);
      }
      if (points.length > 0) return points;
    } catch (e) {}
  }

  const points = [];
  let latF = lat;
  let lonF = lon;

  for (let i = 1; i <= 30; i++) {
    latF += Math.sin(i / 4) * 0.2;
    lonF += 1.5;
    if (lonF > 180) lonF -= 360;
    if (lonF < -180) lonF += 360;
    points.push([latF, lonF]);
  }

  return points;
}

const issIcon = L.divIcon({
  className: 'iss-custom-marker',
  html: `
    <div style="width:24px;height:24px;border:2px solid #3b82f6;border-radius:50%;background:rgba(59,130,246,0.2);box-shadow:0 0 12px #3b82f6;position:relative;">
      <div style="width:6px;height:6px;background:#fff;border-radius:50%;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);"></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const marker = L.marker([0, 0], { icon: issIcon }).addTo(map);
marker.bindPopup("", { className: "iss-popup", closeButton: false });

async function getISS() {
  if (loading) return;
  loading = true;

  try {
    const res = await fetch("https://api.wheretheiss.at/v1/satellites/25544");
    const data = await res.json();

    const lat = data.latitude;
    const lon = data.longitude;

    document.getElementById("iss-data").innerHTML = `
      <div class="stat-box">
        <span class="stat-label">Latitude</span>
        <span class="stat-value">${lat.toFixed(2)}°</span>
        <span class="stat-unit">${lat >= 0 ? 'N' : 'S'}</span>
      </div>
      <div class="stat-box">
        <span class="stat-label">Longitude</span>
        <span class="stat-value">${lon.toFixed(2)}°</span>
        <span class="stat-unit">${lon >= 0 ? 'E' : 'W'}</span>
      </div>
      <div class="stat-box">
        <span class="stat-label">Altitude</span>
        <span class="stat-value">${Math.round(data.altitude)}</span>
        <span class="stat-unit">km</span>
      </div>
      <div class="stat-box">
        <span class="stat-label">Velocity</span>
        <span class="stat-value">${Math.round(data.velocity).toLocaleString()}</span>
        <span class="stat-unit">km/h</span>
      </div>
    `;

    document.getElementById("timestamp").innerText =
      new Date().toISOString().substr(11, 8);

    marker.setLatLng([lat, lon]);

    if (!hasCenteredOnce) {
      map.setView([lat, lon], 3);
      hasCenteredOnce = true;
    }

    pushOrbit(lat, lon);

    marker.setPopupContent(`
      <div class="iss-popup-content">
        <div class="popup-title">ISS TRACK TARGET</div>
        <div class="popup-row"><b>LAT:</b> ${lat.toFixed(4)}</div>
        <div class="popup-row"><b>LON:</b> ${lon.toFixed(4)}</div>
        <div class="popup-row"><b>ALT:</b> ${Math.round(data.altitude)} km</div>
      </div>
    `);

  } catch (e) {
    document.getElementById("iss-data").innerHTML =
      `<div style="grid-column:span 4;font-size:11px;color:#ef4444;">
        ⚠️ TELEMETRY CONNECTION TIMEOUT
      </div>`;
  } finally {
    loading = false;
  }
}

const wikiPanel = document.getElementById('wiki-panel');
const wikiOverlay = document.getElementById('wiki-overlay');

function openWikiPanel(name) {
  const d = astronautWikiData.get(name);
  if (!d) return;

  document.getElementById('wiki-panel-img').src = d.image || PLACEHOLDER_IMG;
  document.getElementById('wiki-panel-name').textContent = name;
  document.getElementById('wiki-panel-description').textContent = d.description || '';
  document.getElementById('wiki-panel-extract').textContent = d.extract || '';
  document.getElementById('wiki-panel-flag-badge').textContent = d.flag || '';

  const link = document.getElementById('wiki-panel-link');
  if (d.url) {
    link.href = d.url;
    link.style.display = 'block';
  } else {
    link.style.display = 'none';
  }

  wikiPanel.classList.add('open');
  wikiOverlay.classList.add('active');
}

function closeWikiPanel() {
  wikiPanel.classList.remove('open');
  wikiOverlay.classList.remove('active');
}

document.getElementById('wiki-panel-close').addEventListener('click', closeWikiPanel);
wikiOverlay.addEventListener('click', closeWikiPanel);

function buildCard({ name, craft, image, flag }) {
  const node = document.createElement("div");
  node.className = "astronaut-profile-node";
  node.innerHTML = `
    <div class="avatar-container">
      <img src="${image}" class="avatar-img">
      <span class="flag-badge">${flag}</span>
    </div>
    <div class="node-name">${name}</div>
    <div class="node-craft">${craft}</div>
    <button class="info-btn">PERSONNEL FILE ⓘ</button>
  `;
  node.addEventListener('click', () => openWikiPanel(name));
  return node;
}

function renderAstronautPage(allPeople, visibleCount) {
  const container = document.getElementById("astronauts");
  const footer = document.getElementById("astronaut-feed-footer");
  const showMoreBtn = document.getElementById("show-more-btn");
  const countLabel = document.getElementById("astronaut-count-label");

  const slice = allPeople.slice(visibleCount - 4, visibleCount);
  for (const p of slice) container.appendChild(buildCard(p));

  const total = allPeople.length;
  const showing = Math.min(visibleCount, total);

  countLabel.textContent = `SHOWING ${showing} OF ${total}`;
  footer.style.display = 'flex';

  if (showing >= total) {
    showMoreBtn.disabled = true;
    showMoreBtn.textContent = 'ALL CREW SHOWN';
  } else {
    showMoreBtn.disabled = false;
    showMoreBtn.textContent = 'SHOW MORE ↓';
  }
}

const ASTRO_SOURCES = [
  "https://api.open-notify.org/astros.json",
  "https://corquaid.github.io/international-space-station-APIs/JSON/people-in-space.json"
];

async function fetchAstronautList() {
  for (const url of ASTRO_SOURCES) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.people?.length) return data.people;
    } catch (e) {}
  }
  throw new Error();
}

async function getAstronauts() {
  const container = document.getElementById("astronauts");

  let people;
  try {
    people = await fetchAstronautList();
  } catch {
    container.innerHTML = `<p class="feed-status">ASTRONAUT FEED DOWN</p>`;
    return;
  }

  const enriched = await Promise.all(
    people.map(async (a) => {
      let image = PLACEHOLDER_IMG;
      let description = '';
      let extract = '';
      let url = '';
      let flag = '';

      try {
        const s = await fetch(
          `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(a.name)}&format=json&origin=*`
        );
        const sd = await s.json();
        const title = sd?.query?.search?.[0]?.title;

        if (title) {
          const p = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
          );
          const pd = await p.json();

          if (pd?.thumbnail?.source) image = pd.thumbnail.source;
          description = pd?.description || '';
          extract = pd?.extract || '';
          url = pd?.content_urls?.desktop?.page || '';
          flag = flagFromDescription(description);
        }
      } catch {}

      const obj = {
        name: a.name,
        craft: a.craft,
        image,
        description,
        extract,
        url,
        flag
      };

      astronautWikiData.set(a.name, obj);
      return obj;
    })
  );

  container.innerHTML = "";

  let visible = 4;
  renderAstronautPage(enriched, visible);

  const oldBtn = document.getElementById("show-more-btn");
  const newBtn = oldBtn.cloneNode(true);
  oldBtn.parentNode.replaceChild(newBtn, oldBtn);

  newBtn.addEventListener("click", () => {
    visible += 4;
    renderAstronautPage(enriched, visible);
  });
}

fetchTLE();
getISS();
getAstronauts();

setInterval(getISS, 2000);
setInterval(getAstronauts, 60000);
setInterval(fetchTLE, 1800000);