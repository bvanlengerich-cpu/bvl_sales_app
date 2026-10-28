import { icon } from './icons.js';

export const MARKET_ROUTE = '#/market/deutschland';

const copy = {
  de: {
    section: 'Marktinformationen', title: 'Marktpotenzial Deutschland', intro: 'Futtermischwagen-Potenzial nach Landkreis. Wählen Sie mehrere Kreise und passen Sie die Annahmen an.',
    back: 'Zurück', search: 'Landkreis oder Bundesland suchen', searchHint: 'Kreis suchen oder direkt auf der Karte antippen.', noResult: 'Kein passender Landkreis gefunden.',
    map: 'Landkreise', mapHint: 'Kreise antippen. Mit + und − vergrößern oder verkleinern.', resetMap: 'Karte zurücksetzen',
    selection: 'Auswahl', selected: 'Ausgewählte Landkreise', clear: 'Auswahl löschen', empty: 'Noch kein Landkreis ausgewählt.',
    farms: 'Milchviehbetriebe', target: 'Potenzialbetriebe >50 Kühe', cows: 'Milchkühe', potential: 'FMW-Potenzial neu', perYear: 'pro Jahr',
    assumptions: 'Modellannahmen', alt: 'Alternative Fütterungstechnik', years: 'Neuer Futtermischwagen alle … Jahre', used: 'Anteil Gebrauchtmaschinen', defaults: 'Standardwerte wiederherstellen',
    model: 'Berechnung: Milchviehbetriebe × Anteil >50 Kühe × (1 − alternative Technik) ÷ Jahre × (1 − Gebrauchtmaschinen).',
    legend: 'Kartenlegende', none: 'Keine Daten', highlighted: 'Ausgewählt', mapped: 'Datensätze einer Kartenfläche zugeordnet', notMapped: 'ohne aktuelle Kartenfläche',
    loading: 'Marktdaten werden geladen …', error: 'Marktdaten konnten nicht geladen werden.', missing: 'Der Datenstand ist derzeit nicht verfügbar. Bitte wenden Sie sich an einen Admin.', retry: 'Erneut versuchen', unavailable: 'Die Marktanalyse ist nur für BvL-Mitarbeitende und Admins verfügbar.'
  },
  en: {
    section: 'Market information', title: 'Market potential Germany', intro: 'Feed mixer potential by district. Select several districts and adjust the assumptions.',
    back: 'Back', search: 'Search district or federal state', searchHint: 'Search a district or tap it on the map.', noResult: 'No matching district found.',
    map: 'Districts', mapHint: 'Tap a district. Use + and − to zoom.', resetMap: 'Reset map',
    selection: 'Selection', selected: 'Selected districts', clear: 'Clear selection', empty: 'No district selected yet.',
    farms: 'Dairy farms', target: 'Potential farms with >50 cows', cows: 'Dairy cows', potential: 'New feed mixer potential', perYear: 'per year',
    assumptions: 'Model assumptions', alt: 'Alternative feeding technology', years: 'New feed mixer every … years', used: 'Share of used machines', defaults: 'Restore defaults',
    model: 'Calculation: dairy farms × share with >50 cows × (1 − alternative technology) ÷ years × (1 − used machines).',
    legend: 'Map legend', none: 'No data', highlighted: 'Selected', mapped: 'records matched to a map district', notMapped: 'no current map area',
    loading: 'Loading market data …', error: 'Market data could not be loaded.', missing: 'Market data is currently unavailable. Please contact an admin.', retry: 'Try again', unavailable: 'The market analysis is available only to BvL staff and admins.'
  }
};

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const labels = language => copy[language === 'en' ? 'en' : 'de'];
const assumptions = { alt: 20, years: 10, used: 20 };
const selected = new Set();
let rows = null;
let shapes = null;
let matchedCount = 0;
let mappedRowIds = new Set();
let baseBox = null;
let mapBox = null;
let loadPromise = null;
let loadError = null;
let searchTerm = '';
let lastSelected = null;
let sessionGeneration = 0;

