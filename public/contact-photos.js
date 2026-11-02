import { icon } from './icons.js';

export const PHOTO_LIMITS = Object.freeze({ count: 2, bytes: 250 * 1024, targetBytes: 150 * 1024, edge: 1600, inputBytes: 25 * 1024 * 1024, pixels: 64_000_000 });
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const words = {
  de: { title: 'Visitenkarte', camera: 'Visitenkarte fotografieren', gallery: 'Foto hinzufügen', hint: 'Optional: Vorder- und Rückseite. Fotos werden automatisch verkleinert – maximal 250 KB pro Bild.', photo: 'Visitenkartenfoto', front: 'Foto 1', back: 'Foto 2', remove: 'Foto entfernen', enlarge: 'Foto vergrößern', scan: 'Text erkennen', preparing: 'Foto wird verkleinert …', limit: 'Maximal zwei Fotos pro Kontakt.', invalid: 'Bitte ein Bild unter 25 MB auswählen.', decode: 'Dieses Bild konnte nicht geöffnet werden. Bitte ein JPG- oder PNG-Foto auswählen.', large: 'Das Foto ist zu groß. Bitte eine Aufnahme mit geringerer Auflösung wählen.', failed: 'Das Foto konnte nicht ausreichend verkleinert werden.', wait: 'Bitte warten, bis das Foto fertig verkleinert ist.', unavailable: 'Dieses Foto ist auf dem Gerät noch nicht verfügbar. Bitte online erneut öffnen.', close: 'Schließen', cancel: 'Abbrechen', ocrTitle: 'Angaben aus Visitenkarte', ocrHint: 'Die Texterkennung läuft lokal auf diesem Gerät. Prüfen und korrigieren Sie die Vorschläge, bevor Sie Felder übernehmen.', ocrLoading: 'Texterkennung wird geladen …', ocrProgress: 'Text wird erkannt', ocrFailed: 'Texterkennung derzeit nicht möglich. Das Foto bleibt gespeichert. Bitte Angaben manuell eintragen oder erneut versuchen.', ocrEmpty: 'Keine eindeutigen Angaben erkannt. Das Foto bleibt erhalten.', apply: 'Ausgewählte Angaben übernehmen', recognized: 'Erkannter Text', name: 'Ansprechpartner / Name', company: 'Betrieb / Unternehmen', email: 'E-Mail-Adresse', phone: 'Telefon', mobile: 'Mobil', street: 'Straße / Hausnummer', postalCode: 'PLZ', city: 'Ort', existing: 'Vorhandene Einträge werden nur durch ausgewählte Vorschläge ersetzt.', savedSize: 'verkleinert', loading: 'Fotos werden geladen …', count: 'Foto(s)' },
  en: { title: 'Business card', camera: 'Photograph business card', gallery: 'Add photo', hint: 'Optional: front and back. Photos are resized automatically – maximum 250 KB per image.', photo: 'Business card photo', front: 'Photo 1', back: 'Photo 2', remove: 'Remove photo', enlarge: 'Enlarge photo', scan: 'Recognize text', preparing: 'Resizing photo …', limit: 'A contact can have up to two photos.', invalid: 'Please select an image smaller than 25 MB.', decode: 'This image could not be opened. Please select a JPG or PNG photo.', large: 'This photo is too large. Please take a lower-resolution photo.', failed: 'This photo could not be reduced enough.', wait: 'Please wait until the photo has been resized.', unavailable: 'This photo is not yet available on this device. Please reopen it while online.', close: 'Close', cancel: 'Cancel', ocrTitle: 'Business card details', ocrHint: 'Text recognition runs locally on this device. Review and correct the suggestions before applying them.', ocrLoading: 'Loading text recognition …', ocrProgress: 'Recognizing text', ocrFailed: 'Text recognition is currently unavailable. Your photo is kept. Please enter the details manually or try again.', ocrEmpty: 'No clear details were recognized. Your photo is kept.', apply: 'Apply selected details', recognized: 'Recognized text', name: 'Contact name', company: 'Farm / company', email: 'Email address', phone: 'Telephone', mobile: 'Mobile', street: 'Street / house number', postalCode: 'Postal code', city: 'City', existing: 'Existing entries are replaced only by selected suggestions.', savedSize: 'resized', loading: 'Loading photos …', count: 'photo(s)' }
};
const labels = language => words[language === 'en' ? 'en' : 'de'];
const photoId = () => crypto.randomUUID();

