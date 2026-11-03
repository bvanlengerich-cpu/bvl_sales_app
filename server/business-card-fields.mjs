// Conservative suggestions for a single business card. OCR strings are evidence,
// not trusted contact fields: ambiguous values are deliberately left unassigned.
const LIMITS = { name: 200, company: 200, email: 254, phone: 80, mobile: 80, street: 200, postalCode: 30, city: 160 };
const MIN_SCORE = 0.55;
const EMAIL = /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+/gi;
const LEGAL_COMPANY = /\b(?:gmbh|ohg|ug|kg|ag|ltd|limited|inc|llc|plc|sarl|s\.?a\.?r\.?l\.?|s\.?r\.?l\.?|s\.?a\.?s\.?|b\.?v\.?|n\.?v\.?)\b/i;
const COMPANY_WORD = /\b(?:landtechnik|maschinenbau|agritechnik|agriculture|engineering|industries|manufacturing|solutions|systems|services|technik|agrotechnik|agrar|farm|farms)\b/i;
const ROLE = /\b(?:vertrieb(?:sleiter|sleitung)?|verkauf(?:sleiter|sleitung)?|geschäftsführ(?:er|erin|ung)|inhaber(?:in)?|geschaeftsfuehrer|sales|manager|director|engineer|technician|consultant|marketing|service|ceo|cfo|coo|cto|owner|president|leiter(?:in)?|leitung|account|representative|berater(?:in)?|techniker(?:in)?)\b/i;
const NOT_A_NAME = /\b(?:ihr|ihre|unser|unsere|partner|quality|innovation|innovative|feeding|farming|future|best|reliable|solutions|systems|services|service|welcome|kontakt|contact|head|office|for|and|your|the|team|technical|support|technologie|technologies|vertrauen|zukunft)\b/i;
const PARTICLES = new Set(['van', 'von', 'der', 'den', 'de', 'del', 'da', 'dos', 'di', 'du', 'le', 'la', 'ten', 'ter', 'zu', 'zur']);
const PHONE_LABELS = new Map([
  ['tel', 'phone'], ['telefon', 'phone'], ['telephone', 'phone'], ['phone', 'phone'], ['t', 'phone'], ['p', 'phone'],
  ['mobil', 'mobile'], ['mobile', 'mobile'], ['cell', 'mobile'], ['cellphone', 'mobile'], ['m', 'mobile'],
  ['fax', 'fax'], ['f', 'fax'], ['email', 'email'], ['e-mail', 'email'], ['mail', 'email'], ['e', 'email'],
  ['web', 'web'], ['website', 'web'], ['internet', 'web'], ['w', 'web'],
  ['name', 'name'], ['ansprechpartner', 'name'], ['contact', 'name'],
  ['firma', 'company'], ['unternehmen', 'company'], ['company', 'company'],
  ['adresse', 'address'], ['address', 'address'], ['street', 'address'], ['straße', 'address'], ['strasse', 'address'], ['straat', 'address']
]);

const fold = value => String(value).normalize('NFKC').toLocaleLowerCase('de-DE');
const identity = value => fold(value).replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]/g, '');
const clean = value => String(value || '').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^[|;,·•\s]+|[|;,·•\s]+$/g, '');
const unique = values => [...new Map(values.map(value => [fold(value), value])).values()];

function bounds(box) {
  if (!Array.isArray(box) || box.length < 4 || box.some(point => !Array.isArray(point) || point.length < 2 || !point.slice(0, 2).every(Number.isFinite))) return null;
  const xs = box.map(point => point[0]), ys = box.map(point => point[1]);
  const left = Math.min(...xs), top = Math.min(...ys), right = Math.max(...xs), bottom = Math.max(...ys);
  return right > left && bottom > top ? { left, top, right, bottom, height: bottom - top } : null;
}