export function isInternalMarketLink(rawUrl, currentHref = 'https://sales.bvlki.cloud/') {
  try {
    const current = new URL(currentHref);
    const target = new URL(rawUrl, current);
    return target.hash === MARKET_ROUTE && (target.pathname === '/' || target.pathname === '/index.html')
      && (target.origin === current.origin || target.origin === 'https://sales.bvlki.cloud');
  } catch { return false; }
}

function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(landeshauptstadt|hansestadt|universitatsstadt|kreisfreie stadt|stadtkreis|landkreis|kreis|region|regionalverband|krsfr)\b/g, ' ')
    .replace(/\b(stadt|stadte)\b/g, ' ').replace(/[().,'’\-/]/g, ' ').replace(/\s+/g, ' ').trim();
}
const featureName = props => props.gen || props.name || '';
const officialStates = {
  SH: 'Schleswig-Holstein', HH: 'Hamburg', NI: 'Niedersachsen', HB: 'Bremen', NW: 'Nordrhein-Westfalen',
  HE: 'Hessen', RP: 'Rheinland-Pfalz', SL: 'Saarland', BW: 'Baden-Württemberg', BY: 'Bayern',
  BE: 'Berlin', BB: 'Brandenburg', MV: 'Mecklenburg-Vorpommern', ST: 'Sachsen-Anhalt', SN: 'Sachsen', TH: 'Thüringen'
};
const indexRows = data => data.map((item, id) => ({
  ...item, id, clean: String(item.name).replace(/^\s+/, '').replace(/,\s*(Landkreis|Kreisfreie Stadt|Stadt|Landeshauptstadt.*)$/i, '').trim()
}));

const project = ([lon, lat]) => [(lon - 5.3) * 90, (55.6 - lat) * 140];
function pathForGeometry(geometry) {
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates] : geometry?.type === 'MultiPolygon' ? geometry.coordinates : [];
  const path = polygons.flatMap(polygon => polygon.map(ring => {
    const points = ring.map(coord => {
      const [x, y] = project(coord);
      bounds.minX = Math.min(bounds.minX, x); bounds.maxX = Math.max(bounds.maxX, x);
      bounds.minY = Math.min(bounds.minY, y); bounds.maxY = Math.max(bounds.maxY, y);
      return `${x.toFixed(1)} ${y.toFixed(1)}`;
    });
    return points.length ? `M${points.join('L')}Z` : '';
  })).join('');
  return { path, bounds };
}

