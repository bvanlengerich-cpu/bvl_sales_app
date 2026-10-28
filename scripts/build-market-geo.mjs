/**
 * Build the protected district map from the BKG VG250 WFS and the original
 * market-analysis rows. Geometry: © Bundesamt für Kartographie und Geodäsie
 * (BKG), Verwaltungsgebiete 1:250 000, product page (Stand 01.01.2025):
 * https://gdz.bkg.bund.de/index.php/default/open-data/wfs-verwaltungsgebiete-1-250-000-stand-01-01-wfs-vg250.html
 * WFS: https://sgx.geodatenzentrum.de/wfs_vg250?service=WFS&version=2.0.0&request=GetFeature&typeNames=vg250:vg250_krs&count=1000&outputFormat=application%2Fjson&srsName=EPSG:4326
 * Licence: Datenlizenz Deutschland – Namensnennung – Version 2.0
 * https://www.govdata.de/dl-de/by-2-0 | https://www.bkg.bund.de
 *
 * Run: node scripts/build-market-geo.mjs [path/to/bkg-krs.geojson] [path/to/market-data.json]
 * By default, the public bundled values in server/market-data.json are read.
 * The local tmp-bkg-krs.geojson is used if present; otherwise the
 * WFS is downloaded. No approximation by substring or nearest
 * name is permitted: ambiguous and unavailable districts remain unlinked.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const WFS_URL = 'https://sgx.geodatenzentrum.de/wfs_vg250?service=WFS&version=2.0.0&request=GetFeature&typeNames=vg250:vg250_krs&count=1000&outputFormat=application%2Fjson&srsName=EPSG:4326';
const OUTPUT = new URL('../server/market-geo.json', import.meta.url);
const ROWS = process.argv[3] ? resolve(process.argv[3]) : new URL('../server/market-data.json', import.meta.url);
const DEFAULT_SOURCE = new URL('../tmp-bkg-krs.geojson', import.meta.url);
const SIMPLIFY_TOLERANCE = 0.004; // Degrees, roughly 250–450 m at German latitudes.

const STATE_CODES = new Map([
  ['Schleswig-Holstein', 'SH'], ['Niedersachsen', 'NI'], ['Nordrhein-Westfalen', 'NW'],
  ['Hessen', 'HE'], ['Rheinland-Pfalz', 'RP'], ['Saarland', 'SL'],
  ['Baden-Württemberg', 'BW'], ['Oberfranken', 'BY'], ['Mittelfranken', 'BY'],
  ['Unterfranken', 'BY'], ['Oberfpfalz', 'BY'], ['Oberpfalz', 'BY'],
  ['Niederbayern', 'BY'], ['Oberbayern', 'BY'], ['Bayrisch-Schwaben', 'BY'],
  ['Mecklenburg-Vorpommern', 'MV'], ['Brandenburg', 'BB'], ['Sachsen-Anhalt', 'ST'],
  ['Sachsen', 'SN'], ['Thüringen', 'TH']
]);

// Proven corrections of source spelling/state, not fuzzy match rules:
// 81: source spells Mülheim with an additional h; 146: Ww. = Westerwald;
// 182: Zweibrücken is listed under Saarland in the HTML but AGS 07320 is RP.
const ROW_CORRECTIONS = new Map([
  [81, { name: 'mulheim an der ruhr' }],
  [146, { name: 'altenkirchen westerwald' }],
  [182, { state: 'RP' }]
]);

// Original HTML resolves these duplicate Excel records to these specific rows.
// Other ambiguous matches are rejected rather than guessed.
const PREFERRED_ROWS = new Map([
  ['05362', 73],   // Rhein-Erft-Kreis: row 114 has no farms/cows.
  ['08215', 203],  // Karlsruhe Landkreis: row 211 duplicates row 203 verbatim.
  ['09185', 322]   // Neuburg-Schrobenhausen belongs to Oberbayern, not Niederbayern.
]);

function canonicalName(value) {
  return String(value || '').toLowerCase()
    .replace(/\b(?:krfr|krsfr)\.?\s*stadt\b/g, ' ')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss')
    .replace(/\b(?:landeshauptstadt|hansestadt|universitatsstadt|kreisfreie stadt|stadtkreis|landkreis|kreis|region|regionalverband|stadt)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function rowKind(name) {
  const text = String(name).toLowerCase();
  if (/kreisfreie stadt|(?:krfr|krsfr)\.?\s*stadt|stadtkreis|landeshauptstadt|hansestadt|universit[aä]tsstadt|,\s*stadt\b/.test(text)) return 'city';
  if (/landkreis|,\s*kreis\b|regionalverband|region hannover/.test(text)) return 'county';
  return 'unspecified';
}

const geoKind = type => /stadt/i.test(String(type)) ? 'city' : 'county';

async function readGeoSource() {
  const requested = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_SOURCE;
  try { return JSON.parse(await readFile(requested, 'utf8')); }
  catch (error) {
    if (process.argv[2] || error.code !== 'ENOENT') throw error;
  }
  console.log('Lokale BKG-Quelldatei fehlt; lade amtliche WFS-Daten …');
  const response = await fetch(WFS_URL, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`BKG-WFS: HTTP ${response.status}`);
  return response.json();
}

function indexedRows(rows) {
  if (!Array.isArray(rows) || rows.length !== 398) throw new Error('Unerwarteter HTML-Datenstand');
  const byKey = new Map();
  const indexed = rows.map(row => {
    if (!Number.isInteger(row.excelRow) || !row.name || !STATE_CODES.has(row.state)) throw new Error(`Ungültige Excel-Zeile: ${JSON.stringify(row)}`);
    const correction = ROW_CORRECTIONS.get(row.excelRow) || {};
    const state = correction.state || STATE_CODES.get(row.state);
    const name = correction.name || canonicalName(row.name);
    const item = { ...row, stateCode: state, key: name, kind: rowKind(row.name) };
    const key = `${state}|${name}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(item);
    return item;
  });
  return { indexed, byKey };
}

function groupedDistricts(geo) {
  if (geo?.type !== 'FeatureCollection' || !Array.isArray(geo.features) || geo.features.length < 400) throw new Error('BKG-GeoJSON unvollständig');
  const groups = new Map();
  for (const feature of geo.features) {
    const p = feature.properties || {};
    if (!/^\d{5}$/.test(p.ags || '') || !p.gen || !p.lkz || !p.bez || feature.geometry?.type !== 'MultiPolygon') {
      throw new Error(`Ungültige BKG-Kreisfläche: ${p.ags || p.objid || 'ohne AGS'}`);
    }
    let district = groups.get(p.ags);
    if (!district) {
      district = { ags: p.ags, name: p.gen, state: p.lkz, type: p.bez, polygons: [] };
      groups.set(p.ags, district);
    } else if (district.name !== p.gen || district.state !== p.lkz || district.type !== p.bez) {
      throw new Error(`Inkonsistente BKG-Teilflächen für AGS ${p.ags}`);
    }
    district.polygons.push(...feature.geometry.coordinates);
  }
  if (groups.size < 390 || groups.size > 410) throw new Error(`Unerwartete AGS-Zahl: ${groups.size}`);
  return [...groups.values()].sort((a, b) => a.ags.localeCompare(b.ags));
}

function matchDistrict(district, byKey) {
  const kind = geoKind(district.type);
  const candidates = byKey.get(`${district.state}|${canonicalName(district.name)}`) || [];
  let eligible = candidates.filter(row => row.kind === kind || row.kind === 'unspecified');
  const preferred = PREFERRED_ROWS.get(district.ags);
  if (preferred != null) {
    eligible = eligible.filter(row => row.excelRow === preferred);
    if (eligible.length !== 1) throw new Error(`Excel-Ausnahme ${district.ags} -> ${preferred} ist nicht mehr gültig`);
  } else {
    const explicit = eligible.filter(row => row.kind === kind);
    if (explicit.length) eligible = explicit;
  }
  if (eligible.length > 1) throw new Error(`Mehrdeutiger Kreis ${district.ags} ${district.name}: Excel-Zeilen ${eligible.map(row => row.excelRow).join(', ')}`);
  return eligible[0] || null;
}

function sqSegmentDistance(point, first, last) {
  const dx = last[0] - first[0], dy = last[1] - first[1];
  if (dx === 0 && dy === 0) return (point[0] - first[0]) ** 2 + (point[1] - first[1]) ** 2;
  const t = Math.max(0, Math.min(1, ((point[0] - first[0]) * dx + (point[1] - first[1]) * dy) / (dx * dx + dy * dy)));
  return (point[0] - first[0] - t * dx) ** 2 + (point[1] - first[1] - t * dy) ** 2;
}

function simplifyLine(points, toleranceSquared) {
  if (points.length <= 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let furthest = -1, distance = toleranceSquared;
    for (let i = first + 1; i < last; i += 1) {
      const candidate = sqSegmentDistance(points[i], points[first], points[last]);
      if (candidate > distance) { distance = candidate; furthest = i; }
    }
    if (furthest !== -1) {
      keep[furthest] = 1;
      stack.push([first, furthest], [furthest, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function ringArea(ring) {
  let area = 0;
  for (let i = 1; i < ring.length; i += 1) {
    area += ring[i - 1][0] * ring[i][1] - ring[i][0] * ring[i - 1][1];
  }
  return Math.abs(area / 2);
}

function simplifyRing(ring) {
  if (!Array.isArray(ring) || ring.length < 4 || ring.some(point => !Array.isArray(point) || point.length < 2 || !point.slice(0, 2).every(Number.isFinite))) {
    throw new Error('Ungültiger BKG-Polygonring');
  }
  const simplified = simplifyLine(ring, SIMPLIFY_TOLERANCE ** 2);
  const chosen = simplified.length >= 4 && ringArea(simplified) >= ringArea(ring) * 0.85 ? simplified : ring;
  const rounded = chosen.map(([lon, lat]) => [Number(lon.toFixed(5)), Number(lat.toFixed(5))]);
  rounded[rounded.length - 1] = [...rounded[0]];
  return rounded;
}

const rows = JSON.parse(await readFile(ROWS, 'utf8'));
const geo = await readGeoSource();
const { indexed, byKey } = indexedRows(rows);
const districts = groupedDistricts(geo);
const matchedRows = new Set();
const unmatchedDistricts = [];
const features = districts.map(district => {
  const row = matchDistrict(district, byKey);
  if (row) {
    if (matchedRows.has(row.excelRow)) throw new Error(`Excel-Zeile ${row.excelRow} mehreren Kreisen zugeordnet`);
    matchedRows.add(row.excelRow);
  } else unmatchedDistricts.push(`${district.ags} ${district.name} (${district.state}, ${district.type})`);
  return {
    type: 'Feature',
    properties: { ags: district.ags, name: district.name, state: district.state, kind: district.type, excelRow: row?.excelRow ?? null },
    geometry: { type: 'MultiPolygon', coordinates: district.polygons.map(polygon => polygon.map(simplifyRing)) }
  };
});

if (matchedRows.size < 380) throw new Error(`Zu wenige sichere Zuordnungen: ${matchedRows.size}/${districts.length}`);
const unusedRows = indexed.filter(row => !matchedRows.has(row.excelRow));
await writeFile(OUTPUT, `${JSON.stringify({
  type: 'FeatureCollection',
  attribution: '© Bundesamt für Kartographie und Geodäsie (BKG), dl-de/by-2-0',
  features
})}\n`);
console.log(`${geo.features.length} BKG-Teilflächen -> ${districts.length} AGS-Kreise, ${matchedRows.size} eindeutig mit HTML-Werten verknüpft.`);
console.log(`Ohne HTML-Wert (${unmatchedDistricts.length}): ${unmatchedDistricts.join('; ')}`);
console.log(`Nicht verwendete HTML-Zeilen (${unusedRows.length}): ${unusedRows.map(row => `${row.excelRow} ${row.name} [${row.state}]`).join('; ')}`);
