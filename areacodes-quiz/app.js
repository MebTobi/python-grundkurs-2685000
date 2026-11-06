/* Vorwahlen-Quiz (USA, Brasilien, Indonesien) – reine Client-App (Leaflet + TopoJSON). */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  /* ---------- Länder ---------- */
  const COUNTRIES = {
    us: {
      name: 'USA', flag: '🇺🇸', group: 'Bundesstaat', groups: 'Bundesstaaten', maxLen: 3,
      example: '312', shift: ['907', '671', '670'],
      views: {
        USA: [[24.3, -124.8], [49.4, -66.9]], AK: [[51.2, -179.5], [71.4, -129.9]],
        HI: [[18.9, -160.3], [22.3, -154.8]], PR: [[17.8, -67.3], [18.6, -64.5]],
        Pazifik: [[-14.4, -216], [21, -150]],
      },
    },
    br: {
      name: 'Brasilien', flag: '🇧🇷', group: 'Bundesstaat', groups: 'Bundesstaaten', maxLen: 2,
      example: '47', shift: [],
      views: {
        Brasilien: [[-33.8, -74], [5.3, -34.8]], Süden: [[-33.8, -57.7], [-22.5, -48]],
        Südosten: [[-25.4, -53.2], [-14.2, -39.6]], Nordosten: [[-18.4, -48.8], [-1, -34.8]],
        Norden: [[-13.7, -74], [5.3, -44]],
      },
    },
    id: {
      name: 'Indonesien', flag: '🇮🇩', group: 'Provinz', groups: 'Provinzen', maxLen: 3,
      example: '22', shift: [],
      views: {
        Indonesien: [[-11, 95], [6.1, 141]], Sumatra: [[-6, 95], [6, 106.6]],
        Java: [[-8.9, 105], [-5.8, 114.7]], 'Bali–NTT': [[-11, 114.4], [-8, 125.2]],
        Kalimantan: [[-4.2, 108.8], [4.4, 119]], Sulawesi: [[-6.2, 118.7], [4.8, 125.6]],
        'Maluku–Papua': [[-9.2, 124.5], [2.6, 141.1]],
      },
    },
  };

  /* ---------- Speicher (localStorage in try/catch) ---------- */
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem('acq.' + key);
        return v == null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('acq.' + key, JSON.stringify(value)); } catch (e) { /* ignorieren */ }
    },
  };
  // Alte Einzel-Land-Daten (nur USA) übernehmen
  if (store.get('stats.us', null) == null && store.get('stats', null)) {
    store.set('stats.us', store.get('stats', {}));
    store.set('lastErrors.us', store.get('lastErrors', []));
  }

  const DEFAULTS = {
    country: 'us', mode: 'random', count: 'all', mapStyle: 'light', border: 'thin',
    hard: false, timer: true, theme: 'auto', zero: false, per: {},
  };
  const settings = Object.assign({}, DEFAULTS, store.get('settings', {}));
  if (!COUNTRIES[settings.country]) settings.country = 'us';
  if (!settings.per || typeof settings.per !== 'object') settings.per = {};
  const saveSettings = () => store.set('settings', settings);

  /* ---------- Zustand des aktuellen Landes ---------- */
  let cc = null;            // Ländercode
  let CFG = null;           // COUNTRIES[cc]
  let CODES = {}, GROUPS = {}, REGIONS = null;
  let ALL_GROUPS = [];
  let regionCodes = {}, regionState = {}, prefixes = new Set();
  let P = null;             // settings.per[cc]
  let stats = {}, lastErrors = [];

  const byCode = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const fmt = (code) => (cc === 'id' && settings.zero ? '0' : '') + code;
  const groupName = (code) => GROUPS[CODES[code].s] || '';
  const regionDigit = (code) => code[0];

  /* ---------- Karte ---------- */
  const map = L.map('map', {
    zoomControl: false, preferCanvas: true, minZoom: 2, maxZoom: 13,
    zoomSnap: 0.25, zoomDelta: 0.5, wheelPxPerZoomLevel: 100, worldCopyJump: false,
    tapTolerance: 20,
  });
  L.control.zoom({ position: 'bottomright', zoomInTitle: 'Hineinzoomen', zoomOutTitle: 'Herauszoomen' }).addTo(map);
  const renderer = L.canvas({ padding: 0.4, tolerance: 0 });
  map.setView([20, 0], 2);
  const SOURCES = {
    us: 'Gebiete: UCLA Geoportal (Public Domain)',
    br: 'Gebiete: IBGE via geodata-br (CC0), DDD: C. Dourado (CC BY 4.0)',
    id: 'Gebiete: Kemendagri/BIG via Alf-Anas',
  };

  const TILE_OPTS = {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd', maxZoom: 19, detectRetina: true,
  };
  let tileLayer = null;
  const isDarkUi = () => settings.theme === 'dark' ||
    (settings.theme === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  function applyTiles() {
    if (tileLayer) { map.removeLayer(tileLayer); tileLayer = null; }
    const s = settings.mapStyle;
    if (s === 'light' || s === 'dark') {
      const name = (s === 'light' ? 'light_' : 'dark_') + (settings.hard ? 'nolabels' : 'all');
      tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/' + name + '/{z}/{x}/{y}{r}.png', TILE_OPTS);
    } else if (s === 'sat') {
      tileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Bilder &copy; Esri, Maxar, Earthstar Geographics', maxZoom: 19,
      });
    }
    if (tileLayer) tileLayer.addTo(map).bringToBack();
    document.body.classList.toggle('map-darkish', s === 'dark' || s === 'sat' || (s === 'none' && isDarkUi()));
  }

  /* ---------- Spielzustand ---------- */
  let game = null;
  let activeRegions = new Set();
  const flashSet = new Set();
  const solutionSet = new Set();
  const targetSet = new Set();
  let selectedRegion = null;
  let pulseOn = false;
  let pulseTimer = 0;

  /* ---------- Gebiets-Layer ---------- */
  let layers = {};
  let regionLayer = null, stateLayer = null;
  const labelLayer = L.layerGroup().addTo(map);
  let labels = {};
  const COLORS = { ok: '#22c55e', fail: '#facc15', flash: '#ef4444', target: '#3b82f6' };
  const lineColor = () => (document.body.classList.contains('map-darkish') ? '#e2e8f0' : '#334155');

  function regionStatus(id) {
    if (flashSet.has(id)) return 'flash';
    if (solutionSet.has(id)) return 'solution';
    if (targetSet.has(id)) return 'target';
    if (selectedRegion === id) return 'select';
    if (game && game.revealed) {
      let st = null;
      for (const c of regionCodes[id]) {
        const r = game.revealed[c];
        if (r === 'fail') return 'fail';
        if (r === 'ok') st = 'ok';
      }
      if (st) return st;
    }
    if (!activeRegions.has(id)) return 'inactive';
    return 'none';
  }
  function regionStyle(id) {
    const w = { thin: 0.8, thick: 2, none: 0 }[settings.border];
    const darkish = document.body.classList.contains('map-darkish');
    const s = {
      weight: w, color: lineColor(), opacity: w ? 0.75 : 0,
      fillColor: darkish ? '#cbd5e1' : '#64748b', fillOpacity: 0.06,
    };
    switch (regionStatus(id)) {
      case 'flash': s.fillColor = COLORS.flash; s.fillOpacity = 0.7; break;
      case 'solution': Object.assign(s, { fillColor: COLORS.fail, fillOpacity: pulseOn ? 0.9 : 0.45, weight: Math.max(w, 2), color: '#a16207', opacity: 1 }); break;
      case 'target': Object.assign(s, { fillColor: COLORS.target, fillOpacity: pulseOn ? 0.65 : 0.4, weight: Math.max(w, 2.5), color: '#1d4ed8', opacity: 1 }); break;
      case 'select': Object.assign(s, { fillColor: COLORS.target, fillOpacity: 0.4, weight: Math.max(w, 2), color: '#1d4ed8', opacity: 1 }); break;
      case 'ok': s.fillColor = COLORS.ok; s.fillOpacity = 0.5; break;
      case 'fail': s.fillColor = COLORS.fail; s.fillOpacity = 0.6; break;
      case 'inactive': s.fillColor = darkish ? '#000' : '#94a3b8'; s.fillOpacity = darkish ? 0.35 : 0.3; break;
      default: break;
    }
    return s;
  }
  function restyle(ids) {
    (ids || Object.keys(layers)).forEach((id) => layers[id] && layers[id].setStyle(regionStyle(id)));
  }
  function applyMapLook() {
    applyTiles();
    if (!stateLayer) return;
    if (settings.hard) map.removeLayer(stateLayer);
    else {
      stateLayer.addTo(map);
      stateLayer.setStyle({ weight: settings.border === 'thick' ? 3 : 2.2, color: lineColor(), opacity: 0.9 });
    }
    restyle();
    updateLabels();
  }

  /* ---------- Land laden ---------- */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  async function switchCountry(code, keepMenu) {
    if (!COUNTRIES[code]) return;
    abortGame();
    stopGame();
    game = null;
    window.AC_DATA = window.AC_DATA || {};
    if (!window.AC_DATA[code]) {
      toast('Lade ' + COUNTRIES[code].name + ' …', '', 4000);
      try { await loadScript('data/' + code + '.js'); } catch (e) { toast('Daten konnten nicht geladen werden', 'err', 3000); return; }
      $('#toast').className = '';
    }
    setupCountry(code);
    if (!keepMenu) openMenu();
  }

  function setupCountry(code) {
    const D = window.AC_DATA[code];
    cc = code; CFG = COUNTRIES[code];
    settings.country = code; saveSettings();
    CODES = D.codes; GROUPS = D.groups; REGIONS = D.regions || null;
    ALL_GROUPS = Object.keys(GROUPS).filter((g) => Object.values(CODES).some((c) => c.s === g))
      .sort((a, b) => GROUPS[a].localeCompare(GROUPS[b], 'de'));
    P = settings.per[code] = Object.assign({
      states: ALL_GROUPS.slice(), digits: REGIONS ? Object.keys(REGIONS) : [],
      seqOrder: 'num', seqStart: '', seqState: ALL_GROUPS[0], seqRegion: REGIONS ? '1' : '',
    }, settings.per[code] || {});
    P.states = (Array.isArray(P.states) ? P.states : ALL_GROUPS).filter((s) => GROUPS[s]);
    if (!REGIONS && P.seqOrder === 'region') P.seqOrder = 'num';
    saveSettings();
    stats = store.get('stats.' + code, {}) || {};
    lastErrors = (store.get('lastErrors.' + code, []) || []).filter((c) => CODES[c]);

    regionCodes = {}; regionState = {}; prefixes = new Set();
    Object.keys(CODES).sort(byCode).forEach((c) => {
      CODES[c].b.forEach((b) => { (regionCodes[b] = regionCodes[b] || []).push(c); });
      for (let i = 1; i < c.length; i++) prefixes.add(c.slice(0, i));
    });

    // Layer neu aufbauen
    if (regionLayer) map.removeLayer(regionLayer);
    if (stateLayer) map.removeLayer(stateLayer);
    labelLayer.clearLayers();
    layers = {}; labels = {};
    const SHIFT = new Set(CFG.shift);
    const shift = (c) => {
      if (typeof c[0] === 'number') { if (c[0] > 0) c[0] -= 360; return; }
      c.forEach(shift);
    };
    const fc = topojson.feature(D.topo, D.topo.objects.base);
    fc.features = fc.features.filter((f) => f.geometry && regionCodes[f.properties.id]);
    fc.features.forEach((f) => {
      regionState[f.properties.id] = f.properties.st;
      if (SHIFT.has(f.properties.id)) shift(f.geometry.coordinates);
    });
    activeRegions = new Set(Object.keys(regionCodes));
    regionLayer = L.geoJSON(fc, {
      renderer,
      style: (f) => regionStyle(f.properties.id),
      onEachFeature: (f, layer) => {
        const id = f.properties.id;
        layers[id] = layer;
        layer.on('click', (e) => { L.DomEvent.stopPropagation(e); onRegionClick(id); });
      },
    }).addTo(map);
    const mesh = topojson.mesh(D.topo, D.topo.objects.base, (a, b) => a !== b && a.properties.st !== b.properties.st);
    stateLayer = L.geoJSON(mesh, { renderer, interactive: false, style: () => ({ weight: 2.2, color: lineColor(), opacity: 0.9 }) });
    Object.keys(layers).forEach((id) => {
      const p = D.labels[id];
      const ll = p ? [p[1], SHIFT.has(id) && p[0] > 0 ? p[0] - 360 : p[0]] : layers[id].getBounds().getCenter();
      const m = L.marker(ll, {
        interactive: false, keyboard: false,
        icon: L.divIcon({ className: 'rlabel', html: '<div></div>', iconSize: [0, 0] }),
      });
      labels[id] = { marker: m, html: null, shown: false, bounds: layers[id].getBounds() };
    });
    Object.values(SOURCES).forEach((s) => map.attributionControl.removeAttribution(s));
    map.attributionControl.addAttribution(SOURCES[code]);

    // Oberfläche
    $('#countryBtnFlag').textContent = CFG.flag;
    $('#countryBtnName').textContent = CFG.name;
    $$('#countryMenu button, .country-seg button').forEach((b) => b.classList.toggle('on', b.dataset.cc === code));
    document.title = 'Vorwahlen-Quiz – ' + CFG.name;
    buildJump();
    buildStateGrid();
    $('#taskMain').textContent = 'Vorwahlen ' + CFG.name;
    $('#taskSub').textContent = '';
    setupUi();
    applyMapLook();
    fitHome(false);
  }

  function fitHome(animate) {
    const b = Object.values(CFG.views)[0];
    const opts = { paddingTopLeft: topPad(), paddingBottomRight: bottomPad() };
    if (animate) map.flyToBounds(b, Object.assign(opts, { duration: 0.6 }));
    else map.fitBounds(b, opts);
  }
  function buildJump() {
    const nav = $('#jump');
    nav.innerHTML = '';
    Object.entries(CFG.views).forEach(([name, b]) => {
      const btn = document.createElement('button');
      btn.textContent = name;
      btn.addEventListener('click', () => map.flyToBounds(b, { paddingTopLeft: topPad(), paddingBottomRight: bottomPad(), duration: 0.6 }));
      nav.appendChild(btn);
    });
  }

  /* ---------- Beschriftungen ---------- */
  function labelCodes(id) {
    if (!game) return [];
    if (game.mode === 'learn') return regionCodes[id].map((c) => [c, '']);
    const out = [];
    regionCodes[id].forEach((c) => { if (game.revealed[c]) out.push([c, game.revealed[c]]); });
    return out;
  }
  function updateLabels() {
    const z = map.getZoom();
    const cand = [];
    const len = CFG ? CFG.maxLen + (cc === 'id' && settings.zero ? 1 : 0) : 3;
    Object.entries(labels).forEach(([id, L0]) => {
      const codes = labelCodes(id);
      L0.want = false;
      if (!codes.length) return;
      const forced = solutionSet.has(id);
      const sw = map.project(L0.bounds.getSouthWest(), z);
      const ne = map.project(L0.bounds.getNorthEast(), z);
      const w = Math.abs(ne.x - sw.x), h = Math.abs(sw.y - ne.y);
      const need = codes.length > 2 ? 2600 : 900;
      if (!forced && (w * h < need || w < 8 * len + 2 || h < 14)) return;
      const cls = w > 140 && h > 60 ? 'lg' : (w < 60 ? 'sm' : '');
      const cw = (cls === 'lg' ? 10 : cls === 'sm' ? 7 : 8.5) * len + 6;
      const perRow = Math.max(1, Math.min(codes.length, Math.floor((w * 0.9) / cw)));
      const rows = Math.ceil(codes.length / perRow);
      const bw = perRow * cw, bh = rows * (cls === 'lg' ? 16 : 13);
      const c = map.project(L0.marker.getLatLng(), z);
      cand.push({ L0, codes, cls, bw, bh, x: c.x, y: c.y, prio: forced ? Infinity : w * h });
    });
    cand.sort((a, b) => b.prio - a.prio);
    const placed = [];
    cand.forEach((k) => {
      const box = [k.x - k.bw / 2, k.y - k.bh / 2, k.x + k.bw / 2, k.y + k.bh / 2];
      const hit = placed.some((p) => box[0] < p[2] && box[2] > p[0] && box[1] < p[3] && box[3] > p[1]);
      if (hit && k.prio !== Infinity) return;
      placed.push(box);
      k.L0.want = true;
      const html = '<div style="max-width:' + Math.ceil(k.bw + 4) + 'px">' +
        k.codes.map(([c, st]) => '<span class="' + st + '">' + fmt(c) + '</span>').join('') + '</div>';
      const key = k.cls + html;
      if (k.L0.html !== key) {
        k.L0.marker.setIcon(L.divIcon({ className: 'rlabel ' + k.cls, html, iconSize: [0, 0] }));
        k.L0.html = key;
      }
    });
    Object.values(labels).forEach((L0) => {
      if (L0.want && !L0.shown) { labelLayer.addLayer(L0.marker); L0.shown = true; }
      if (!L0.want && L0.shown) { labelLayer.removeLayer(L0.marker); L0.shown = false; }
    });
  }
  map.on('zoomend', updateLabels);

  /* ---------- Helfer ---------- */
  const fmtTime = (ms) => {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(sec).padStart(2, '0');
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  let toastTimer = 0;
  function toast(msg, kind, ms) {
    const t = $('#toast');
    t.innerHTML = msg;
    t.className = 'show ' + (kind || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = kind || ''; }, ms || 1400);
  }
  function boundsOf(bases) {
    let b = null;
    bases.forEach((id) => {
      if (!layers[id]) return;
      const lb = layers[id].getBounds();
      if (b) b.extend(lb); else b = L.latLngBounds(lb.getSouthWest(), lb.getNorthEast());
    });
    return b;
  }
  function topPad() { return [24, ($('#topbar').getBoundingClientRect().bottom || 70) + 16]; }
  function bottomPad() { return [24, $('#numpad').hidden ? 70 : $('#numpad').offsetHeight + 30]; }
  function showBounds(bases, force, maxZoom) {
    const b = boundsOf(bases);
    if (!b) return;
    if (!force && map.getBounds().contains(b)) {
      const sw = map.latLngToContainerPoint(b.getSouthWest()), ne = map.latLngToContainerPoint(b.getNorthEast());
      if (Math.abs(ne.x - sw.x) > 12 && Math.abs(sw.y - ne.y) > 12) return;
    }
    map.flyToBounds(b, { paddingTopLeft: topPad(), paddingBottomRight: bottomPad(), maxZoom: maxZoom || 8, duration: 0.6 });
  }
  function selectedPool() {
    const st = new Set(P.states);
    const dg = REGIONS ? new Set(P.digits) : null;
    return Object.keys(CODES).filter((c) => st.has(CODES[c].s) && (!dg || dg.has(regionDigit(c)))).sort(byCode);
  }
  function weight(code) {
    const s = stats[code];
    if (!s) return 1.5;
    const w = (1 + 2.5 * (s.w || 0)) / (1 + (s.r || 0));
    return Math.min(8, Math.max(0.25, w));
  }
  function weightedShuffle(items, wfn) {
    return items.map((it) => ({ it, k: Math.pow(Math.random(), 1 / wfn(it)) }))
      .sort((a, b) => b.k - a.k).map((x) => x.it);
  }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function record(code, right) {
    const s = stats[code] || (stats[code] = { r: 0, w: 0 });
    if (right) s.r++; else s.w++;
    s.t = Date.now();
    store.set('stats.' + cc, stats);
  }
  function saveLastErrors() { store.set('lastErrors.' + cc, lastErrors); }

  /* ---------- Spielstart ---------- */
  function startGame(mode) {
    stopGame();
    closeModals();
    $('#toast').className = '';
    const pool = selectedPool();
    activeRegions = new Set();
    pool.forEach((c) => CODES[c].b.forEach((b) => activeRegions.add(b)));
    const limit = settings.count === 'all' ? Infinity : Number(settings.count);
    let queue = [];
    if (mode === 'learn') {
      game = { mode, revealed: {} };
      activeRegions = new Set(Object.keys(regionCodes));
      setupUi(); restyle(); updateLabels();
      return;
    }
    if (mode === 'random') {
      queue = weightedShuffle(pool, weight).slice(0, limit);
    } else if (mode === 'seq') {
      if (P.seqOrder === 'num') {
        const start = (P.seqStart || '').replace(/^0+/, '');
        queue = pool.filter((c) => !start || c >= start);
        if (!queue.length) queue = pool.slice();
      } else if (P.seqOrder === 'region' && REGIONS) {
        const digits = Object.keys(REGIONS).sort();
        const di = Math.max(0, digits.indexOf(P.seqRegion));
        digits.slice(di).forEach((d) => pool.filter((c) => regionDigit(c) === d).forEach((c) => queue.push(c)));
      } else {
        const order = ALL_GROUPS.filter((s) => P.states.includes(s));
        const si = Math.max(0, order.indexOf(P.seqState));
        order.slice(si).forEach((s) => pool.filter((c) => CODES[c].s === s).forEach((c) => queue.push(c)));
      }
    } else if (mode === 'repeat') {
      queue = shuffle(lastErrors.slice());
      queue.forEach((c) => CODES[c].b.forEach((b) => activeRegions.add(b)));
    } else if (mode === 'reverse') {
      const groups = {};
      pool.forEach((c) => {
        const key = CODES[c].b.slice().sort().join(',');
        (groups[key] = groups[key] || { bases: CODES[c].b.slice(), codes: [] }).codes.push(c);
      });
      const list = Object.values(groups);
      list.forEach((g) => {
        g.accept = Object.keys(CODES).filter((c) => g.bases.every((b) => CODES[c].b.includes(b))).sort(byCode);
      });
      queue = weightedShuffle(list, (g) => Math.max(...g.codes.map(weight))).slice(0, limit);
    }
    if (!queue.length) {
      toast(mode === 'repeat' ? 'Keine Fehler zum Wiederholen' : 'Keine Vorwahlen ausgewählt', 'warn', 2200);
      openMenu();
      return;
    }
    game = {
      mode, queue, idx: 0, attempts: 0, mistakes: 0, answered: 0, firstTry: 0,
      errors: [], revealed: {}, start: Date.now(), lock: false, input: '', timer: 0, total: queue.length,
    };
    game.timer = setInterval(updateHud, 1000);
    setupUi(); restyle(); updateLabels();
    if (mode !== 'reverse') fitHome(true);
    nextQuestion();
  }

  function stopGame() {
    if (game && game.timer) clearInterval(game.timer);
    clearInterval(pulseTimer);
    flashSet.clear(); solutionSet.clear(); targetSet.clear();
    selectedRegion = null;
    $('#infoSheet').hidden = true;
    document.body.classList.remove('sheet-open');
  }

  function setupUi() {
    const isLearn = game && game.mode === 'learn';
    const isRev = game && game.mode === 'reverse';
    $('#learnSearch').hidden = !isLearn;
    $('#btnSkip').hidden = !game || isLearn || game.done;
    $('#numpad').hidden = !isRev || game.done;
    document.body.classList.toggle('np-open', !!isRev && !game.done);
    if (isLearn) {
      $('#taskMain').textContent = 'Lernmodus';
      $('#taskSub').textContent = 'Tippe auf ein Gebiet für Details';
      $('#learnInput').placeholder = 'Vorwahl suchen, z. B. ' + fmt(CFG.example);
    }
    if (isRev) buildNumpadDisplay();
    updateHud();
  }
  function updateHud() {
    const g = game;
    const on = g && g.mode !== 'learn';
    $('#chipProgress').textContent = on ? Math.min(g.answered, g.total) + '/' + g.total : '';
    $('#chipErrors').textContent = on ? '✗ ' + g.mistakes : '';
    $('#chipTimer').textContent = on && settings.timer ? fmtTime((g.end || Date.now()) - g.start) : '';
  }

  /* ---------- Fragen ---------- */
  function startPulse() {
    clearInterval(pulseTimer);
    pulseTimer = setInterval(() => { pulseOn = !pulseOn; restyle([...solutionSet, ...targetSet]); }, 450);
  }
  const current = () => game.queue[game.idx];

  function nextQuestion() {
    const g = game;
    flashSet.clear(); solutionSet.clear();
    const prevTarget = [...targetSet];
    targetSet.clear();
    restyle(prevTarget);
    if (g.idx >= g.queue.length) { finish(); return; }
    g.attempts = 0; g.lock = false; g.input = '';
    const item = current();
    if (g.mode === 'reverse') {
      item.bases.forEach((b) => targetSet.add(b));
      $('#taskMain').innerHTML = 'Welche Vorwahl ist <span style="color:var(--accent)">markiert</span>?';
      const parts = [];
      if (!settings.hard) parts.push(groupName(item.codes[0]));
      if (item.accept.length > 1) parts.push(item.accept.length + ' Vorwahlen möglich');
      $('#taskSub').textContent = parts.join(' · ');
      renderNumpad('');
      restyle(item.bases);
      startPulse();
      showBounds(item.bases, true);
    } else {
      $('#taskMain').innerHTML = 'Wo liegt <span class="code">' + fmt(item) + '</span>?';
      let sub = '';
      if (g.mode === 'seq' && P.seqOrder === 'state') sub = groupName(item);
      if (g.mode === 'seq' && P.seqOrder === 'region' && REGIONS) sub = 'Region ' + item[0] + 'x · ' + REGIONS[item[0]];
      $('#taskSub').textContent = sub;
    }
    updateHud();
  }

  function onRegionClick(id) {
    if (!game) return;
    if (game.mode === 'learn') { showInfo(id); return; }
    if (game.mode === 'reverse' || game.lock || game.done) return;
    if (!activeRegions.has(id)) return;
    const code = current();
    if (CODES[code].b.includes(id)) answerRight(code);
    else answerWrong(id);
  }

  function answerRight(code, extraMsg, item) {
    const g = game;
    const first = g.attempts === 0;
    g.lock = true;
    (item ? item.codes : [code]).forEach((c) => { g.revealed[c] = 'ok'; });
    record(code, first);
    if (first) g.firstTry++; else g.errors.push(item ? item.accept.join('/') : code);
    g.answered++;
    updateHud();
    toast('✓ ' + fmt(code) + (extraMsg || ''), 'ok', extraMsg ? 1800 : 900);
    restyle(item ? item.bases : CODES[code].b);
    updateLabels();
    g.idx++;
    setTimeout(() => { if (game === g) nextQuestion(); }, extraMsg ? 1100 : 350);
  }

  function attemptsMsg(left) { return ' · noch ' + left + (left === 1 ? ' Versuch' : ' Versuche'); }

  function answerWrong(clickedId, typedMsg) {
    const g = game;
    g.mistakes++;
    g.attempts++;
    if (clickedId) {
      flashSet.add(clickedId);
      restyle([clickedId]);
      setTimeout(() => { flashSet.delete(clickedId); restyle([clickedId]); }, 550);
    }
    const left = 3 - g.attempts;
    if (left <= 0) { showSolution(); return; }
    let msg = '✗ Falsch';
    if (clickedId && !settings.hard) {
      msg += ' – das ist ' + regionCodes[clickedId].map(fmt).join('/') + ' (' + esc(GROUPS[regionState[clickedId]] || '') + ')';
    }
    if (typedMsg && !settings.hard) msg += typedMsg;
    toast(msg + attemptsMsg(left), 'err', 1600);
    updateHud();
  }

  function showSolution() {
    const g = game;
    g.lock = true;
    const item = current();
    const rev = g.mode === 'reverse';
    const codes = rev ? item.codes : [item];
    const bases = rev ? item.bases : CODES[item].b;
    codes.forEach((c) => { g.revealed[c] = 'fail'; record(c, false); });
    g.errors.push(rev ? item.accept.join('/') : item);
    g.answered++;
    targetSet.clear();
    bases.forEach((b) => solutionSet.add(b));
    startPulse();
    restyle(bases);
    updateLabels();
    const label = rev ? item.accept.map(fmt).join(', ') : fmt(item);
    toast('Lösung: <b>' + label + '</b> – ' + esc(CODES[codes[0]].c.slice(0, 2).join(', ')) + ' (' + esc(groupName(codes[0])) + ')', 'warn', 2400);
    if (rev) renderNumpad(item.accept[0], 'err');
    else showBounds(bases, false, 6.5);
    updateHud();
    g.idx++;
    setTimeout(() => {
      if (game !== g) return;
      solutionSet.clear();
      restyle(bases);
      nextQuestion();
    }, 2300);
  }

  function skip() {
    const g = game;
    if (!g || g.mode === 'learn' || g.lock || g.done || g.idx >= g.queue.length) return;
    g.queue.push(g.queue.splice(g.idx, 1)[0]);
    toast('Übersprungen – kommt später nochmal', '', 1000);
    nextQuestion();
  }

  /* ---------- Umgekehrt-Modus: Nummernblock ---------- */
  function buildNumpadDisplay() {
    const d = $('#npDisplay');
    const zero = cc === 'id' && settings.zero;
    d.innerHTML = (zero ? '<span class="fixed">0</span>' : '') + '<span></span>'.repeat(CFG.maxLen);
  }
  function renderNumpad(value, cls) {
    const spans = $$('#npDisplay span:not(.fixed)');
    spans.forEach((s, i) => { s.textContent = value[i] || ''; });
    $('#npDisplay').className = cls || '';
  }
  function npKey(k) {
    const g = game;
    if (!g || g.mode !== 'reverse' || g.lock || g.done) return;
    if (k === 'back') { g.input = g.input.slice(0, -1); renderNumpad(g.input); return; }
    if (k === 'ok') { if (g.input.length) submitReverse(); return; }
    if (!/^\d$/.test(k) || g.input.length >= CFG.maxLen) return;
    if (k === '0' && !g.input && cc === 'id') return; // führende 0 ignorieren
    g.input += k;
    renderNumpad(g.input);
    const complete = g.input.length === CFG.maxLen || (CODES[g.input] && !prefixes.has(g.input));
    if (complete) setTimeout(submitReverse, 120);
  }
  function submitReverse() {
    const g = game;
    if (!g || g.lock || !g.input) return;
    const item = current();
    const typed = g.input;
    if (item.accept.includes(typed)) {
      renderNumpad(typed, 'ok');
      targetSet.clear();
      const others = item.accept.filter((c) => c !== typed).map(fmt);
      answerRight(typed, others.length ? ' · auch richtig: ' + others.join(', ') : '', item);
    } else {
      renderNumpad(typed, 'err');
      g.input = '';
      setTimeout(() => { if (game === g && !g.lock) renderNumpad(''); }, 500);
      const known = CODES[typed] ? ' – ' + fmt(typed) + ' liegt in ' + esc(groupName(typed)) : '';
      answerWrong(null, known);
    }
  }
  $$('#npKeys button').forEach((b) => b.addEventListener('click', () => npKey(b.dataset.k)));

  /* ---------- Spielende ---------- */
  function finish() {
    const g = game;
    clearInterval(g.timer);
    clearInterval(pulseTimer);
    g.end = Date.now();
    g.done = true;
    const errs = [...new Set(g.errors)];
    if (g.mode === 'reverse') {
      lastErrors = [...new Set(g.queue.filter((it) => errs.includes(it.accept.join('/'))).flatMap((it) => it.codes))];
    } else {
      lastErrors = errs.filter((c) => CODES[c]);
    }
    saveLastErrors();
    setupUi();
    $('#taskMain').textContent = 'Runde beendet';
    $('#taskSub').textContent = CFG.name;
    const rate = g.total ? Math.round((g.firstTry / g.total) * 100) : 0;
    $('#resTitle').textContent = rate === 100 ? 'Perfekt! 🎉' : rate >= 80 ? 'Sehr gut!' : rate >= 50 ? 'Gut gemacht!' : 'Weiter üben!';
    $('#resTime').textContent = fmtTime(g.end - g.start);
    $('#resRate').textContent = rate + ' %';
    $('#resCount').textContent = g.total;
    $('#resErr').textContent = g.mistakes;
    $('#resErrTitle').textContent = errs.length ? 'Fehler (' + errs.length + ')' : 'Keine Fehler – alles im ersten Versuch!';
    const ul = $('#resErrors');
    ul.innerHTML = '';
    errs.forEach((e) => {
      const list = e.split('/');
      const first = list[0];
      const li = document.createElement('li');
      li.innerHTML = '<b>' + esc(list.map(fmt).join(' / ')) + '</b><span>' + esc(groupName(first)) +
        ' <small>' + esc(CODES[first].c.join(', ')) + '</small></span>';
      li.addEventListener('click', () => {
        closeModals();
        const bases = CODES[first].b;
        solutionSet.clear(); bases.forEach((b) => solutionSet.add(b));
        startPulse(); restyle(bases); updateLabels();
        showBounds(bases, true);
        setTimeout(() => { clearInterval(pulseTimer); solutionSet.clear(); restyle(bases); }, 2500);
        $('#taskSub').textContent = 'Menü öffnen für Ergebnis/neue Runde';
      });
      ul.appendChild(li);
    });
    $('#btnResRepeat').disabled = !lastErrors.length;
    updateHud();
    show($('#resultModal'));
  }

  function abortGame() {
    if (!game || !game.errors || !game.errors.length || game.done) return;
    const errCodes = [...new Set(game.errors.flatMap((e) => e.split('/')))].filter((c) => CODES[c]);
    if (game.mode === 'repeat') {
      const answeredOk = new Set(game.queue.slice(0, game.idx).filter((c) => !errCodes.includes(c)));
      lastErrors = [...new Set(lastErrors.filter((c) => !answeredOk.has(c)).concat(errCodes))];
    } else {
      lastErrors = errCodes;
    }
    saveLastErrors();
  }

  /* ---------- Lernmodus ---------- */
  function showInfo(id) {
    const prev = selectedRegion;
    selectedRegion = id;
    restyle([prev, id].filter(Boolean));
    const codes = regionCodes[id];
    let html = '<h3>' + esc(GROUPS[regionState[id]] || '') + '</h3>';
    if (REGIONS) html += '<div class="note">Großregion ' + id[0] + 'x · ' + esc(REGIONS[id[0]]) + '</div>';
    codes.forEach((c) => {
      const info = CODES[c];
      let note = '';
      if (info.b.length > 1) note = 'deckt mehrere Gebiete ab';
      else if (c !== id) note = 'zusätzliche Vorwahl im Gebiet von ' + fmt(id);
      else if (codes.length > 1) note = 'ursprüngliche Vorwahl';
      html += '<div class="entry"><span class="big">' + fmt(c) + '</span>' + esc(info.c.join(', ')) +
        (note ? '<div class="note">' + esc(note) + '</div>' : '') + '</div>';
    });
    $('#infoBody').innerHTML = html;
    $('#infoSheet').hidden = false;
    document.body.classList.add('sheet-open');
  }
  function closeInfo() {
    const prev = selectedRegion;
    selectedRegion = null;
    if (prev) restyle([prev]);
    $('#infoSheet').hidden = true;
    document.body.classList.remove('sheet-open');
  }
  $('#infoSheet .sheet-close').addEventListener('click', closeInfo);
  map.on('click', () => { if (game && game.mode === 'learn') closeInfo(); });
  $('#learnSearch').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('#learnInput').value.trim().replace(/^0+/, '');
    if (!CODES[v]) { toast('Vorwahl ' + esc($('#learnInput').value) + ' nicht gefunden', 'err'); return; }
    const bases = CODES[v].b;
    showBounds(bases, true);
    showInfo(bases[0]);
    $('#learnInput').blur();
  });
  $('#learnInput').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, CFG.maxLen + 1);
    const v = e.target.value.replace(/^0+/, '');
    if (CODES[v] && !prefixes.has(v)) $('#learnSearch').requestSubmit();
  });

  /* ---------- Modals & Menü ---------- */
  function show(el) {
    el.hidden = false;
    const f = el.querySelector('.btn.primary');
    if (f && !matchMedia('(hover: none)').matches) f.focus({ preventScroll: true });
  }
  function closeModals() { $$('.modal').forEach((m) => { m.hidden = true; }); }
  const anyModalOpen = () => $$('.modal').some((m) => !m.hidden);

  // Segment-Schalter: globale Einstellungen oder (data-per) Einstellungen des Landes
  function segTarget(seg) { return seg.dataset.per ? P : settings; }
  function initSegs() {
    $$('.seg[data-setting]').forEach((seg) => {
      seg.querySelectorAll('button').forEach((b) => {
        b.addEventListener('click', () => {
          segTarget(seg)[seg.dataset.setting] = b.dataset.value;
          saveSettings(); syncSegs();
          onSettingChanged(seg.dataset.setting);
        });
      });
    });
  }
  function syncSegs() {
    $$('.seg[data-setting]').forEach((seg) => {
      const val = String(segTarget(seg)[seg.dataset.setting]);
      seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', val === b.dataset.value));
    });
  }
  function onSettingChanged(key) {
    if (key === 'mapStyle' || key === 'border') applyMapLook();
    if (key === 'theme') applyTheme();
    if (key === 'seqOrder') syncMenu();
  }
  function applyTheme() {
    if (settings.theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', settings.theme);
    applyMapLook();
  }
  if (window.matchMedia) {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(() => applyMapLook());
  }

  function syncMenu() {
    const mode = settings.mode;
    $('#menuTitle').textContent = 'Vorwahlen ' + CFG.name;
    $$('input[name="mode"]').forEach((r) => { r.checked = r.value === mode; });
    $('input[name="mode"][value="repeat"]').disabled = !lastErrors.length;
    $('#repeatInfo').textContent = lastErrors.length
      ? lastErrors.length + ' Vorwahl' + (lastErrors.length === 1 ? '' : 'en') + ' aus der letzten Runde'
      : 'Noch keine Fehler gespeichert';
    $('#modeSeqInfo').textContent = 'Numerisch oder ' + CFG.group + ' für ' + CFG.group + (REGIONS ? ' oder nach Region' : '');
    $('#optCount').hidden = !(mode === 'random' || mode === 'reverse');
    $('#optSeq').hidden = mode !== 'seq';
    $('#seqStateBtn').textContent = 'Nach ' + CFG.group;
    $('#seqRegionBtn').hidden = !REGIONS;
    $('#seqStartNum').hidden = P.seqOrder !== 'num';
    $('#seqStartState').hidden = P.seqOrder !== 'state';
    $('#seqStartRegion').hidden = P.seqOrder !== 'region';
    $('#seqStartStateLbl').firstChild.textContent = 'ab ' + CFG.group + ' ';
    const inp = $('#inpSeqStart');
    inp.value = P.seqStart || '';
    inp.maxLength = CFG.maxLen + 1;
    inp.placeholder = fmt(Object.keys(CODES).sort(byCode)[0]);
    const chosen = ALL_GROUPS.filter((s) => P.states.includes(s));
    const sel = $('#selSeqState');
    sel.innerHTML = chosen.map((s) => '<option value="' + s + '">' + esc(GROUPS[s]) + '</option>').join('');
    if (chosen.includes(P.seqState)) sel.value = P.seqState;
    if (REGIONS) {
      const rs = $('#selSeqRegion');
      rs.innerHTML = Object.keys(REGIONS).sort().map((d) => '<option value="' + d + '">' + d + 'x – ' + esc(REGIONS[d]) + '</option>').join('');
      rs.value = P.seqRegion || '1';
    }
    const pool = selectedPool();
    $('#selInfo').textContent = 'Auswahl: ' + P.states.length + ' von ' + ALL_GROUPS.length + ' ' + CFG.groups +
      (REGIONS && P.digits.length < Object.keys(REGIONS).length ? ' · ' + P.digits.length + ' von 9 Regionen' : '') +
      ' · ' + pool.length + ' Vorwahlen' + (settings.hard ? ' · Schwer-Modus' : '');
    const seen = Object.keys(stats).filter((c) => CODES[c]);
    const solid = seen.filter((c) => stats[c].r >= 2 && stats[c].r > 2 * stats[c].w).length;
    const weak = seen.filter((c) => stats[c].w > 0).sort((a, b) => weight(b) - weight(a)).slice(0, 10);
    $('#weak').innerHTML = seen.length
      ? '<b>Lernstand ' + esc(CFG.name) + ':</b> ' + solid + ' von ' + Object.keys(CODES).length + ' Vorwahlen sicher' +
        (weak.length ? '<br>Schwächste: ' + weak.map((c) => '<span class="wk">' + fmt(c) + '</span>').join('') : '')
      : '';
    const running = game && !game.done && game.mode !== 'learn';
    $('#btnResume').hidden = !running;
    $('#btnStart').textContent = running ? 'Neu starten' : 'Start';
  }
  function openMenu() {
    syncSegs(); syncMenu();
    $('#settingsModal').hidden = true;
    $('#resultModal').hidden = true;
    $('#countryMenu').hidden = true;
    show($('#menuModal'));
  }
  $$('input[name="mode"]').forEach((r) => r.addEventListener('change', () => {
    settings.mode = r.value; saveSettings(); syncMenu();
  }));
  $('#inpSeqStart').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, CFG.maxLen + 1);
    P.seqStart = e.target.value; saveSettings();
  });
  $('#selSeqState').addEventListener('change', (e) => { P.seqState = e.target.value; saveSettings(); });
  $('#selSeqRegion').addEventListener('change', (e) => { P.seqRegion = e.target.value; saveSettings(); });
  $('#btnStart').addEventListener('click', () => { abortGame(); startGame(settings.mode); });
  $('#btnResume').addEventListener('click', closeModals);
  $('#btnMenu').addEventListener('click', openMenu);
  $('#btnOpenSettings').addEventListener('click', openSettings);
  $('#btnResMenu').addEventListener('click', openMenu);
  $('#btnResAgain').addEventListener('click', () => startGame(game ? game.mode : settings.mode));
  $('#btnResRepeat').addEventListener('click', () => { settings.mode = 'repeat'; saveSettings(); startGame('repeat'); });

  /* Länderwahl */
  $('#btnCountry').addEventListener('click', (e) => {
    e.stopPropagation();
    $('#countryMenu').hidden = !$('#countryMenu').hidden;
  });
  document.addEventListener('click', (e) => {
    if (!$('#countryMenu').hidden && !e.target.closest('#countryMenu')) $('#countryMenu').hidden = true;
  });
  $$('#countryMenu button, .country-seg button').forEach((b) => b.addEventListener('click', () => {
    $('#countryMenu').hidden = true;
    if (b.dataset.cc === cc) { if (!$('#menuModal').hidden) return; openMenu(); return; }
    switchCountry(b.dataset.cc);
  }));

  /* Einstellungen */
  function buildStateGrid() {
    const grid = $('#stateGrid');
    grid.innerHTML = '';
    ALL_GROUPS.forEach((s) => {
      const n = Object.values(CODES).filter((c) => c.s === s).length;
      const lab = document.createElement('label');
      lab.innerHTML = '<input type="checkbox" value="' + s + '"><span>' + esc(GROUPS[s]) + '</span><span class="ab">' + n + '</span>';
      grid.appendChild(lab);
    });
    const rg = $('#regionGrid');
    rg.innerHTML = '';
    if (REGIONS) {
      Object.keys(REGIONS).sort().forEach((d) => {
        const n = Object.keys(CODES).filter((c) => c[0] === d).length;
        const lab = document.createElement('label');
        lab.innerHTML = '<input type="checkbox" value="' + d + '"><span><b>' + d + 'x</b> ' + esc(REGIONS[d]) + '</span><span class="ab">' + n + '</span>';
        rg.appendChild(lab);
      });
    }
  }
  $('#stateGrid').addEventListener('change', () => {
    P.states = $$('#stateGrid input:checked').map((i) => i.value);
    saveSettings(); syncStates();
  });
  $('#regionGrid').addEventListener('change', () => {
    P.digits = $$('#regionGrid input:checked').map((i) => i.value);
    saveSettings(); syncStates();
  });
  function syncStates() {
    $$('#stateGrid input').forEach((i) => { i.checked = P.states.includes(i.value); });
    $$('#regionGrid input').forEach((i) => { i.checked = P.digits.includes(i.value); });
    $('#stateTitle').textContent = CFG.groups + ' – ' + CFG.name;
    $('#stateCount').textContent = '(' + P.states.length + '/' + ALL_GROUPS.length + ')';
    $('#regionSection').hidden = !REGIONS;
    $('#zeroToggle').hidden = cc !== 'id';
  }
  function openSettings() {
    syncSegs(); syncStates();
    $('#chkHard').checked = settings.hard;
    $('#chkTimer').checked = settings.timer;
    $('#chkZero').checked = settings.zero;
    $('#menuModal').hidden = true;
    show($('#settingsModal'));
  }
  $('#btnAllStates').addEventListener('click', () => { P.states = ALL_GROUPS.slice(); saveSettings(); syncStates(); });
  $('#btnNoStates').addEventListener('click', () => { P.states = []; saveSettings(); syncStates(); });
  $('#btnAllRegions').addEventListener('click', () => { P.digits = Object.keys(REGIONS || {}); saveSettings(); syncStates(); });
  $('#btnNoRegions').addEventListener('click', () => { P.digits = []; saveSettings(); syncStates(); });
  $('#chkHard').addEventListener('change', (e) => { settings.hard = e.target.checked; saveSettings(); applyMapLook(); });
  $('#chkTimer').addEventListener('change', (e) => { settings.timer = e.target.checked; saveSettings(); updateHud(); });
  $('#chkZero').addEventListener('change', (e) => {
    settings.zero = e.target.checked; saveSettings();
    updateLabels();
    if (game && game.mode === 'reverse' && !game.done) { buildNumpadDisplay(); renderNumpad(game.input || ''); }
    if (game && !game.done && game.mode !== 'learn' && game.mode !== 'reverse') nextQuestionLabelOnly();
  });
  function nextQuestionLabelOnly() {
    const item = current();
    if (item) $('#taskMain').innerHTML = 'Wo liegt <span class="code">' + fmt(item) + '</span>?';
  }
  $('#btnResetStats').addEventListener('click', () => {
    if (!confirm('Lernstand und gespeicherte Fehler für ' + CFG.name + ' löschen?')) return;
    stats = {}; lastErrors = [];
    store.set('stats.' + cc, stats); saveLastErrors();
    toast('Lernstand ' + esc(CFG.name) + ' zurückgesetzt', 'ok');
  });
  $('#btnCloseSettings').addEventListener('click', () => {
    if (game && !game.done && game.mode !== 'learn') toast('Auswahl gilt ab der nächsten Runde', '', 1800);
    openMenu();
  });

  /* ---------- Vollbild & Tastatur ---------- */
  function toggleFullscreen() {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
    } catch (e) { /* nicht unterstützt */ }
  }
  $('#btnFull').addEventListener('click', toggleFullscreen);
  $('#btnSkip').addEventListener('click', skip);
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (e.key === 'Escape') {
      if (!$('#countryMenu').hidden) { $('#countryMenu').hidden = true; return; }
      if (!$('#settingsModal').hidden) { openMenu(); return; }
      if (!$('#menuModal').hidden) { if (game) closeModals(); return; }
      if (!$('#resultModal').hidden) { openMenu(); return; }
      if (!$('#infoSheet').hidden) { closeInfo(); return; }
      openMenu();
      return;
    }
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    if (anyModalOpen()) return;
    const k = e.key.toLowerCase();
    if (k === 'f') { toggleFullscreen(); e.preventDefault(); return; }
    if (k === 'p') { skip(); e.preventDefault(); return; }
    if (game && game.mode === 'reverse') {
      if (/^\d$/.test(e.key)) { npKey(e.key); e.preventDefault(); }
      else if (e.key === 'Backspace') { npKey('back'); e.preventDefault(); }
      else if (e.key === 'Enter') { npKey('ok'); e.preventDefault(); }
    }
  });

  /* ---------- Start ---------- */
  initSegs();
  applyTiles();
  if (settings.theme !== 'auto') document.documentElement.setAttribute('data-theme', settings.theme);
  switchCountry(settings.country);

  // Für Tests/Debugging
  window.__acq = {
    get game() { return game; }, get CODES() { return CODES; }, get layers() { return layers; },
    get cc() { return cc; }, map, startGame, onRegionClick, npKey, switchCountry,
  };
})();