async function getJson(path) {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function ensureMarketData() {
  if (rows && shapes) return;
  const generation = sessionGeneration;
  if (!loadPromise) loadPromise = Promise.all([getJson('/api/market/de'), getJson('/api/market/geo')]).then(([data, geo]) => {
    if (generation !== sessionGeneration) throw new Error('Sitzung gewechselt');
    if (!Array.isArray(data) || !Array.isArray(geo?.features)) throw new Error('Ungültiges Datenformat');
    const index = indexRows(data);
    const byExcelRow = new Map(index.map(row => [row.excelRow, row]));
    const matched = new Set();
    const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    const mapped = geo.features.map(feature => {
      const props = feature.properties || {};
      const row = props.excelRow == null ? null : byExcelRow.get(props.excelRow);
      if (row) {
        matched.add(row.id);
        row.displayState = officialStates[props.state] || row.state;
      }
      const geometry = pathForGeometry(feature.geometry);
      if (geometry.path) {
        box.minX = Math.min(box.minX, geometry.bounds.minX); box.minY = Math.min(box.minY, geometry.bounds.minY);
        box.maxX = Math.max(box.maxX, geometry.bounds.maxX); box.maxY = Math.max(box.maxY, geometry.bounds.maxY);
      }
      return { rowId: row?.id ?? null, name: featureName(props), path: geometry.path, bounds: geometry.bounds };
    }).filter(shape => shape.path);
    if (mapped.length < 300 || !Number.isFinite(box.minX)) throw new Error('Kartenflächen fehlen');
    rows = index;
    shapes = mapped;
    matchedCount = matched.size;
    mappedRowIds = matched;
    baseBox = { x: box.minX - 20, y: box.minY - 20, width: box.maxX - box.minX + 40, height: box.maxY - box.minY + 40 };
    mapBox = { ...baseBox };
    loadError = null;
  }).catch(error => {
    if (generation === sessionGeneration) { loadPromise = null; loadError = error; }
    throw error;
  });
  return loadPromise;
}

export function resetMarketSession() {
  sessionGeneration++;
  rows = null; shapes = null; loadPromise = null; loadError = null;
  selected.clear(); searchTerm = ''; lastSelected = null; baseBox = null; mapBox = null;
  mappedRowIds = new Set(); matchedCount = 0;
}

export function potentialFor(row, values = assumptions) {
  if (row?.farms == null || row?.share50 == null) return 0;
  return row.farms * row.share50 * (1 - values.alt / 100) / values.years * (1 - values.used / 100);
}

const targetFarms = row => row?.farms == null || row?.share50 == null ? 0 : row.farms * row.share50;
function color(value) {
  if (value <= 0) return '#e6ebee';
  if (value < 1) return '#dce7ee';
  if (value < 3) return '#c5d6e2';
  if (value < 6) return '#9fbdd1';
  if (value < 10) return '#789eb9';
  if (value < 20) return '#527f9d';
  return '#345c77';
}
const format0 = (value, language) => Math.round(value || 0).toLocaleString(language === 'en' ? 'en-GB' : 'de-DE');
const format1 = (value, language) => (value || 0).toLocaleString(language === 'en' ? 'en-GB' : 'de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function renderMarketPage(language = 'de', access = true) {
  const l = labels(language);
  const head = `<div class="market-heading"><a class="button secondary market-back" href="#/home">${icon('arrow-left')} ${escapeHtml(l.back)}</a><div><p class="eyebrow">${escapeHtml(l.section)}</p><h1 class="page-title">${escapeHtml(l.title)}</h1><p class="market-intro">${escapeHtml(l.intro)}</p></div></div>`;
  if (!access) return `<main class="main-content market-page">${head}<div class="empty-state">${escapeHtml(l.unavailable)}</div></main>`;
  if (!rows || !shapes) return `<main class="main-content market-page" data-market-page>${head}<div class="empty-state market-loading">${escapeHtml(loadError ? loadError.message === 'HTTP 404' ? l.missing : l.error : l.loading)}${loadError ? ` <button class="button secondary" type="button" data-market-action="retry">${escapeHtml(l.retry)}</button>` : ''}</div></main>`;
  return `<main class="main-content market-page" data-market-page>${head}
    <div class="market-layout">
      <section class="market-map-card" aria-label="${escapeHtml(l.map)}">
        <div class="market-card-head"><div><p class="eyebrow">${escapeHtml(l.map)}</p><h2>${escapeHtml(l.mapHint)}</h2></div><span class="market-count" data-market-count>0</span></div>
        <label class="market-search field"><span>${escapeHtml(l.search)}</span><input type="search" data-market-search autocomplete="off" value="${escapeHtml(searchTerm)}" placeholder="${escapeHtml(l.search)}"></label>
        <div class="market-search-results" data-market-results aria-live="polite"></div>
        <div class="market-map-stage"><div class="market-svg-wrap" data-market-map></div><div class="market-zoom"><button type="button" data-market-action="zoom-in" aria-label="+">+</button><button type="button" data-market-action="zoom-out" aria-label="−">−</button><button type="button" data-market-action="map-reset" aria-label="${escapeHtml(l.resetMap)}">⌂</button></div><div class="market-map-selection" data-market-last hidden></div></div>
        <details class="market-legend"><summary>${escapeHtml(l.legend)}</summary><div class="market-legend-grid">${[
          ['#dce7ee', '0–<1'], ['#c5d6e2', '1–<3'], ['#9fbdd1', '3–<6'], ['#789eb9', '6–<10'],
          ['#527f9d', '10–<20'], ['#345c77', '20+'], ['#e6ebee', l.none], ['#b5152a', l.highlighted]
        ].map(([swatch, caption]) => `<span><i style="background:${swatch}"></i>${escapeHtml(caption)}</span>`).join('')}</div></details>
        <p class="market-source-line"><span data-market-matched>${matchedCount}</span> / ${rows.length} ${escapeHtml(l.mapped)}.</p>
        <p class="market-attribution">${language === 'en' ? 'District boundaries' : 'Kreisgrenzen'}: © <a href="https://www.bkg.bund.de" target="_blank" rel="noopener noreferrer">BKG (2026)</a> · <a href="https://www.govdata.de/dl-de/by-2-0" target="_blank" rel="noopener noreferrer">dl-de/by-2-0</a> · ${language === 'en' ? 'reference date 1 Jan 2025, simplified for display' : 'Stand 01.01.2025, für die Darstellung vereinfacht'} · <a href="https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_vg_nuts.pdf" target="_blank" rel="noopener noreferrer">${language === 'en' ? 'data sources' : 'Datenquellen'}</a>.</p>
      </section>
      <aside class="market-panel">
        <section class="market-summary-card"><div class="market-panel-head"><div><p class="eyebrow">${escapeHtml(l.selection)}</p><h2>${escapeHtml(l.selected)}</h2></div><button type="button" class="text-button" data-market-action="clear">${escapeHtml(l.clear)}</button></div>
          <div class="market-kpis"><div><small>${escapeHtml(l.selected)}</small><strong data-market-stat="count">0</strong></div><div><small>${escapeHtml(l.farms)}</small><strong data-market-stat="farms">0</strong></div><div><small>${escapeHtml(l.target)}</small><strong data-market-stat="target">0</strong></div><div><small>${escapeHtml(l.cows)}</small><strong data-market-stat="cows">0</strong></div></div>
          <div class="market-potential"><small>${escapeHtml(l.potential)}</small><strong><span data-market-stat="potential">0,0</span> <em>${escapeHtml(l.perYear)}</em></strong></div>
          <div class="market-selected-list" data-market-selected-list></div>
        </section>
        <details class="market-assumptions"><summary><span>${escapeHtml(l.assumptions)}</span><span>${icon('chevron-right')}</span></summary><div class="market-assumptions-body">
          <label class="field"><span>${escapeHtml(l.alt)}</span><span class="market-number"><input type="number" min="0" max="100" step="1" data-market-input="alt" value="${assumptions.alt}"><span>%</span></span></label>
          <label class="field"><span>${escapeHtml(l.years)}</span><span class="market-number"><input type="number" min="1" max="40" step="1" data-market-input="years" value="${assumptions.years}"></span></label>
          <label class="field"><span>${escapeHtml(l.used)}</span><span class="market-number"><input type="number" min="0" max="100" step="1" data-market-input="used" value="${assumptions.used}"><span>%</span></span></label>
          <button class="button secondary" type="button" data-market-action="defaults">${escapeHtml(l.defaults)}</button><p>${escapeHtml(l.model)}</p>
        </div></details>
      </aside>
    </div>
  </main>`;
}

function setBox(svg) {
  if (mapBox) svg.setAttribute('viewBox', `${mapBox.x} ${mapBox.y} ${mapBox.width} ${mapBox.height}`);
}

function zoom(svg, factor) {
  if (!mapBox || !baseBox) return;
  const width = Math.min(baseBox.width, Math.max(baseBox.width / 8, mapBox.width * factor));
  const height = width * baseBox.height / baseBox.width;
  mapBox = { x: mapBox.x + (mapBox.width - width) / 2, y: mapBox.y + (mapBox.height - height) / 2, width, height };
  setBox(svg);
}

function focusRow(svg, id) {
  const shape = shapes.find(item => item.rowId === id);
  if (!shape || !baseBox) return;
  const width = baseBox.width / 4;
  const height = width * baseBox.height / baseBox.width;
  mapBox = { x: (shape.bounds.minX + shape.bounds.maxX) / 2 - width / 2, y: (shape.bounds.minY + shape.bounds.maxY) / 2 - height / 2, width, height };
  setBox(svg);
}

function updateMap(page, language) {
  page.querySelectorAll('[data-market-row]').forEach(path => {
    const row = rows[Number(path.dataset.marketRow)];
    path.setAttribute('fill', selected.has(row.id) ? '#b5152a' : color(potentialFor(row)));
    path.classList.toggle('is-selected', selected.has(row.id));
    const title = path.querySelector('title');
    if (title) title.textContent = `${row.clean} · ${format1(potentialFor(row), language)} ${labels(language).perYear}`;
  });
}

function updateSearch(page, language) {
  const box = page.querySelector('[data-market-results]');
  const query = normalize(searchTerm);
  if (!query) { box.innerHTML = `<p>${escapeHtml(labels(language).searchHint)}</p>`; return; }
  const hits = rows.filter(row => normalize(`${row.clean} ${row.displayState || row.state}`).includes(query)).slice(0, 8);
  box.innerHTML = hits.length ? hits.map(row => `<button type="button" data-market-action="select" data-id="${row.id}" aria-pressed="${selected.has(row.id)}"><span><strong>${escapeHtml(row.clean)}</strong><small>${escapeHtml(row.displayState || row.state)}${mappedRowIds.has(row.id) ? '' : ` · ${escapeHtml(labels(language).notMapped)}`}</small></span><span>${selected.has(row.id) ? '✓' : format1(potentialFor(row), language)}</span></button>`).join('')
    : `<p>${escapeHtml(labels(language).noResult)}</p>`;
}

function updateSummary(page, language) {
  const l = labels(language);
  const list = rows.filter(row => selected.has(row.id)).sort((a, b) => potentialFor(b) - potentialFor(a));
  const totals = list.reduce((sum, row) => ({ farms: sum.farms + (row.farms || 0), cows: sum.cows + (row.cows || 0), target: sum.target + targetFarms(row), potential: sum.potential + potentialFor(row) }), { farms: 0, cows: 0, target: 0, potential: 0 });
  const values = { count: format0(list.length, language), farms: format0(totals.farms, language), cows: format0(totals.cows, language), target: format0(totals.target, language), potential: format1(totals.potential, language) };
  for (const [key, value] of Object.entries(values)) page.querySelector(`[data-market-stat="${key}"]`).textContent = value;
  page.querySelector('[data-market-count]').textContent = values.count;
  page.querySelector('[data-market-selected-list]').innerHTML = list.length ? list.map(row => `<div class="market-selected-row"><span><strong>${escapeHtml(row.clean)}</strong><small>${format1(potentialFor(row), language)} ${escapeHtml(l.perYear)} · ${escapeHtml(row.displayState || row.state)}${mappedRowIds.has(row.id) ? '' : ` · ${escapeHtml(l.notMapped)}`}</small></span><button type="button" data-market-action="remove" data-id="${row.id}" aria-label="${escapeHtml(row.clean)} ${escapeHtml(l.clear)}">×</button></div>`).join('') : `<p>${escapeHtml(l.empty)}</p>`;
  const last = page.querySelector('[data-market-last]');
  if (lastSelected != null && selected.has(lastSelected)) {
    const row = rows[lastSelected];
    last.innerHTML = `<strong>${escapeHtml(row.clean)}</strong><span>${format1(potentialFor(row), language)} ${escapeHtml(l.perYear)}</span>`;
    last.hidden = false;
  } else last.hidden = true;
  updateMap(page, language);
  updateSearch(page, language);
}

export function mountMarketPage(root, language, redraw) {
  const page = root.querySelector('[data-market-page]');
  if (!page) return;
  const retry = page.querySelector('[data-market-action="retry"]');
  if (retry) { retry.addEventListener('click', () => ensureMarketData().then(redraw).catch(redraw)); return; }
  if (!rows || !shapes) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', labels(language).map);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.innerHTML = `<g>${shapes.map(shape => `<path d="${shape.path}" fill-rule="evenodd" ${shape.rowId == null ? 'class="market-no-data" fill="#e6ebee"' : `data-market-row="${shape.rowId}" tabindex="0" role="button" fill="#dce7ee"`}><title>${escapeHtml(shape.name)}</title></path>`).join('')}</g>`;
  setBox(svg);
  page.querySelector('[data-market-map]').appendChild(svg);
  updateSummary(page, language);

  let drag = null;
  let suppressClick = false;
  svg.addEventListener('pointerdown', event => {
    if (!mapBox) return;
    drag = { x: event.clientX, y: event.clientY, box: { ...mapBox }, moved: false, pointerId: event.pointerId };
  });
  svg.addEventListener('pointermove', event => {
    if (!drag) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 5) {
      drag.moved = true;
      svg.setPointerCapture(drag.pointerId);
    }
    if (!drag.moved) return;
    mapBox = { ...drag.box, x: drag.box.x - dx * drag.box.width / svg.clientWidth, y: drag.box.y - dy * drag.box.height / svg.clientHeight };
    setBox(svg);
  });
  svg.addEventListener('pointerup', () => { if (drag?.moved) { suppressClick = true; setTimeout(() => { suppressClick = false; }, 50); } drag = null; });
  svg.addEventListener('pointercancel', () => { drag = null; });
  svg.addEventListener('click', event => {
    if (suppressClick) { suppressClick = false; return; }
    const path = event.target.closest('[data-market-row]');
    if (!path) return;
    const id = Number(path.dataset.marketRow);
    if (selected.has(id)) selected.delete(id); else selected.add(id);
    lastSelected = selected.has(id) ? id : null;
    updateSummary(page, language);
  });
  svg.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const path = event.target.closest('[data-market-row]');
    if (!path) return;
    event.preventDefault(); path.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  page.addEventListener('input', event => {
    if (event.target.matches('[data-market-search]')) { searchTerm = event.target.value; updateSearch(page, language); return; }
    const field = event.target.closest('[data-market-input]');
    if (!field) return;
    const value = Number(field.value);
    const min = field.dataset.marketInput === 'years' ? 1 : 0;
    const max = field.dataset.marketInput === 'years' ? 40 : 100;
    if (!Number.isFinite(value) || value < min || value > max || field.value === '') return;
    assumptions[field.dataset.marketInput] = value;
    updateSummary(page, language);
  });
  page.addEventListener('click', event => {
    const button = event.target.closest('[data-market-action]');
    if (!button) return;
    const action = button.dataset.marketAction;
    if (action === 'zoom-in') zoom(svg, .7);
    if (action === 'zoom-out') zoom(svg, 1 / .7);
    if (action === 'map-reset') { mapBox = { ...baseBox }; setBox(svg); }
    if (action === 'clear') { selected.clear(); lastSelected = null; updateSummary(page, language); }
    if (action === 'defaults') {
      Object.assign(assumptions, { alt: 20, years: 10, used: 20 });
      for (const input of page.querySelectorAll('[data-market-input]')) input.value = assumptions[input.dataset.marketInput];
      updateSummary(page, language);
    }
    if (action === 'select' || action === 'remove') {
      const id = Number(button.dataset.id);
      if (action === 'remove' || selected.has(id)) selected.delete(id); else selected.add(id);
      lastSelected = selected.has(id) ? id : null;
      if (selected.has(id)) focusRow(svg, id);
      updateSummary(page, language);
    }
  });
}
