/* US-Vorwahlen Quiz – reine Client-App (Leaflet + TopoJSON). */
(function () {
  'use strict';

  const CODES = window.AC_CODES;
  const STATES = window.AC_STATES;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

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

  const ALL_STATES = Object.keys(STATES).sort((a, b) => STATES[a].localeCompare(STATES[b], 'de'));
  const DEFAULTS = {
    mode: 'random', count: 'all', seqOrder: 'num', seqStart: '', seqState: ALL_STATES[0],
    states: ALL_STATES.slice(), mapStyle: 'light', border: 'thin', hard: false, timer: true, theme: 'auto',
  };
  const settings = Object.assign({}, DEFAULTS, store.get('settings', {}));
  if (!Array.isArray(settings.states)) settings.states = ALL_STATES.slice();
  settings.states = settings.states.filter((s) => STATES[s]);
  const saveSettings = () => store.set('settings', settings);

  let stats = store.get('stats', {});
  if (!stats || typeof stats !== 'object') stats = {};
  let lastErrors = (store.get('lastErrors', []) || []).filter((c) => CODES[c]);

  /* ---------- Daten aufbereiten ---------- */
  const byNum = (a, b) => Number(a) - Number(b);
  const regionCodes = {};
  Object.keys(CODES).sort(byNum).forEach((c) => {
    CODES[c].b.forEach((b) => { (regionCodes[b] = regionCodes[b] || []).push(c); });
  });
  const regionState = {};

  // Westliche Aleuten, Guam und Nördliche Marianen über die Datumsgrenze verschieben,
  // damit der Pazifik zusammenhängend dargestellt wird.
  const SHIFT = new Set(['907', '671', '670']);
  const shift = (c) => {
    if (typeof c[0] === 'number') { if (c[0] > 0) c[0] -= 360; return; }
    c.forEach(shift);
  };
  const topo = window.AC_TOPO;
  const fc = topojson.feature(topo, topo.objects.base);
  fc.features = fc.features.filter((f) => f.geometry);
  fc.features.forEach((f) => {
    regionState[f.properties.id] = f.properties.st;
    if (SHIFT.has(f.properties.id)) shift(f.geometry.coordinates);
  });
  const labelPts = {};
  Object.entries(window.AC_LABELS).forEach(([id, p]) => {
    labelPts[id] = [p[1], SHIFT.has(id) && p[0] > 0 ? p[0] - 360 : p[0]];
  });
  const stateMesh = topojson.mesh(topo, topo.objects.base,
    (a, b) => a !== b && a.properties.st !== b.properties.st);

  /* ---------- Karte ---------- */
  const VIEWS = {
    us: [[24.3, -124.8], [49.4, -66.9]],
    ak: [[51.2, -179.5], [71.4, -129.9]],
    hi: [[18.9, -160.3], [22.3, -154.8]],
    pr: [[17.8, -67.3], [18.6, -64.5]],
    pac: [[-14.4, -216], [21, -150]],
  };
  const map = L.map('map', {
    zoomControl: false, preferCanvas: true, minZoom: 2, maxZoom: 13,
    zoomSnap: 0.25, zoomDelta: 0.5, wheelPxPerZoomLevel: 100, worldCopyJump: false,
    tapTolerance: 20,
  });
  L.control.zoom({ position: 'bottomright', zoomInTitle: 'Hineinzoomen', zoomOutTitle: 'Herauszoomen' }).addTo(map);
  map.attributionControl.addAttribution('Gebiete: UCLA Geoportal (Public Domain)');
  const renderer = L.canvas({ padding: 0.4, tolerance: 0 });
  map.fitBounds(VIEWS.us);

  const TILE_OPTS = {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd', maxZoom: 19, detectRetina: true,
  };
  let tileLayer = null;
  function applyTiles() {
    if (tileLayer) { map.removeLayer(tileLayer); tileLayer = null; }
    const nolabels = settings.hard;
    const s = settings.mapStyle;
    if (s === 'light' || s === 'dark') {
      const name = (s === 'light' ? 'light_' : 'dark_') + (nolabels ? 'nolabels' : 'all');
      tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/' + name + '/{z}/{x}/{y}{r}.png', TILE_OPTS);
    } else if (s === 'sat') {
      tileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Bilder &copy; Esri, Maxar, Earthstar Geographics', maxZoom: 19,
      });
    }
    if (tileLayer) tileLayer.addTo(map).bringToBack();
    document.body.classList.toggle('map-darkish', s === 'dark' || s === 'sat' || (s === 'none' && isDarkUi()));
  }
  const isDarkUi = () => settings.theme === 'dark' ||
    (settings.theme === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);

  /* ---------- Spielzustand ---------- */
  let game = null;          // laufendes Spiel oder Lernmodus
  let activeRegions = new Set(Object.keys(regionCodes));
  const flashSet = new Set();   // kurz rot
  const solutionSet = new Set(); // Lösung (gelb, blinkend)
  const targetSet = new Set();   // markiertes Gebiet (Umgekehrt-Modus)
  let selectedRegion = null;     // Lernmodus
  let pulseOn = false;

  /* ---------- Gebiets-Layer ---------- */
  const layers = {};
  const COLORS = {
    ok: '#22c55e', fail: '#facc15', flash: '#ef4444', target: '#3b82f6', select: '#3b82f6',
  };
  function lineColor() {
    return document.body.classList.contains('map-darkish') ? '#e2e8f0' : '#334155';
  }
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
    const st = regionStatus(id);
    const darkish = document.body.classList.contains('map-darkish');
    const s = {
      renderer, weight: w, color: lineColor(), opacity: w ? 0.75 : 0,
      fillColor: darkish ? '#cbd5e1' : '#64748b', fillOpacity: 0.06,
    };
    switch (st) {
      case 'flash': s.fillColor = COLORS.flash; s.fillOpacity = 0.7; break;
      case 'solution': s.fillColor = COLORS.fail; s.fillOpacity = pulseOn ? 0.9 : 0.45; s.weight = Math.max(w, 2); s.color = '#a16207'; s.opacity = 1; break;
      case 'target': s.fillColor = COLORS.target; s.fillOpacity = pulseOn ? 0.65 : 0.4; s.weight = Math.max(w, 2.5); s.color = '#1d4ed8'; s.opacity = 1; break;
      case 'select': s.fillColor = COLORS.select; s.fillOpacity = 0.4; s.weight = Math.max(w, 2); s.color = '#1d4ed8'; s.opacity = 1; break;
      case 'ok': s.fillColor = COLORS.ok; s.fillOpacity = 0.5; break;
      case 'fail': s.fillColor = COLORS.fail; s.fillOpacity = 0.6; break;
      case 'inactive': s.fillColor = darkish ? '#000' : '#94a3b8'; s.fillOpacity = darkish ? 0.35 : 0.3; break;
      default: break;
    }
    return s;
  }
  const regionLayer = L.geoJSON(fc, {
    renderer,
    style: (f) => regionStyle(f.properties.id),
    onEachFeature: (f, layer) => {
      const id = f.properties.id;
      layers[id] = layer;
      layer.on('click', (e) => { L.DomEvent.stopPropagation(e); onRegionClick(id); });
    },
  }).addTo(map);
  const stateLayer = L.geoJSON(stateMesh, {
    renderer, interactive: false,
    style: () => ({ renderer, weight: 2.2, color: lineColor(), opacity: 0.9 }),
  });

  function restyle(ids) {
    (ids || Object.keys(layers)).forEach((id) => layers[id] && layers[id].setStyle(regionStyle(id)));
  }
  function applyMapLook() {
    applyTiles();
    if (settings.hard) map.removeLayer(stateLayer);
    else {
      stateLayer.addTo(map);
      stateLayer.setStyle({ renderer, weight: settings.border === 'thick' ? 3 : 2.2, color: lineColor(), opacity: 0.9 });
    }
    restyle();
    updateLabels();
  }

  /* ---------- Beschriftungen ---------- */
  const labelLayer = L.layerGroup().addTo(map);
  const labels = {};
  Object.keys(layers).forEach((id) => {
    if (!labelPts[id]) return;
    const m = L.marker(labelPts[id], {
      interactive: false, keyboard: false,
      icon: L.divIcon({ className: 'rlabel', html: '<div></div>', iconSize: [0, 0] }),
    });
    labels[id] = { marker: m, html: null, shown: false, bounds: layers[id].getBounds() };
  });

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
    Object.entries(labels).forEach(([id, L0]) => {
      const codes = labelCodes(id);
      L0.want = false;
      if (!codes.length) return;
      const forced = solutionSet.has(id);
      const sw = map.project(L0.bounds.getSouthWest(), z);
      const ne = map.project(L0.bounds.getNorthEast(), z);
      const w = Math.abs(ne.x - sw.x), h = Math.abs(sw.y - ne.y);
      const need = codes.length > 2 ? 2600 : 900;
      if (!forced && (w * h < need || w < 26 || h < 14)) return;
      const cls = w > 140 && h > 60 ? 'lg' : (w < 60 ? 'sm' : '');
      const cw = cls === 'lg' ? 34 : cls === 'sm' ? 24 : 28;
      const perRow = Math.max(1, Math.min(codes.length, Math.floor((w * 0.9) / cw)));
      const rows = Math.ceil(codes.length / perRow);
      const bw = perRow * cw, bh = rows * (cls === 'lg' ? 16 : 13);
      const c = map.project(L0.marker.getLatLng(), z);
      cand.push({ id, L0, codes, cls, bw, bh, x: c.x, y: c.y, prio: forced ? Infinity : w * h });
    });
    cand.sort((a, b) => b.prio - a.prio);
    const placed = [];
    cand.forEach((k) => {
      const box = [k.x - k.bw / 2, k.y - k.bh / 2, k.x + k.bw / 2, k.y + k.bh / 2];
      const hit = placed.some((p) => box[0] < p[2] && box[2] > p[0] && box[1] < p[3] && box[3] > p[1]);
      if (hit && k.prio !== Infinity) return;
      placed.push(box);
      k.L0.want = true;
      const html = '<div style="max-width:' + (k.bw + 4) + 'px">' +
        k.codes.map(([c, st]) => '<span class="' + st + '">' + c + '</span>').join('') + '</div>';
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
  const stateName = (code) => STATES[CODES[code].s];
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
    const view = map.getBounds();
    if (!force && view.contains(b)) {
      const sz = map.getSize();
      const sw = map.latLngToContainerPoint(b.getSouthWest()), ne = map.latLngToContainerPoint(b.getNorthEast());
      if (Math.abs(ne.x - sw.x) > 12 && Math.abs(sw.y - ne.y) > 12 && sz.x > 0) return;
    }
    map.flyToBounds(b, { paddingTopLeft: topPad(), paddingBottomRight: bottomPad(), maxZoom: maxZoom || 8, duration: 0.6 });
  }
  function selectedPool() {
    const st = new Set(settings.states);
    return Object.keys(CODES).filter((c) => st.has(CODES[c].s)).sort(byNum);
  }
  function weight(code) {
    const s = stats[code];
    if (!s) return 1.5;
    const w = (1 + 2.5 * (s.w || 0)) / (1 + (s.r || 0));
    return Math.min(8, Math.max(0.25, w));
  }
  function weightedShuffle(items, wfn) {
    return items
      .map((it) => ({ it, k: Math.pow(Math.random(), 1 / wfn(it)) }))
      .sort((a, b) => b.k - a.k)
      .map((x) => x.it);
  }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function record(code, right) {
    const s = stats[code] || (stats[code] = { r: 0, w: 0 });
    if (right) s.r++; else s.w++;
    s.t = Date.now();
    store.set('stats', stats);
  }

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
      setupUi();
      restyle(); updateLabels();
      return;
    }
    if (mode === 'random') {
      queue = weightedShuffle(pool, weight).slice(0, limit);
    } else if (mode === 'seq') {
      if (settings.seqOrder === 'num') {
        const start = parseInt(settings.seqStart, 10) || 0;
        queue = pool.filter((c) => Number(c) >= start);
        if (!queue.length) queue = pool.slice();
      } else {
        const order = ALL_STATES.filter((s) => settings.states.includes(s));
        let si = order.indexOf(settings.seqState);
        if (si < 0) si = 0;
        order.slice(si).forEach((s) => {
          pool.filter((c) => CODES[c].s === s).forEach((c) => queue.push(c));
        });
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
        // akzeptiert wird jede Vorwahl, die das ganze markierte Gebiet abdeckt
        g.accept = Object.keys(CODES).filter((c) => g.bases.every((b) => CODES[c].b.includes(b))).sort(byNum);
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
      errors: [], revealed: {}, start: Date.now(), lock: false, input: '', timer: 0,
      total: queue.length,
    };
    game.timer = setInterval(updateHud, 1000);
    setupUi();
    restyle(); updateLabels();
    if (mode === 'seq' || mode === 'repeat' || mode === 'random') map.flyToBounds(VIEWS.us, { duration: 0.5 });
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
    $('#btnSkip').hidden = !game || isLearn;
    $('#numpad').hidden = !isRev;
    document.body.classList.toggle('np-open', !!isRev);
    if (isLearn) {
      $('#taskMain').textContent = 'Lernmodus';
      $('#taskSub').textContent = 'Tippe auf ein Gebiet für Details';
    }
    updateHud();
  }

  function updateHud() {
    const g = game;
    const on = g && g.mode !== 'learn';
    $('#chipProgress').textContent = on ? Math.min(g.answered, g.total) + '/' + g.total : '';
    $('#chipErrors').textContent = on ? '✗ ' + g.mistakes : '';
    $('#chipTimer').textContent = on && settings.timer ? fmtTime(Date.now() - g.start) : '';
  }

  /* ---------- Fragen ---------- */
  let pulseTimer = 0;
  function startPulse() {
    clearInterval(pulseTimer);
    pulseTimer = setInterval(() => {
      pulseOn = !pulseOn;
      restyle([...solutionSet, ...targetSet]);
    }, 450);
  }

  function current() { return game.queue[game.idx]; }

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
      $('#taskSub').textContent = (settings.hard ? '' : STATES[CODES[item.codes[0]].s]) +
        (item.accept.length > 1 ? (settings.hard ? '' : ' · ') + item.accept.length + ' Vorwahlen möglich' : '');
      renderNumpad('');
      restyle(item.bases);
      startPulse();
      showBounds(item.bases, true);
    } else {
      $('#taskMain').innerHTML = 'Wo liegt <span class="code">' + item + '</span>?';
      $('#taskSub').textContent = g.mode === 'seq' && settings.seqOrder === 'state' ? stateName(item) : '';
    }
    updateHud();
  }

  function onRegionClick(id) {
    if (!game) return;
    if (game.mode === 'learn') { showInfo(id); return; }
    if (game.mode === 'reverse' || game.lock) return;
    if (!activeRegions.has(id)) return;
    const code = current();
    if (CODES[code].b.includes(id)) answerRight(code);
    else answerWrong(code, id);
  }

  function answerRight(code, extraMsg, item) {
    const g = game;
    const first = g.attempts === 0;
    g.lock = true;
    const revealCodes = item ? item.codes : [code];
    revealCodes.forEach((c) => { g.revealed[c] = 'ok'; });
    record(code, first);
    if (first) g.firstTry++; else g.errors.push(item ? item.accept.join('/') : code);
    g.answered++;
    toast('✓ ' + code + (extraMsg || ''), 'ok', extraMsg ? 1800 : 900);
    restyle(item ? item.bases : CODES[code].b);
    updateLabels();
    g.idx++;
    setTimeout(() => { if (game === g) nextQuestion(); }, extraMsg ? 1100 : 350);
  }

  function answerWrong(code, clickedId) {
    const g = game;
    g.mistakes++;
    g.attempts++;
    if (clickedId) {
      flashSet.add(clickedId);
      restyle([clickedId]);
      setTimeout(() => { flashSet.delete(clickedId); restyle([clickedId]); }, 550);
    }
    const left = 3 - g.attempts;
    if (left <= 0) { showSolution(code); return; }
    let msg = '✗ Falsch';
    if (clickedId && !settings.hard) {
      msg += ' – das ist ' + regionCodes[clickedId].join('/') + ' (' + esc(STATES[regionState[clickedId]] || '') + ')';
    }
    msg += ' · noch ' + left + (left === 1 ? ' Versuch' : ' Versuche');
    toast(msg, 'err', 1600);
    updateHud();
  }

  function showSolution(code) {
    const g = game;
    g.lock = true;
    const item = current();
    const codes = g.mode === 'reverse' ? item.codes : [code];
    const bases = g.mode === 'reverse' ? item.bases : CODES[code].b;
    codes.forEach((c) => { g.revealed[c] = 'fail'; record(c, false); });
    g.errors.push(g.mode === 'reverse' ? item.accept.join('/') : code);
    g.answered++;
    targetSet.clear();
    bases.forEach((b) => solutionSet.add(b));
    startPulse();
    restyle(bases);
    updateLabels();
    const label = g.mode === 'reverse' ? item.accept.join(', ') : code;
    toast('Lösung: <b>' + label + '</b> – ' + esc(CODES[codes[0]].c.slice(0, 2).join(', ')) + ' (' + esc(stateName(codes[0])) + ')', 'warn', 2400);
    if (g.mode === 'reverse') renderNumpad(item.accept[0], 'err');
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
    if (!g || g.mode === 'learn' || g.lock || g.idx >= g.queue.length) return;
    const item = g.queue.splice(g.idx, 1)[0];
    g.queue.push(item);
    toast('Übersprungen – kommt später nochmal', '', 1000);
    nextQuestion();
  }

  /* ---------- Umgekehrt-Modus: Nummernblock ---------- */
  function renderNumpad(value, cls) {
    const spans = $$('#npDisplay span');
    spans.forEach((s, i) => { s.textContent = value[i] || ''; });
    $('#npDisplay').className = cls || '';
  }
  function npKey(k) {
    const g = game;
    if (!g || g.mode !== 'reverse' || g.lock) return;
    if (k === 'back') { g.input = g.input.slice(0, -1); renderNumpad(g.input); return; }
    if (k === 'ok') { if (g.input.length === 3) submitReverse(); return; }
    if (!/^\d$/.test(k) || g.input.length >= 3) return;
    g.input += k;
    renderNumpad(g.input);
    if (g.input.length === 3) setTimeout(submitReverse, 120);
  }
  function submitReverse() {
    const g = game;
    if (!g || g.lock || g.input.length !== 3) return;
    const item = current();
    const typed = g.input;
    if (item.accept.includes(typed)) {
      renderNumpad(typed, 'ok');
      targetSet.clear();
      const others = item.accept.filter((c) => c !== typed);
      answerRight(typed, others.length ? ' · auch richtig: ' + others.join(', ') : '', item);
    } else {
      renderNumpad(typed, 'err');
      g.input = '';
      if (g.attempts + 1 < 3) setTimeout(() => { if (game === g && !g.lock) renderNumpad(''); }, 500);
      const known = CODES[typed] ? ' – ' + typed + ' liegt in ' + esc(stateName(typed)) : '';
      answerWrong(null, null);
      if (g.attempts < 3) toast('✗ Falsch' + (settings.hard ? '' : known) + ' · noch ' + (3 - g.attempts) + (3 - g.attempts === 1 ? ' Versuch' : ' Versuche'), 'err', 1600);
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
    const errCodes = [...new Set(errs.flatMap((e) => e.split('/')))].filter((c) => CODES[c]);
    if (g.mode === 'reverse') {
      // im Umgekehrt-Modus die exakt markierten Codes merken
      lastErrors = [...new Set(g.queue.filter((it) => errs.includes(it.accept.join('/'))).flatMap((it) => it.codes))];
    } else {
      lastErrors = errCodes;
    }
    store.set('lastErrors', lastErrors);
    $('#numpad').hidden = true;
    document.body.classList.remove('np-open');
    $('#btnSkip').hidden = true;
    $('#taskMain').textContent = 'Runde beendet';
    $('#taskSub').textContent = '';
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
      const first = e.split('/')[0];
      const li = document.createElement('li');
      li.innerHTML = '<b>' + esc(e.replace(/\//g, ' / ')) + '</b><span>' + esc(stateName(first)) +
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
    // abgebrochene Runde: Fehler trotzdem merken, falls vorhanden
    if (game && game.errors && game.errors.length && !game.done) {
      const errCodes = [...new Set(game.errors.flatMap((e) => e.split('/')))].filter((c) => CODES[c]);
      if (game.mode === 'repeat') {
        const answeredOk = new Set(game.queue.slice(0, game.idx).filter((c) => !errCodes.includes(c)));
        lastErrors = [...new Set(lastErrors.filter((c) => !answeredOk.has(c)).concat(errCodes))];
      } else {
        lastErrors = errCodes;
      }
      store.set('lastErrors', lastErrors);
    }
  }

  /* ---------- Lernmodus ---------- */
  function showInfo(id) {
    const prev = selectedRegion;
    selectedRegion = id;
    restyle([prev, id].filter(Boolean));
    const codes = regionCodes[id];
    const shared = codes.length > 1;
    let html = '<h3>' + esc(STATES[regionState[id]] || '') + '</h3>';
    codes.forEach((c) => {
      const info = CODES[c];
      const note = info.b.length > 1 ? 'deckt mehrere Gebiete ab' : (c !== id ? 'Overlay (gleiches Gebiet wie ' + id + ')' : (shared ? 'ursprüngliche Vorwahl' : ''));
      html += '<div class="entry"><span class="big">' + c + '</span>' + esc(info.c.join(', ')) +
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
    const v = $('#learnInput').value.trim();
    if (!CODES[v]) { toast('Vorwahl ' + esc(v) + ' nicht gefunden', 'err'); return; }
    const bases = CODES[v].b;
    showBounds(bases, true);
    showInfo(bases[0]);
    $('#learnInput').blur();
  });
  $('#learnInput').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 3);
    if (e.target.value.length === 3) $('#learnSearch').requestSubmit();
  });

  /* ---------- Modals & Menü ---------- */
  function show(el) { el.hidden = false; const f = el.querySelector('.btn.primary'); if (f && !matchMedia('(hover: none)').matches) f.focus({ preventScroll: true }); }
  function closeModals() { $$('.modal').forEach((m) => { m.hidden = true; }); }
  const anyModalOpen = () => $$('.modal').some((m) => !m.hidden);

  function initSegs() {
    $$('.seg[data-setting]').forEach((seg) => {
      const key = seg.dataset.setting;
      seg.querySelectorAll('button').forEach((b) => {
        b.addEventListener('click', () => {
          settings[key] = b.dataset.value;
          saveSettings();
          syncSegs();
          onSettingChanged(key);
        });
      });
    });
  }
  function syncSegs() {
    $$('.seg[data-setting]').forEach((seg) => {
      const key = seg.dataset.setting;
      seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', String(settings[key]) === b.dataset.value));
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
    $$('input[name="mode"]').forEach((r) => { r.checked = r.value === mode; });
    const rep = $('input[name="mode"][value="repeat"]');
    rep.disabled = !lastErrors.length;
    $('#repeatInfo').textContent = lastErrors.length
      ? lastErrors.length + ' Vorwahl' + (lastErrors.length === 1 ? '' : 'en') + ' aus der letzten Runde'
      : 'Noch keine Fehler gespeichert';
    $('#optCount').hidden = !(mode === 'random' || mode === 'reverse');
    $('#optSeq').hidden = mode !== 'seq';
    $('#seqStartNum').hidden = settings.seqOrder !== 'num';
    $('#seqStartState').hidden = settings.seqOrder !== 'state';
    $('#inpSeqStart').value = settings.seqStart || '';
    const sel = $('#selSeqState');
    const chosen = ALL_STATES.filter((s) => settings.states.includes(s));
    sel.innerHTML = chosen.map((s) => '<option value="' + s + '">' + esc(STATES[s]) + '</option>').join('');
    if (chosen.includes(settings.seqState)) sel.value = settings.seqState;
    const pool = selectedPool();
    $('#selInfo').textContent = 'Auswahl: ' + settings.states.length + ' von ' + ALL_STATES.length +
      ' Staaten/Gebieten · ' + pool.length + ' Vorwahlen' + (settings.hard ? ' · Schwer-Modus' : '');
    // Lernstand
    const seen = Object.keys(stats).filter((c) => CODES[c]);
    const solid = seen.filter((c) => stats[c].r >= 2 && stats[c].r > 2 * stats[c].w).length;
    const weak = seen.filter((c) => stats[c].w > 0).sort((a, b) => weight(b) - weight(a)).slice(0, 10);
    $('#weak').innerHTML = seen.length
      ? '<b>Lernstand:</b> ' + solid + ' von ' + Object.keys(CODES).length + ' Vorwahlen sicher' +
        (weak.length ? '<br>Schwächste: ' + weak.map((c) => '<span class="wk">' + c + '</span>').join('') : '')
      : '';
    $('#btnResume').hidden = !(game && !game.done && game.mode !== 'learn');
    $('#btnStart').textContent = game && !game.done && game.mode !== 'learn' ? 'Neu starten' : 'Start';
  }
  function openMenu() {
    syncSegs(); syncMenu();
    $('#settingsModal').hidden = true;
    $('#resultModal').hidden = true;
    show($('#menuModal'));
  }
  $$('input[name="mode"]').forEach((r) => r.addEventListener('change', () => {
    settings.mode = r.value; saveSettings(); syncMenu();
  }));
  $('#inpSeqStart').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 3);
    settings.seqStart = e.target.value; saveSettings();
  });
  $('#selSeqState').addEventListener('change', (e) => { settings.seqState = e.target.value; saveSettings(); });
  $('#btnStart').addEventListener('click', () => { abortGame(); startGame(settings.mode); });
  $('#btnResume').addEventListener('click', closeModals);
  $('#btnMenu').addEventListener('click', openMenu);
  $('#btnOpenSettings').addEventListener('click', openSettings);
  $('#btnResMenu').addEventListener('click', openMenu);
  $('#btnResAgain').addEventListener('click', () => startGame(game ? game.mode : settings.mode));
  $('#btnResRepeat').addEventListener('click', () => { settings.mode = 'repeat'; saveSettings(); startGame('repeat'); });

  /* Einstellungen */
  function buildStateGrid() {
    const grid = $('#stateGrid');
    grid.innerHTML = '';
    ALL_STATES.forEach((s) => {
      const n = Object.values(CODES).filter((c) => c.s === s).length;
      const lab = document.createElement('label');
      lab.innerHTML = '<input type="checkbox" value="' + s + '"><span>' + esc(STATES[s]) + '</span><span class="ab">' + n + '</span>';
      grid.appendChild(lab);
    });
    grid.addEventListener('change', () => {
      settings.states = $$('#stateGrid input:checked').map((i) => i.value);
      saveSettings(); syncStates();
    });
  }
  function syncStates() {
    $$('#stateGrid input').forEach((i) => { i.checked = settings.states.includes(i.value); });
    $('#stateCount').textContent = '(' + settings.states.length + '/' + ALL_STATES.length + ')';
  }
  function openSettings() {
    syncSegs(); syncStates();
    $('#chkHard').checked = settings.hard;
    $('#chkTimer').checked = settings.timer;
    $('#menuModal').hidden = true;
    show($('#settingsModal'));
  }
  $('#btnAllStates').addEventListener('click', () => { settings.states = ALL_STATES.slice(); saveSettings(); syncStates(); });
  $('#btnNoStates').addEventListener('click', () => { settings.states = []; saveSettings(); syncStates(); });
  $('#chkHard').addEventListener('change', (e) => { settings.hard = e.target.checked; saveSettings(); applyMapLook(); });
  $('#chkTimer').addEventListener('change', (e) => { settings.timer = e.target.checked; saveSettings(); updateHud(); });
  $('#btnResetStats').addEventListener('click', () => {
    if (!confirm('Gesamten Lernstand und gespeicherte Fehler löschen?')) return;
    stats = {}; lastErrors = [];
    store.set('stats', stats); store.set('lastErrors', lastErrors);
    toast('Lernstand zurückgesetzt', 'ok');
  });
  $('#btnCloseSettings').addEventListener('click', () => {
    if (game && !game.done && game.mode !== 'learn') { closeModals(); toast('Staatenauswahl gilt ab der nächsten Runde', '', 1800); openMenu(); }
    else openMenu();
  });

  /* ---------- Kartenausschnitt ---------- */
  $$('#jump button').forEach((b) => b.addEventListener('click', () => {
    map.flyToBounds(VIEWS[b.dataset.jump], { paddingTopLeft: topPad(), paddingBottomRight: bottomPad(), duration: 0.6 });
  }));

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
      if (!$('#settingsModal').hidden) { openMenu(); return; }
      if (!$('#menuModal').hidden) { if (game && game.mode) closeModals(); return; }
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
  buildStateGrid();
  applyTheme();
  openMenu();

  // Für Tests/Debugging
  window.__acq = { get game() { return game; }, map, layers, CODES, regionCodes, startGame, onRegionClick, npKey };
})();