function prepareLines(input) {
  const rows = Array.isArray(input) ? input : typeof input === 'string' ? input.split(/\r?\n/) : [];
  return rows.slice(0, 300).flatMap((row, index) => {
    if (typeof row !== 'string' && (!row || typeof row.text !== 'string')) return [];
    const raw = typeof row === 'string' ? row : row.text;
    const score = typeof row === 'string' || row.score === undefined ? 1 : Number(row.score);
    if (!Number.isFinite(score) || score < MIN_SCORE || score > 1) return [];
    const rectangle = typeof row === 'string' ? null : bounds(row.box);
    return raw.slice(0, 2000).split(/\r?\n/).map(text => ({ text: clean(text), score, box: rectangle, index })).filter(row => row.text);
  });
}

function segments(row) {
  // One OCR box often contains Tel, Fax and Email on the same line. Split at
  // labels before extracting numbers; never copy the rest of the OCR line.
  const pattern = /(?<![\p{L}\p{N}])(?:telefon|telephone|cellphone|ansprechpartner|unternehmen|internet|website|company|adresse|address|strasse|straße|street|straat|mobile|e-mail|email|mobil|phone|firma|contact|name|cell|mail|fax|web|tel|[tpmfew])(?:\s*[:.]\s*|\s+(?=[+(\d]))/giu;
  const markers = [...row.text.matchAll(pattern)].map(match => ({
    start: match.index, end: match.index + match[0].length,
    kind: PHONE_LABELS.get(fold(match[0].replace(/[\s:.]+$/g, '')))
  })).filter(marker => marker.kind);
  const result = [];
  if (!markers.length || markers[0].start > 0) result.push({ ...row, kind: null, value: clean(row.text.slice(0, markers[0]?.start)) });
  for (let index = 0; index < markers.length; index++) result.push({
    ...row, kind: markers[index].kind,
    value: clean(row.text.slice(markers[index].end, markers[index + 1]?.start))
  });
  return result.flatMap(part => part.value.split(/[|;·•]/).map(value => ({ ...part, value: clean(value) }))).filter(part => part.value);
}

function phoneCandidates(part) {
  if (part.kind && !['phone', 'mobile'].includes(part.kind)) return [];
  if (!part.kind && /\b(?:ust|vat|tax|iban|bic|register|hrb|kundennummer|customer\s*id)\b/i.test(part.value)) return [];
  const text = part.value.replace(EMAIL, ' ').replace(/(?:https?:\/\/|www\.)\S+/gi, ' ');
  const pattern = /(?<![\p{L}\p{N}])(?:\+\s*\d|00\d|0\d|\(\s*0?\d)[\d\s()./\-]{4,54}\d/gu;
  const raw = [...text.matchAll(pattern)].map(match => match[0]);
  if (['phone', 'mobile'].includes(part.kind)) {
    const local = text.match(/^\d[\d\s()./\-]{5,48}\d(?=\s*(?:$|[|;,]|[\p{L}]))/u)?.[0];
    if (local) raw.push(local);
  }
  return unique(raw.map(value => clean(value).replace(/[\s/().-]+$/g, ''))).flatMap(value => {
    const digits = value.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15 || /^(\d)\1+$/.test(digits) || /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/.test(value)) return [];
    if (!part.kind && !/^(?:\+|00|0|\(\s*0)/.test(value)) return [];
    let canonical = digits;
    const withoutOptionalTrunk = value.replace(/\(\s*0\s*\)/g, '').replace(/\D/g, '');
    if (value.startsWith('+')) canonical = `+${withoutOptionalTrunk}`;
    else if (value.startsWith('00')) canonical = `+${withoutOptionalTrunk.slice(2)}`;
    const mobile = /^(?:0(?:15|16|17)|(?:\+|00)49\s*\(?0?\)?\s*1[567]|(?:\+|00)31\s*\(?0?\)?\s*6|(?:\+|00)33\s*\(?0?\)?\s*[67]|(?:\+|00)44\s*\(?0?\)?\s*7)/.test(value);
    return [{ value, canonical, kind: part.kind || (mobile ? 'mobile' : 'phone'), explicit: Boolean(part.kind), row: part }];
  });
}

function likelyPerson(value) {
  if (value.length > 200 || /[\d@/|:]/.test(value) || LEGAL_COMPANY.test(value) || COMPANY_WORD.test(value) || ROLE.test(value) || NOT_A_NAME.test(value)) return false;
  const withoutTitles = value.replace(/^(?:(?:Dr|Prof|Ing|Dipl[.-]?Ing)\.?\s+)+/i, '');
  const words = withoutTitles.split(/\s+/);
  if (words.length < 2 || words.length > 5) return false;
  return words.every(word => PARTICLES.has(fold(word)) || /^[\p{Lu}][\p{L}'’.-]*$/u.test(word));
}

function nearby(a, b) {
  if (!a.box || !b.box) return Math.abs(a.index - b.index) <= 1;
  const gap = Math.max(0, b.box.top - a.box.bottom, a.box.top - b.box.bottom);
  const overlap = Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left);
  return gap <= Math.max(a.box.height, b.box.height) * 2.5 && overlap > 0;
}

function streetFrom(value) {
  const german = value.match(/(?:^|[|;,]\s*)([\p{L}][\p{L} .’'\-]{0,90}(?:straße|strasse|str\.?|weg|allee|gasse|platz|ring|damm|chaussee|straat|laan|plein)\s*\d+[a-z]?(?:\s*[-/]\s*\d+[a-z]?)?)(?=\s*(?:$|[,;|]|\d{4,6}\b))/iu)?.[1];
  if (german) return clean(german);
  const english = value.match(/(?:^|[|;,]\s*)(\d+[a-z]?\s+[\p{L}\p{N} .’'\-]{1,75}\b(?:street|st\.?|road|rd\.?|lane|ln\.?|avenue|ave\.?|drive|dr\.?|boulevard|blvd\.?))(?=\s*(?:$|[,;|]|\d{4,6}\b))/iu)?.[1];
  if (english) return clean(english);
  const french = value.match(/(?:^|[|;,]\s*)((?:\d+[a-z]?\s+)?(?:rue|avenue|boulevard|chemin)\s+[\p{L} .’'\-]{1,70}(?:\s+\d+[a-z]?)?)(?=\s*(?:$|[,;|]|\d{5}\b))/iu)?.[1];
  return french ? clean(french) : null;
}

function postalFrom(value) {
  const patterns = [
    /(?:^|[|;,]\s*|\s)(?:NL[-\s]?)?(\d{4}\s?[A-Z]{2})\s+([\p{L}][\p{L} .’'\-]{1,100})(?=\s*(?:$|[|;,]))/u,
    /(?:^|[|;,]\s*|\s)(?:[A-Z]{1,3}[-\s])?(\d{5})\s+([\p{L}][\p{L} .’'\-]{1,100})(?=\s*(?:$|[|;,]))/u,
    /(?:^|[|;,]\s*|\s)([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\s+([\p{L}][\p{L} .’'\-]{1,100})(?=\s*(?:$|[|;,]))/u
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (!match) continue;
    const city = clean(match[2]).replace(/\s+(?:Deutschland|Germany|Nederland|Netherlands|France|United Kingdom)$/i, '');
    if (!city || ROLE.test(city) || LEGAL_COMPANY.test(city)) continue;
    return { postalCode: clean(match[1]), city };
  }
  return null;
}

export function extractBusinessCardFields(input) {
  const rows = prepareLines(input), parts = rows.flatMap(segments), fields = {}, warnings = [];
  const warn = value => { if (!warnings.includes(value)) warnings.push(value); };
  const choose = (key, candidates, warning) => {
    const values = unique(candidates.filter(Boolean).map(clean)).filter(value => value && value.length <= LIMITS[key]);
    if (values.length === 1) fields[key] = values[0];
    else if (values.length > 1) warn(warning);
  };

  const emailParts = parts.filter(part => !['fax', 'web'].includes(part.kind));
  const emails = emailParts.flatMap(part => [...part.value.matchAll(EMAIL)].map(match => ({ value: match[0].replace(/[.]+$/, ''), part })));
  const labelledEmails = emails.filter(email => email.part.kind === 'email');
  choose('email', (labelledEmails.length ? labelledEmails : emails).map(email => email.value), 'Mehrere E-Mail-Adressen erkannt; bitte auswählen.');

  const numbers = parts.flatMap(phoneCandidates);
  for (const kind of ['phone', 'mobile']) {
    const selected = numbers.filter(number => number.kind === kind);
    const explicit = selected.filter(number => number.explicit);
    const deduplicated = [...new Map((explicit.length ? explicit : selected).map(number => [number.canonical, number])).values()];
    if (deduplicated.length === 1) fields[kind] = deduplicated[0].value;
    else if (deduplicated.length > 1) warn(kind === 'phone' ? 'Mehrere Telefonnummern erkannt; bitte auswählen.' : 'Mehrere Mobilnummern erkannt; bitte auswählen.');
  }
  if (fields.phone && fields.mobile && fields.phone.replace(/\D/g, '') === fields.mobile.replace(/\D/g, '')) {
    delete fields.phone; warn('Dieselbe Nummer ist als Telefon und Mobil beschriftet; bitte prüfen.');
  }

  const companyLabels = parts.filter(part => part.kind === 'company').map(part => part.value);
  const companyParts = parts.filter(part => !part.kind && LEGAL_COMPANY.test(part.value) && !/[\d@]|https?:|www\./i.test(part.value));
  choose('company', companyLabels.length ? companyLabels : companyParts.map(part => part.value), 'Mehrere Unternehmen erkannt; bitte auswählen.');

  const addressParts = parts.filter(part => !['phone', 'mobile', 'fax', 'email', 'web', 'name', 'company'].includes(part.kind));
  const streets = addressParts.map(part => streetFrom(part.value)).filter(Boolean);
  choose('street', streets, 'Mehrere Straßen erkannt; bitte auswählen.');
  const postals = addressParts.map(part => postalFrom(part.value)).filter(Boolean);
  const postalPairs = [...new Map(postals.map(pair => [`${pair.postalCode}|${fold(pair.city)}`, pair])).values()];
  if (postalPairs.length === 1) Object.assign(fields, postalPairs[0]);
  else if (postalPairs.length > 1) warn('Mehrere Anschriften erkannt; bitte auswählen.');

  const labelledNames = parts.filter(part => part.kind === 'name' && likelyPerson(part.value));
  if (labelledNames.length) choose('name', labelledNames.map(part => part.value), 'Mehrere Ansprechpartner erkannt; bitte auswählen.');
  else {
    const emailLocal = identity((fields.email || '').split('@')[0]);
    const candidates = parts.filter(part => !part.kind).map(part => ({ ...part, text: part.value })).filter(row => likelyPerson(row.text)).map(row => {
      const tokens = row.text.replace(/^(?:(?:Dr|Prof|Ing|Dipl[.-]?Ing)\.?\s+)+/i, '').split(/\s+/).filter(token => !PARTICLES.has(fold(token)));
      const surname = identity(tokens.at(-1));
      const emailMatch = surname.length >= 3 && emailLocal.includes(surname);
      const roleNearby = rows.some(other => ROLE.test(other.text) && nearby(row, other));
      return { ...row, rank: (fields.company ? 1 : 0) + (emailMatch ? 6 : 0) + (roleNearby ? 3 : 0), corroborated: Boolean(fields.company || emailMatch || roleNearby) };
    }).filter(row => row.corroborated).sort((a, b) => b.rank - a.rank || b.score - a.score);
    const distinct = [...new Map(candidates.map(row => [fold(row.text), row])).values()];
    if (distinct.length === 1 || (distinct.length > 1 && distinct[0].rank >= distinct[1].rank + 2)) fields.name = distinct[0].text;
    else if (distinct.length > 1) warn('Der Ansprechpartner ist nicht eindeutig erkennbar; bitte prüfen.');
  }

  for (const [key, value] of Object.entries(fields)) {
    if (!value || value.length > LIMITS[key]) delete fields[key];
  }
  return { fields, warnings };
}
