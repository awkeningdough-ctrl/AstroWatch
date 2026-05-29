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

async function fetchWikiImage(title) {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&pithumbsize=400&format=json&origin=*`
    );
    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return null;
    const page = Object.values(pages)[0];
    return page?.thumbnail?.source || null;
  } catch {
    return null;
  }
}

async function enrichAstronaut(a) {
  let image = PLACEHOLDER_IMG;
  let description = '';
  let extract = '';
  let url = '';
  let flag = '';

  try {
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(a.name + ' astronaut')}&srlimit=3&format=json&origin=*`
    );
    const searchData = await searchRes.json();
    const results = searchData?.query?.search || [];

    let title = null;
    for (const r of results) {
      const t = r.title.toLowerCase();
      if (!t.includes('disambiguation') && !t.includes('mission') && !t.includes('expedition')) {
        title = r.title;
        break;
      }
    }
    if (!title && results.length > 0) title = results[0].title;

    if (title) {
      const [summaryRes, imgSrc] = await Promise.all([
        fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`),
        fetchWikiImage(title)
      ]);

      const pd = await summaryRes.json();

      image = imgSrc || pd?.thumbnail?.source || pd?.originalimage?.source || PLACEHOLDER_IMG;
      description = pd?.description || '';
      extract = pd?.extract || '';
      url = pd?.content_urls?.desktop?.page || '';
      flag = flagFromDescription(description);
    }
  } catch {}

  return {
    name: a.name,
    craft: a.craft,
    image,
    description,
    extract,
    url,
    flag
  };
}

function buildCardWithRef(person) {
  const node = document.createElement("div");
  node.className = "astronaut-profile-node";
  node.dataset.name = person.name;
  node.innerHTML = `
    <div class="avatar-container">
      <img src="${person.image}" class="avatar-img" data-name="${person.name}">
      <span class="flag-badge">${person.flag}</span>
    </div>
    <div class="node-name">${person.name}</div>
    <div class="node-craft">${person.craft}</div>
    <button class="info-btn">PERSONNEL FILE ⓘ</button>
  `;
  node.addEventListener('click', () => openWikiPanel(person.name));
  return node;
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

  const enriched = people.map(a => ({
    name: a.name,
    craft: a.craft,
    image: PLACEHOLDER_IMG,
    description: '',
    extract: '',
    url: '',
    flag: ''
  }));

  for (const p of enriched) astronautWikiData.set(p.name, p);

  container.innerHTML = "";

  for (const p of enriched) container.appendChild(buildCardWithRef(p));

  const footer = document.getElementById("astronaut-feed-footer");
  const countLabel = document.getElementById("astronaut-count-label");
  countLabel.textContent = `SHOWING ${enriched.length} OF ${enriched.length}`;
  footer.style.display = 'flex';
  document.getElementById("show-more-btn").style.display = 'none';

  await Promise.all(
    people.map(async (a, i) => {
      const obj = await enrichAstronaut(a);
      enriched[i] = obj;
      astronautWikiData.set(a.name, obj);

      const imgEl = container.querySelector(`img.avatar-img[data-name="${CSS.escape(a.name)}"]`);
      if (imgEl) {
        imgEl.src = obj.image;
        const flagEl = imgEl.closest('.avatar-container')?.querySelector('.flag-badge');
        if (flagEl) flagEl.textContent = obj.flag;
      }
    })
  );
}

fetchTLE();
getISS();
getAstronauts();

setInterval(getISS, 2000);
setInterval(getAstronauts, 60000);
setInterval(fetchTLE, 1800000);

// ==========================================
// TAB NAVIGATION
// ==========================================

document.querySelectorAll('.nav-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'iss') map.invalidateSize();
  });
});

// ==========================================
// NEAR-EARTH OBJECTS
// ==========================================

const NASA_NEO_KEY = 'DEMO_KEY';

let neoData = [];
let neoSortField = 'date';
let neoHazardousOnly = false;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function daysFromToday(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

(function initNeoDefaults() {
  document.getElementById('neo-start').value = todayStr();
  document.getElementById('neo-end').value = daysFromToday(3);
})();

document.getElementById('neo-fetch-btn').addEventListener('click', fetchNEO);

document.querySelectorAll('.neo-sort-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.neo-sort-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    neoSortField = btn.dataset.sort;
    renderNEO();
  });
});

document.getElementById('neo-hazardous-only').addEventListener('change', e => {
  neoHazardousOnly = e.target.checked;
  renderNEO();
});

async function fetchNEO() {
  const start = document.getElementById('neo-start').value;
  const end = document.getElementById('neo-end').value;

  if (!start || !end) return;

  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffDays = (endDate - startDate) / (1000 * 60 * 60 * 24);

  const statusEl = document.getElementById('neo-status');
  const grid = document.getElementById('neo-grid');

  if (diffDays < 0) {
    statusEl.textContent = 'End date must be after start date.';
    statusEl.style.display = 'block';
    return;
  }
  if (diffDays > 7) {
    statusEl.textContent = 'NASA API supports a maximum range of 7 days.';
    statusEl.style.display = 'block';
    return;
  }

  statusEl.textContent = 'SCANNING...';
  statusEl.style.display = 'block';
  grid.innerHTML = '';
  document.getElementById('neo-sort-row').style.display = 'none';
  document.getElementById('neo-summary-chips').innerHTML = '';

  try {
    const url = `https://api.nasa.gov/neo/rest/v1/feed?start_date=${start}&end_date=${end}&api_key=${NASA_NEO_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    neoData = [];

    for (const [date, objects] of Object.entries(data.near_earth_objects)) {
      for (const obj of objects) {
        const approach = obj.close_approach_data[0];
        neoData.push({
          id: obj.id,
          name: obj.name.replace(/[()]/g, ''),
          date,
          hazardous: obj.is_potentially_hazardous_asteroid,
          diameterMin: obj.estimated_diameter.kilometers.estimated_diameter_min,
          diameterMax: obj.estimated_diameter.kilometers.estimated_diameter_max,
          velocity: parseFloat(approach.relative_velocity.kilometers_per_hour),
          distance: parseFloat(approach.miss_distance.kilometers),
          distanceLunar: parseFloat(approach.miss_distance.lunar),
          orbitingBody: approach.orbiting_body,
          absoluteMagnitude: obj.absolute_magnitude_h,
          nasaUrl: obj.nasa_jpl_url
        });
      }
    }

    const total = data.element_count;
    const hazardous = neoData.filter(n => n.hazardous).length;
    const closest = neoData.reduce((a, b) => a.distance < b.distance ? a : b, neoData[0]);

    renderSummaryChips({ total, hazardous, closest });

    statusEl.style.display = 'none';
    document.getElementById('neo-sort-row').style.display = 'flex';
    renderNEO();

  } catch (e) {
    statusEl.textContent = '⚠️ FAILED TO FETCH NEO DATA. CHECK API KEY OR NETWORK.';
  }
}

function renderSummaryChips({ total, hazardous, closest }) {
  const container = document.getElementById('neo-summary-chips');
  container.innerHTML = `
    <div class="neo-chip">
      <span class="neo-chip-val">${total}</span>
      <span class="neo-chip-label">OBJECTS</span>
    </div>
    <div class="neo-chip neo-chip-danger">
      <span class="neo-chip-val">${hazardous}</span>
      <span class="neo-chip-label">HAZARDOUS</span>
    </div>
    <div class="neo-chip">
      <span class="neo-chip-val">${closest ? closest.distanceLunar.toFixed(1) + ' LD' : '—'}</span>
      <span class="neo-chip-label">CLOSEST PASS</span>
    </div>
  `;
}

function renderNEO() {
  const grid = document.getElementById('neo-grid');
  grid.innerHTML = '';

  let list = neoHazardousOnly ? neoData.filter(n => n.hazardous) : [...neoData];

  if (neoSortField === 'date') {
    list.sort((a, b) => a.date.localeCompare(b.date));
  } else if (neoSortField === 'size') {
    list.sort((a, b) => b.diameterMax - a.diameterMax);
  } else if (neoSortField === 'distance') {
    list.sort((a, b) => a.distance - b.distance);
  } else if (neoSortField === 'velocity') {
    list.sort((a, b) => b.velocity - a.velocity);
  }

  if (list.length === 0) {
    grid.innerHTML = `<div class="neo-empty">No objects match current filters.</div>`;
    return;
  }

  for (const neo of list) {
    grid.appendChild(buildNEOCard(neo));
  }
}

function buildNEOCard(neo) {
  const card = document.createElement('div');
  card.className = 'neo-card' + (neo.hazardous ? ' neo-card-hazardous' : '');

  const avgDiam = ((neo.diameterMin + neo.diameterMax) / 2);
  const diamStr = avgDiam < 1
    ? `${Math.round(avgDiam * 1000)} m`
    : `${avgDiam.toFixed(2)} km`;

  const velStr = Math.round(neo.velocity).toLocaleString();
  const distStr = neo.distanceLunar.toFixed(2);
  const distKmStr = Math.round(neo.distance).toLocaleString();

  const threatLevel = neo.hazardous
    ? (neo.distanceLunar < 5 ? 'CRITICAL' : 'HIGH')
    : neo.distanceLunar < 20 ? 'MODERATE' : 'LOW';

  const threatColors = {
    CRITICAL: '#ef4444',
    HIGH: '#f97316',
    MODERATE: '#eab308',
    LOW: '#10b981'
  };

  card.innerHTML = `
    <div class="neo-card-top">
      <div class="neo-card-name">${neo.name}</div>
      <div class="neo-threat-badge" style="color:${threatColors[threatLevel]};border-color:${threatColors[threatLevel]}20;background:${threatColors[threatLevel]}15;">
        ${threatLevel}
      </div>
    </div>
    <div class="neo-card-date">${neo.date} · ${neo.orbitingBody}</div>
    <div class="neo-card-stats">
      <div class="neo-stat">
        <span class="neo-stat-label">DIAMETER</span>
        <span class="neo-stat-val">${diamStr}</span>
      </div>
      <div class="neo-stat">
        <span class="neo-stat-label">VELOCITY</span>
        <span class="neo-stat-val">${velStr} <span class="neo-stat-unit">km/h</span></span>
      </div>
      <div class="neo-stat">
        <span class="neo-stat-label">MISS DIST</span>
        <span class="neo-stat-val">${distStr} <span class="neo-stat-unit">LD</span></span>
      </div>
      <div class="neo-stat">
        <span class="neo-stat-label">MISS DIST</span>
        <span class="neo-stat-val">${distKmStr} <span class="neo-stat-unit">km</span></span>
      </div>
    </div>
    <div class="neo-card-bar-wrap">
      <div class="neo-card-bar" style="width:${Math.min(100, (1 - neo.distanceLunar / 100) * 100)}%;background:${threatColors[threatLevel]};"></div>
    </div>
    <a class="neo-jpl-link" href="${neo.nasaUrl}" target="_blank" rel="noopener">VIEW NASA JPL DATA ↗</a>
  `;

  return card;
}