export function fitPhotoDimensions(width, height, edge = PHOTO_LIMITS.edge) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || !Number.isFinite(edge) || edge < 1) throw new TypeError('Ungültige Bildgröße');
  const scale = Math.min(1, edge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function validatePhotoFile(file) {
  return file instanceof Blob && file.size > 0 && file.size <= PHOTO_LIMITS.inputBytes && /^image\/(jpeg|png|webp|heic|heif|avif)$/i.test(file.type);
}

export async function prepareContactPhoto(file, language = 'de') {
  const l = labels(language);
  if (!validatePhotoFile(file)) throw new Error(l.invalid);
  let image, objectUrl;
  try {
    if (typeof createImageBitmap === 'function') {
      try { image = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* Safari may support the image through its native decoder. */ }
    }
    if (!image) {
      objectUrl = URL.createObjectURL(file);
      image = new Image(); image.decoding = 'async'; image.src = objectUrl;
      await image.decode();
    }
    const width = image.naturalWidth || image.width, height = image.naturalHeight || image.height;
    if (width * height > PHOTO_LIMITS.pixels) throw new Error(l.large);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error(l.failed);
    let acceptable = null;
    for (const edge of [1600, 1400, 1200, 1000, 800, 640]) {
      const size = fitPhotoDimensions(width, height, edge);
      canvas.width = size.width; canvas.height = size.height;
      context.fillStyle = '#fff'; context.fillRect(0, 0, size.width, size.height);
      context.drawImage(image, 0, 0, size.width, size.height);
      for (const quality of [.84, .74, .64, .54, .44]) {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (!blob || blob.type !== 'image/jpeg') throw new Error(l.failed);
        if (blob.size <= PHOTO_LIMITS.bytes) acceptable = { id: photoId(), blob, width: size.width, height: size.height, bytes: blob.size, originalBytes: file.size };
        if (blob.size <= PHOTO_LIMITS.targetBytes) { canvas.width = canvas.height = 1; return acceptable; }
      }
      if (Math.max(size.width, size.height) <= 640) break;
    }
    canvas.width = canvas.height = 1;
    if (acceptable) return acceptable;
    throw new Error(l.failed);
  } catch (error) {
    if ([l.large, l.failed].includes(error.message)) throw error;
    throw new Error(l.decode);
  } finally { image?.close?.(); if (objectUrl) URL.revokeObjectURL(objectUrl); }
}

export function parseBusinessCardText(rawText) {
  const text = String(rawText || '').slice(0, 20000);
  const lines = text.split(/[\r\n]+/).map(line => line.trim()).filter(Boolean).slice(0, 150);
  const email = text.match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+/i)?.[0]?.slice(0, 254) || '';
  const companyLine = lines.find(line => /\b(?:GmbH|KG|OHG|UG|Ltd\.?|Limited|Inc\.?|B\.?V\.?|S\.?A\.?R\.?L\.?|Firma|Company)\b/i.test(line));
  const company = companyLine?.replace(/^(?:Firma|Company)\s*:\s*/i, '').slice(0, 200) || '';
  const address = lines.find(line => /(?:straße|strasse|str\.?|weg|allee|gasse|platz|ring|laan)\s*\d+[a-z]?\b|^\d+\s+.+\b(?:road|street|lane|avenue)\b|\brue\s+.{1,80}\s+\d/i.test(line));
  const postal = lines.map(line => line.match(/(?:^|\s)(?:[A-Z]{1,3}[-\s])?(\d{4,6})\s+([\p{L}][\p{L}\s.'-]+)$/u)).find(Boolean);
  const phoneRows = lines.filter(line => /(?:tel(?:efon)?|phone|mobil|mobile|cell|fax)[\s:.]*\+?\d|\+\d[\d\s()/.-]{6,}/i.test(line));
  const phoneValue = line => (line || '').replace(/^(?:tel(?:efon)?|phone|mobil|mobile|cell|fax)[\s:.]*/i, '').trim().slice(0, 80);
  const mobileLine = phoneRows.find(line => /mobil|mobile|cell/i.test(line));
  const phoneLine = phoneRows.find(line => line !== mobileLine && !/fax/i.test(line));
  const named = lines.find(line => /^(?:Name|Ansprechpartner|Contact)\s*:/i.test(line));
  const probableName = lines.find(line => line !== companyLine && line !== address && !/[\d@]/.test(line) && !/www\.|https?:|fax|telefon|phone|sales|manager|director|vertrieb|geschäftsführer|engineer|landtechnik|agriculture/i.test(line) && line.split(/\s+/).length >= 2 && line.length <= 100);
  return Object.fromEntries(Object.entries({
    name: (named?.replace(/^(?:Name|Ansprechpartner|Contact)\s*:\s*/i, '') || probableName || '').slice(0, 200), company, email,
    phone: phoneValue(phoneLine), mobile: phoneValue(mobileLine), street: address?.slice(0, 200) || '', postalCode: postal?.[1] || '', city: postal?.[2]?.trim().slice(0, 160) || ''
  }).filter(([, value]) => value));
}

let ocrScript;
function loadOcr() {
  if (globalThis.Tesseract) return Promise.resolve(globalThis.Tesseract);
  if (!ocrScript) ocrScript = new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = '/ocr/tesseract.min.js'; script.async = true;
    script.onload = () => globalThis.Tesseract ? resolve(globalThis.Tesseract) : reject(new Error('OCR unavailable'));
    script.onerror = () => { script.remove(); reject(new Error('OCR unavailable')); };
    document.head.append(script);
  }).catch(error => { ocrScript = null; throw error; });
  return ocrScript;
}

export async function recognizeBusinessCard(blob, { signal, onProgress = () => {} } = {}) {
  let worker;
  const aborted = () => { if (signal?.aborted) throw new DOMException('Abgebrochen', 'AbortError'); };
  const stop = () => { void worker?.terminate(); };
  signal?.addEventListener('abort', stop, { once: true });
  try {
    aborted();
    const Tesseract = await loadOcr(); aborted();
    worker = await Tesseract.createWorker('deu+eng', 1, {
      workerPath: new URL('/ocr/worker.min.js', location.origin).href,
      corePath: new URL('/ocr/core/', location.origin).href,
      langPath: new URL('/ocr/lang/', location.origin).href,
      workerBlobURL: false, gzip: true, legacyCore: false, legacyLang: false,
      logger: message => { if (!signal?.aborted) onProgress(message); }
    });
    aborted();
    const result = await worker.recognize(blob); aborted();
    return String(result.data?.text || '').slice(0, 20000);
  } catch (error) { aborted(); throw error; }
  finally { signal?.removeEventListener('abort', stop); await worker?.terminate().catch(() => {}); }
}

function openPhoto(blobUrl, parent, l) {
  const dialog = document.createElement('dialog'); dialog.className = 'contact-dialog contact-photo-lightbox';
  dialog.innerHTML = `<div class="contact-dialog-head"><h2>${esc(l.photo)}</h2><button type="button" class="contact-dialog-close" aria-label="${esc(l.close)}">×</button></div><img src="${esc(blobUrl)}" alt="${esc(l.photo)}">`;
  dialog.addEventListener('click', event => { event.stopPropagation(); if (event.target.closest('button')) dialog.close(); });
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  parent.append(dialog); dialog.showModal();
}

export function photoEditorHtml(language = 'de') {
  const l = labels(language);
  const originalHint = language === 'en' ? 'Originals up to 25 MB are reduced automatically.' : 'Originalfotos bis 25 MB werden automatisch verkleinert.';
  return `<div class="contact-photo-editor" data-contact-photo-editor><div class="contact-photo-heading"><strong>${esc(l.title)}</strong><span data-photo-counter>0 / 2</span></div><p>${esc(l.hint)} ${esc(originalHint)}</p><div class="contact-photo-buttons"><button class="button secondary small" type="button" data-photo-action="camera">${icon('images')} ${esc(l.camera)}</button><button class="button secondary small" type="button" data-photo-action="gallery">${icon('plus')} ${esc(l.gallery)}</button></div><input type="file" accept="image/*" capture="environment" data-photo-camera aria-label="${esc(l.camera)}" hidden><input type="file" accept="image/*" data-photo-gallery aria-label="${esc(l.gallery)}" hidden><p class="contact-photo-progress" data-photo-progress role="status" hidden></p><div class="contact-photo-grid" data-photo-list></div></div>`;
}

export function mountPhotoEditor(host, { language = 'de', onChange = () => {}, onApply = () => {}, getFields = () => ({}) } = {}) {
  const l = labels(language);
  let photos = [], urls = new Map(), disposed = false, busy = false, version = 0, ocrController, ocrDialog;
  const status = (text, error = false) => { const node = host.querySelector('[data-photo-progress]'); node.hidden = !text; node.textContent = text; node.classList.toggle('error', error); };
  function clearUrls() { for (const url of urls.values()) URL.revokeObjectURL(url); urls.clear(); }
  function render() {
    clearUrls();
    host.querySelector('[data-photo-counter]').textContent = `${photos.length} / 2`;
    host.querySelectorAll('[data-photo-action="camera"], [data-photo-action="gallery"]').forEach(button => { button.disabled = busy || photos.length >= PHOTO_LIMITS.count; });
    host.querySelector('[data-photo-list]').innerHTML = photos.map((photo, index) => {
      const url = photo.blob instanceof Blob ? URL.createObjectURL(photo.blob) : null;
      if (url) urls.set(photo.id, url);
      return `<div class="contact-photo-item"><button class="contact-photo-preview" type="button" data-photo-action="view" data-photo-id="${esc(photo.id)}" aria-label="${esc(l.enlarge)} ${index + 1}"${url ? '' : ' disabled'}>${url ? `<img src="${esc(url)}" alt="${esc(l.photo)} ${index + 1}">` : icon('images')}</button><div class="contact-photo-caption"><strong>${esc(index ? l.back : l.front)}</strong><small>${photo.originalBytes ? `${new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'de-DE', { maximumFractionDigits: 1 }).format(photo.originalBytes / 1024 / 1024)} MB → ` : ''}${Math.ceil((photo.bytes || photo.blob?.size || 0) / 1024)} KB · ${esc(l.savedSize)}</small></div><div class="contact-photo-item-actions"><button class="text-button" type="button" data-photo-action="ocr" data-photo-id="${esc(photo.id)}"${!url || busy ? ' disabled' : ''}>${esc(l.scan)}</button><button class="text-button" type="button" data-photo-action="remove" data-photo-id="${esc(photo.id)}"${busy ? ' disabled' : ''}>${esc(l.remove)}</button></div>${!url ? `<small>${esc(l.unavailable)}</small>` : ''}</div>`;
    }).join('');
  }
  async function select(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || busy) return;
    if (photos.length >= PHOTO_LIMITS.count) { status(l.limit, true); return; }
    busy = true; render(); status(l.preparing);
    const startVersion = version;
    try {
      const photo = await prepareContactPhoto(file, language);
      if (disposed || startVersion !== version) return;
      photos.push(photo); version++; status(''); onChange();
    } catch (error) { if (!disposed) status(error.message || l.decode, true); }
    finally { busy = false; if (!disposed) render(); }
  }
  async function scan(photo) {
    if (!photo?.blob || busy) return;
    ocrController?.abort(); ocrController = new AbortController();
    const controller = ocrController;
    const dialog = document.createElement('dialog'); ocrDialog = dialog;
    dialog.className = 'contact-dialog contact-ocr-dialog';
    dialog.innerHTML = `<div class="contact-dialog-head"><h2>${esc(l.ocrTitle)}</h2><button type="button" class="contact-dialog-close" data-ocr-close aria-label="${esc(l.cancel)}">×</button></div><div class="contact-ocr-body"><p>${esc(l.ocrHint)}</p><p data-ocr-progress role="status">${esc(l.ocrLoading)}</p><div data-ocr-review></div></div><div class="contact-dialog-footer"><button class="button secondary" type="button" data-ocr-close>${esc(l.cancel)}</button></div>`;
    const cleanup = () => { controller.abort(); dialog.remove(); if (ocrDialog === dialog) ocrDialog = null; };
    dialog.addEventListener('cancel', event => { event.preventDefault(); dialog.close(); });
    dialog.addEventListener('close', cleanup, { once: true });
    dialog.addEventListener('click', event => {
      event.stopPropagation();
      if (event.target.closest('[data-ocr-close]')) dialog.close();
      if (event.target.closest('[data-ocr-apply]')) {
        const values = {};
        dialog.querySelectorAll('[data-ocr-field]:checked').forEach(check => { values[check.dataset.ocrField] = dialog.querySelector(`[data-ocr-value="${check.dataset.ocrField}"]`).value.trim(); });
        onApply(values); dialog.close();
      }
    });
    host.append(dialog); dialog.showModal();
    try {
      const text = await recognizeBusinessCard(photo.blob, { signal: controller.signal, onProgress: message => {
        if (!disposed && dialog.isConnected) dialog.querySelector('[data-ocr-progress]').textContent = message.status === 'recognizing text' ? `${l.ocrProgress}: ${Math.round((message.progress || 0) * 100)} %` : l.ocrLoading;
      } });
      if (disposed || controller.signal.aborted || !dialog.isConnected) return;
      const suggestions = parseBusinessCardText(text), current = getFields();
      dialog.querySelector('[data-ocr-progress]').textContent = Object.keys(suggestions).length ? l.existing : l.ocrEmpty;
      dialog.querySelector('[data-ocr-review]').innerHTML = `<label class="field"><span>${esc(l.recognized)}</span><textarea rows="5" readonly>${esc(text)}</textarea></label><div class="contact-ocr-fields">${Object.entries(suggestions).map(([key, value]) => `<label class="field"><span class="contact-ocr-choice"><input type="checkbox" data-ocr-field="${esc(key)}"${current[key] ? '' : ' checked'}>${esc(l[key])}</span><input data-ocr-value="${esc(key)}" maxlength="${key === 'email' ? 254 : ['phone', 'mobile'].includes(key) ? 80 : key === 'postalCode' ? 30 : key === 'city' ? 160 : 200}" value="${esc(value)}"></label>`).join('')}</div>${Object.keys(suggestions).length ? `<button class="button primary" type="button" data-ocr-apply>${esc(l.apply)}</button>` : ''}`;
    } catch (error) { if (!disposed && !controller.signal.aborted && dialog.isConnected) dialog.querySelector('[data-ocr-progress]').textContent = l.ocrFailed; }
  }
  function onClick(event) {
    const button = event.target.closest('[data-photo-action]'); if (!button || !host.contains(button)) return;
    event.stopPropagation();
    const action = button.dataset.photoAction, id = button.dataset.photoId;
    if (action === 'camera') host.querySelector('[data-photo-camera]').click();
    if (action === 'gallery') host.querySelector('[data-photo-gallery]').click();
    if (action === 'remove' && !busy) { photos = photos.filter(photo => photo.id !== id); version++; status(''); render(); onChange(); }
    if (action === 'view' && urls.has(id)) openPhoto(urls.get(id), host, l);
    if (action === 'ocr') void scan(photos.find(photo => photo.id === id));
  }
  host.addEventListener('click', onClick); host.querySelectorAll('input[type="file"]').forEach(input => input.addEventListener('change', select));
  render();
  return {
    getPhotos: () => photos.map(photo => ({ ...photo })), getVersion: () => version,
    isBusy: () => busy, waitingMessage: l.wait,
    setPhotos(next = []) { version++; photos = next.slice(0, PHOTO_LIMITS.count).map(photo => ({ ...photo })); status(''); render(); },
    close() { disposed = true; version++; ocrController?.abort(); if (ocrDialog?.open) ocrDialog.close(); host.querySelectorAll('.contact-photo-lightbox').forEach(dialog => { if (dialog.open) dialog.close(); }); clearUrls(); host.removeEventListener('click', onClick); host.querySelectorAll('input[type="file"]').forEach(input => input.removeEventListener('change', select)); }
  };
}

