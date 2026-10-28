import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = process.argv[2];
if (!source) {
  console.error('Aufruf: node scripts/import-market-html.mjs <Marktpotential-HTML>');
  process.exit(1);
}

const html = await readFile(resolve(source), 'utf8');
const match = html.match(/^const DATA=(\[.*\]);$/m);
if (!match) throw new Error('Keine eingebetteten Marktpotential-Daten gefunden');

const rows = JSON.parse(match[1]);
if (!Array.isArray(rows) || rows.length !== 398 || rows.some(row => !row.name || !row.state)) {
  throw new Error('Unerwarteter Datenstand in der HTML-Datei');
}

const destination = new URL('../server/market-data.json', import.meta.url);
await mkdir(new URL('../server/', import.meta.url), { recursive: true });
await writeFile(destination, `${JSON.stringify(rows, null, 2)}\n`, { mode: 0o600 });
console.log(`${rows.length} öffentliche Datensätze aus der HTML-Datei übernommen: server/market-data.json (App-Datenstand für GitHub und Docker).`);