export function photoDetailsHtml(photos, language = 'de') {
  if (!photos?.length) return '';
  const l = labels(language);
  return `<section class="contact-photo-details" data-contact-photo-details><h3>${esc(l.title)} <span>${photos.length} ${esc(l.count)}</span></h3><p data-photo-detail-state>${esc(l.loading)}</p><div class="contact-photo-grid" data-photo-detail-list></div></section>`;
}

export function mountPhotoDetails(host, { language = 'de', loadPhotos } = {}) {
  if (!host) return () => {};
  const l = labels(language), urls = new Map(); let active = true;
  const onClick = event => {
    const button = event.target.closest('[data-detail-photo]');
    if (button && urls.has(button.dataset.detailPhoto)) { event.stopPropagation(); openPhoto(urls.get(button.dataset.detailPhoto), host, l); }
  };
  host.addEventListener('click', onClick);
  Promise.resolve().then(loadPhotos).then(photos => {
    if (!active || !host.isConnected) return;
    let unavailable = false;
    host.querySelector('[data-photo-detail-list]').innerHTML = photos.map((photo, index) => {
      if (!(photo.blob instanceof Blob)) { unavailable = true; return `<p class="contact-photo-unavailable">${esc(l.unavailable)}</p>`; }
      const url = URL.createObjectURL(photo.blob); urls.set(photo.id, url);
      return `<button class="contact-photo-preview" type="button" data-detail-photo="${esc(photo.id)}" aria-label="${esc(l.enlarge)} ${index + 1}"><img src="${esc(url)}" alt="${esc(l.photo)} ${index + 1}"></button>`;
    }).join('');
    const state = host.querySelector('[data-photo-detail-state]'); state.hidden = !unavailable; state.textContent = unavailable ? l.unavailable : '';
  }).catch(() => { if (active && host.isConnected) host.querySelector('[data-photo-detail-state]').textContent = l.unavailable; });
  return () => { active = false; for (const url of urls.values()) URL.revokeObjectURL(url); host.querySelectorAll('.contact-photo-lightbox').forEach(dialog => { if (dialog.open) dialog.close(); }); host.removeEventListener('click', onClick); };
}
