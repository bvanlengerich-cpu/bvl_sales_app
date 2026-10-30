import { icon } from './icons.js';

export const CONTACTS_ROUTE = '#/contacts';
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const words = {
  de: {
    title: 'Messekontakte', intro: 'Gute Gespräche festhalten. Gemeinsam dranbleiben.', back: 'Zurück', capture: 'Kontakt erfassen', mine: 'Meine Kontakte', new: 'Neuer Kontakt', edit: 'Kontakt bearbeiten', save: 'Kontakt speichern', saving: 'Wird gespeichert …', saved: 'Kontakt auf diesem Gerät gespeichert.', draft: 'Entwurf wird auf diesem Gerät gesichert.', draftSaved: 'Entwurf auf diesem Gerät gesichert.', localError: 'Der Entwurf konnte nicht lokal gespeichert werden. Bitte die Seite nicht schließen.', fair: 'Messe / Veranstaltung', year: 'Messejahr', seller: 'Erfasst von', context: 'Ihr Messebesuch', contextHint: 'Messe und Jahr werden für den nächsten Kontakt übernommen.', person: 'Kontakt', personHint: 'Name und Messe sind Pflichtfelder. Alles Weitere können Sie später ergänzen.', name: 'Ansprechpartner / Name', company: 'Betrieb / Unternehmen', email: 'E-Mail-Adresse', phone: 'Telefon', mobile: 'Mobil', address: 'Adresse & Kundensprache', street: 'Straße / Hausnummer', postalCode: 'PLZ', city: 'Ort', country: 'Land', customerLanguage: 'Kundensprache', interests: 'Interesse & Maschine', interestHint: 'Mehrere Interessen sind möglich. Ohne Produktauswahl können Sie ebenfalls speichern.', family: 'Produktbereich', model: 'Maschinentyp', variant: 'Ausführung', detail: 'Anforderung / Beschreibung', addInterest: 'Weiteres Interesse', remove: 'Entfernen', choose: 'Bitte auswählen', next: 'Nächster Schritt', requests: 'Vereinbarte Aktionen', visit: 'Kundenbesuch', offer: 'Angebot', demo: 'Vorführung', service: 'Service / Reklamation', notes: 'Gesprächsnotiz', notesHint: 'Was wurde besprochen oder vereinbart?', followUp: 'Nachfassen am', priority: 'Priorität', normal: 'Normal', high: 'Hoch', low: 'Niedrig', status: 'Bearbeitungsstatus', statusNew: 'Neu', statusProgress: 'In Bearbeitung', statusDone: 'Erledigt', more: 'Weitere Maschinendaten', cows: 'Anzahl Kühe', currentMachine: 'Vorhandene Maschine / Marke', machineYear: 'Baujahr', volume: 'Gewünschtes Volumen / Größe', purchaseTime: 'Geplanter Kauf', sync: 'Jetzt abgleichen', syncing: 'Abgleich läuft …', synced: 'Mit dem Server synchronisiert', pending: 'Noch nicht synchronisiert', conflict: 'Änderungskonflikt', offline: 'Offline: Kontakte bleiben zunächst auf diesem Gerät. Abgleich bei Verbindung und geöffneter App.', waiting: 'Kontakt(e) warten auf Abgleich', error: 'Abgleich derzeit nicht möglich. Lokale Änderungen bleiben gespeichert.', mail: 'Dankes-E-Mail öffnen', mailHint: 'Öffnet einen bearbeitbaren Entwurf in Ihrer Mail-App. Dort bestätigen Sie den Versand.', noEmail: 'Für eine Dankesmail ist eine gültige E-Mail-Adresse erforderlich.', savedNext: 'Wie möchten Sie weitermachen?', search: 'Name, Betrieb oder Ort suchen', allFairs: 'Alle Messen', allYears: 'Alle Jahre', allStatus: 'Alle Status', allPriority: 'Alle Prioritäten', allOwners: 'Alle Bearbeiter', empty: 'Noch keine Messekontakte', emptyHint: 'Ihre gespeicherten Gespräche erscheinen hier – auch bevor sie mit dem Server abgeglichen sind.', noResults: 'Keine passenden Kontakte gefunden.', details: 'Details', created: 'Erstellt', updated: 'Zuletzt geändert', close: 'Schließen', yourVersion: 'Ihre lokale Fassung', serverVersion: 'Fassung auf dem Server', conflictHint: 'Dieser Kontakt wurde zwischenzeitlich geändert. Entscheiden Sie bewusst, welche Fassung weiterverwendet wird.', keepLocal: 'Meine Fassung übernehmen', keepServer: 'Serverfassung übernehmen', resolve: 'Konflikt klären', unavailable: 'Messekontakte sind nur für BvL-Mitarbeitende und Admins verfügbar.', adminIntro: 'Alle Messegespräche an einem Ort. Filtern, nachlesen und für die Nachbearbeitung exportieren.', loading: 'Kontakte werden geladen …', loadError: 'Kontakte konnten nicht geladen werden.', retry: 'Erneut laden', total: 'Kontakte im Filter', fairs: 'Messen', export: 'Gefilterte Kontakte als CSV', exportSelected: 'Auswahl als CSV', exportHint: 'CSV-Dateien lassen sich in Excel öffnen. Exportiert werden die gespeicherten Serverdaten.', selected: 'ausgewählt', selectAll: 'Alle angezeigten Kontakte auswählen', select: 'Kontakt auswählen', exporting: 'Export wird erstellt …', exportError: 'Export konnte nicht erstellt werden.', serverOnly: 'Diese Übersicht zeigt synchronisierte Kontakte auf dem VPS.', contact: 'Kontakt', date: 'Datum', local: 'Lokal gespeichert', dismiss: 'Schließen', nothingSelected: 'Bitte zuerst Kontakte auswählen.'
  },
  en: {
    title: 'Trade fair contacts', intro: 'Capture good conversations. Keep things moving.', back: 'Back', capture: 'Capture contact', mine: 'My contacts', new: 'New contact', edit: 'Edit contact', save: 'Save contact', saving: 'Saving …', saved: 'Contact saved on this device.', draft: 'Draft is being saved on this device.', draftSaved: 'Draft saved on this device.', localError: 'The draft could not be saved locally. Please do not close this page.', fair: 'Trade fair / event', year: 'Fair year', seller: 'Captured by', context: 'Your trade fair', contextHint: 'Fair and year are reused for the next contact.', person: 'Contact', personHint: 'Name and fair are required. Everything else can be added later.', name: 'Contact name', company: 'Farm / company', email: 'Email address', phone: 'Telephone', mobile: 'Mobile', address: 'Address & customer language', street: 'Street / house number', postalCode: 'Postal code', city: 'City', country: 'Country', customerLanguage: 'Customer language', interests: 'Interest & machine', interestHint: 'You can add several interests or save without selecting a product.', family: 'Product range', model: 'Machine type', variant: 'Configuration', detail: 'Requirement / description', addInterest: 'Add interest', remove: 'Remove', choose: 'Please select', next: 'Next step', requests: 'Agreed actions', visit: 'Customer visit', offer: 'Quotation', demo: 'Demonstration', service: 'Service / complaint', notes: 'Conversation notes', notesHint: 'What was discussed or agreed?', followUp: 'Follow up on', priority: 'Priority', normal: 'Normal', high: 'High', low: 'Low', status: 'Contact status', statusNew: 'New', statusProgress: 'In progress', statusDone: 'Completed', more: 'Additional machine details', cows: 'Number of cows', currentMachine: 'Existing machine / brand', machineYear: 'Year of manufacture', volume: 'Required volume / size', purchaseTime: 'Planned purchase', sync: 'Sync now', syncing: 'Syncing …', synced: 'Synchronized with the server', pending: 'Not synchronized yet', conflict: 'Conflicting changes', offline: 'Offline: contacts stay on this device for now. Sync resumes with a connection while the app is open.', waiting: 'contact(s) waiting to sync', error: 'Sync is currently unavailable. Local changes remain saved.', mail: 'Open thank-you email', mailHint: 'Opens an editable draft in your email app. You confirm sending there.', noEmail: 'A valid email address is required for a thank-you email.', savedNext: 'What would you like to do next?', search: 'Search name, company or city', allFairs: 'All fairs', allYears: 'All years', allStatus: 'All statuses', allPriority: 'All priorities', allOwners: 'All staff', empty: 'No trade fair contacts yet', emptyHint: 'Saved conversations appear here, including contacts still waiting to sync.', noResults: 'No matching contacts found.', details: 'Details', created: 'Created', updated: 'Last updated', close: 'Close', yourVersion: 'Your local version', serverVersion: 'Server version', conflictHint: 'This contact has changed since your last sync. Choose which version to continue with.', keepLocal: 'Use my version', keepServer: 'Use server version', resolve: 'Resolve conflict', unavailable: 'Trade fair contacts are available only to BvL staff and admins.', adminIntro: 'All fair conversations in one place. Filter, review and export for follow-up.', loading: 'Loading contacts …', loadError: 'Contacts could not be loaded.', retry: 'Reload', total: 'Contacts in filter', fairs: 'Trade fairs', export: 'Export filtered contacts as CSV', exportSelected: 'Export selection as CSV', exportHint: 'CSV files can be opened in Excel. Exports contain saved server data.', selected: 'selected', selectAll: 'Select all displayed contacts', select: 'Select contact', exporting: 'Creating export …', exportError: 'Export could not be created.', serverOnly: 'This overview shows contacts synchronized to the VPS.', contact: 'Contact', date: 'Date', local: 'Saved locally', dismiss: 'Dismiss', nothingSelected: 'Please select contacts first.'
  }
};
const labels = language => words[language === 'en' ? 'en' : 'de'];
const statuses = l => [['new', l.statusNew], ['in_progress', l.statusProgress], ['done', l.statusDone]];
const priorities = l => [['normal', l.normal], ['high', l.high], ['low', l.low]];
const date = (iso, language) => iso && Number.isFinite(Date.parse(iso)) ? new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'de-DE', { dateStyle: 'medium' }).format(new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso)) : '—';
const productText = data => (data.interests || []).map(item => [item.model || item.family, item.variant, item.detail].filter(Boolean).join(' / ')).filter(Boolean).join(', ');
const productMailText = data => {
  const summary = (data.interests || []).slice(0, 5).map(item => [item.model || item.family, item.variant].filter(Boolean).join(' / ')).filter(Boolean).join(', ');
  return summary.length > 300 ? `${summary.slice(0, 299)}…` : summary;
};
const requestLabels = l => ({ visit: l.visit, offer: l.offer, demo: l.demo, service: l.service });
const options = (items, value = '') => items.map(([key, caption]) => `<option value="${esc(key)}"${String(value) === String(key) ? ' selected' : ''}>${esc(caption)}</option>`).join('');

export function isInternalContactsLink(rawUrl, currentHref = 'https://sales.bvlki.cloud/') {
  try {
    const current = new URL(currentHref), target = new URL(rawUrl, current);
    return target.hash === CONTACTS_ROUTE && ['/', '/index.html'].includes(target.pathname)
      && (target.origin === current.origin || target.origin === 'https://sales.bvlki.cloud');
  } catch { return false; }
}

export function buildContactMailto(contact, user = {}) {
  const data = contact?.data || contact || {};
  const email = String(data.email || '').trim();
  if (email.length > 254 || /[\s\r\n<>,;?]/.test(email) || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) return null;
  const english = data.customerLanguage && data.customerLanguage !== 'de';
  const fair = String(data.fair || (english ? 'the trade fair' : 'Messe')).replace(/[\r\n]+/g, ' ');
  const person = String(data.name || '').trim();
  const products = productMailText(data);
  const signature = String(user.displayName || contact.ownerName || 'BvL').trim();
  const subject = english ? `Thank you for your visit · ${fair}` : `Vielen Dank für Ihren Besuch · ${fair}`;
  const body = english
    ? `Hello${person ? ` ${person}` : ''},\r\n\r\nThank you for visiting us at ${fair} and for the pleasant conversation.${products ? `\r\n\r\nWe were pleased to discuss your interest in ${products}.` : ''}\r\n\r\nPlease feel free to contact me if you have any questions. I look forward to staying in touch.\r\n\r\nKind regards\r\n${signature}\r\nBvL`
    : `Guten Tag${person ? ` ${person}` : ''},\r\n\r\nvielen Dank für Ihren Besuch auf der ${fair} und das angenehme Gespräch.${products ? `\r\n\r\nGerne greifen wir Ihr Interesse an ${products} auf.` : ''}\r\n\r\nBei Fragen bin ich gerne für Sie da. Ich freue mich auf den weiteren Austausch.\r\n\r\nMit freundlichen Grüßen\r\n${signature}\r\nBvL`;
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function mailLink(contact, user, l, className = 'button secondary small') {
  const href = buildContactMailto(contact, user);
  return href ? `<a class="${className}" href="${esc(href)}">${icon('mail')} ${esc(l.mail)}</a>` : `<button class="${className}" type="button" disabled title="${esc(l.noEmail)}">${icon('mail')} ${esc(l.mail)}</button>`;
}

function field(l, name, type = 'text', { required = false, max = 160, wide = false, inputmode = '', autocomplete = '' } = {}) {
  const limit = ({ country: 100, volume: 100, purchaseTime: 100 })[name] || max;
  return `<label class="field${wide ? ' contact-wide' : ''}"><span>${esc(l[name] || name)}${required ? ' *' : ''}</span><input name="${name}" type="${type}" maxlength="${limit}"${name === 'machineYear' ? ' pattern="(19|20|21)[0-9]{2}"' : ''}${required ? ' required' : ''}${inputmode ? ` inputmode="${inputmode}"` : ''}${autocomplete ? ` autocomplete="${autocomplete}"` : ''}></label>`;
}

function interestHtml(item, l) {
  const families = ['V-MIX', 'V-LOAD', 'V-COMFORT', 'V-CONNECT'];
  return `<div class="contact-interest" data-contact-interest><div class="contact-interest-heading"><strong>${esc(l.interests)}</strong><button class="text-button" type="button" data-contact-action="remove-interest">${esc(l.remove)}</button></div><div class="contact-form-grid">
    <label class="field">${esc(l.family)}<select data-interest-field="family">${options([['', l.choose], ...families.map(x => [x, x])], item.family)}</select></label>
    <label class="field">${esc(l.model)}<input data-interest-field="model" maxlength="100" list="contact-machine-types" value="${esc(item.model)}"></label>
    <label class="field contact-wide">${esc(l.variant)}<input data-interest-field="variant" maxlength="100" value="${esc(item.variant)}"></label>
    <label class="field contact-wide">${esc(l.detail)}<textarea data-interest-field="detail" maxlength="300" rows="2">${esc(item.detail)}</textarea></label>
  </div></div>`;
}

function contactForm(l, user) {
  return `<form data-contact-form id="bvl-contact-form">
    <div class="contact-form-layout"><div class="contact-form-main">
      <section class="contact-card contact-context"><div class="contact-card-title"><span class="contact-number">${icon('presentation')}</span><div><h2>${esc(l.context)}</h2><p>${esc(l.contextHint)}</p></div></div><div class="contact-form-grid">${field(l, 'fair', 'text', { required: true, max: 160 })}<label class="field">${esc(l.year)}<input name="fairYear" type="number" min="1900" max="2199" step="1" value="${new Date().getFullYear()}" required></label></div><p class="contact-owner">${icon('user-round')} ${esc(l.seller)}: <strong>${esc(user.displayName)}</strong></p></section>
      <section class="contact-card"><div class="contact-card-title"><span class="contact-number">01</span><div><h2>${esc(l.person)}</h2><p>${esc(l.personHint)}</p></div></div><div class="contact-form-grid">${field(l, 'name', 'text', { required: true, autocomplete: 'name' })}${field(l, 'company', 'text', { autocomplete: 'organization' })}${field(l, 'email', 'email', { max: 254, inputmode: 'email', autocomplete: 'email', wide: true })}${field(l, 'phone', 'tel', { max: 80, autocomplete: 'tel' })}${field(l, 'mobile', 'tel', { max: 80 })}</div><details class="contact-disclosure"><summary>${esc(l.address)}${icon('chevron-right')}</summary><div class="contact-form-grid">${field(l, 'street', 'text', { wide: true, max: 200, autocomplete: 'street-address' })}${field(l, 'postalCode', 'text', { max: 30, autocomplete: 'postal-code' })}${field(l, 'city', 'text', { autocomplete: 'address-level2' })}${field(l, 'country', 'text', { autocomplete: 'country-name' })}<label class="field">${esc(l.customerLanguage)}<select name="customerLanguage">${options([['de', 'Deutsch'], ['en', 'English'], ['nl', 'Nederlands'], ['fr', 'Français'], ['pl', 'Polski'], ['da', 'Dansk'], ['sv', 'Svenska']], 'de')}</select></label></div></details></section>
      <section class="contact-card"><div class="contact-card-title"><span class="contact-number">02</span><div><h2>${esc(l.interests)}</h2><p>${esc(l.interestHint)}</p></div></div><div data-contact-interests>${interestHtml({}, l)}</div><button class="button secondary small" type="button" data-contact-action="add-interest">${icon('plus')} ${esc(l.addInterest)}</button><datalist id="contact-machine-types">${['V-MIX Agilo', 'V-MIX Plus', 'V-MIX Giant', 'V-MIX Fill Plus L', 'V-MIX Fill Plus LS pro', 'V-MIX Drive', 'V-MIX Fix', 'V-BIO', 'V-LOAD Cutter', 'V-LOAD Shear', 'V-COMFORT Bedding', 'Dairy Feeder'].map(x => `<option value="${esc(x)}"></option>`).join('')}</datalist><details class="contact-disclosure"><summary>${esc(l.more)}${icon('chevron-right')}</summary><div class="contact-form-grid">${field(l, 'cows', 'text', { inputmode: 'numeric', max: 40 })}${field(l, 'currentMachine')}${field(l, 'machineYear', 'text', { inputmode: 'numeric', max: 4 })}${field(l, 'volume')}${field(l, 'purchaseTime', 'text', { wide: true })}</div></details></section>
      <section class="contact-card"><div class="contact-card-title"><span class="contact-number">03</span><div><h2>${esc(l.next)}</h2></div></div><fieldset class="contact-request-group"><legend>${esc(l.requests)}</legend>${['visit', 'offer', 'demo', 'service'].map(key => `<label class="contact-request"><input name="requests" type="checkbox" value="${key}"><span>${esc(l[key])}</span></label>`).join('')}</fieldset><div class="contact-form-grid"><label class="field contact-wide">${esc(l.notes)}<textarea name="notes" rows="4" maxlength="5000" placeholder="${esc(l.notesHint)}"></textarea></label>${field(l, 'followUp', 'date', { max: 10 })}<label class="field">${esc(l.priority)}<select name="priority">${options(priorities(l), 'normal')}</select></label><label class="field contact-wide">${esc(l.status)}<select name="status">${options(statuses(l), 'new')}</select></label></div></section>
    </div><aside class="contact-form-aside"><section class="contact-card contact-mail-note">${icon('mail')}<h2>${esc(l.mail)}</h2><p>${esc(l.mailHint)}</p></section></aside></div>
    <div class="contact-savebar"><span data-contact-draft-status>${esc(l.draft)}</span><button class="button primary" type="submit">${icon('check')} <span data-contact-save-label>${esc(l.save)}</span></button></div>
  </form>`;
}

export function renderContactsPage(language = 'de', user = {}) {
  const l = labels(language), allowed = ['admin', 'staff'].includes(user.role);
  return `<main class="main-content contacts-page" data-contacts-page><div class="contacts-heading"><a href="#/home" class="button secondary">${icon('arrow-left')} ${esc(l.back)}</a><div><p class="eyebrow">BvL Sales</p><h1 class="page-title">${esc(l.title)}</h1><p>${esc(l.intro)}</p></div></div>${!allowed ? `<div class="empty-state">${esc(l.unavailable)}</div>` : `<div class="contacts-sync" data-contact-sync role="status" aria-live="polite"></div><div class="contact-tabs" role="tablist" aria-label="${esc(l.title)}"><button role="tab" aria-selected="true" aria-controls="contact-capture-panel" data-contact-tab="capture">${icon('plus')} ${esc(l.capture)}</button><button role="tab" aria-selected="false" aria-controls="contact-list-panel" data-contact-tab="list">${icon('users')} ${esc(l.mine)} <span data-contact-count>0</span></button></div><section id="contact-capture-panel" role="tabpanel" data-contact-pane="capture"><div class="contact-edit-title" data-contact-edit-title hidden><h2>${esc(l.edit)}</h2><button class="text-button" type="button" data-contact-action="new">${esc(l.new)}</button></div><div class="contact-saved-panel" data-contact-saved hidden></div>${contactForm(l, user)}</section><section id="contact-list-panel" role="tabpanel" data-contact-pane="list" hidden><div class="contact-list-filters"><label class="field"><span>${esc(l.search)}</span><input type="search" data-contact-search placeholder="${esc(l.search)}"></label><label class="field"><span>${esc(l.fair)}</span><select data-contact-fair><option value="">${esc(l.allFairs)}</option></select></label></div><div data-contact-list></div></section><dialog class="contact-dialog" data-contact-dialog></dialog>`}</main>`;
}

function syncBadge(record, l) {
  const state = record.syncState || 'synced';
  return `<span class="contact-status contact-sync-${esc(state)}">${icon(state === 'synced' ? 'check' : state === 'conflict' ? 'shield-check' : 'clock-3')} ${esc(state === 'synced' ? l.synced : state === 'conflict' ? l.conflict : l.pending)}</span>`;
}

function cardHtml(record, l, language, user) {
  const data = record.data || {}, conflict = record.syncState === 'conflict';
  return `<article class="contact-list-card"><div class="contact-list-card-top"><div><p class="contact-card-fair">${esc(data.fair)} · ${esc(data.fairYear)}</p><h2>${esc(data.name || data.company)}</h2>${data.company && data.name ? `<p class="contact-company">${esc(data.company)}</p>` : ''}</div><span class="contact-priority contact-priority-${esc(data.priority)}">${esc(new Map(priorities(l)).get(data.priority) || l.normal)}</span></div><div class="contact-card-meta"><span>${[data.postalCode, data.city].filter(Boolean).map(esc).join(' ') || '—'}</span><span>${esc(date(record.createdAt, language))}</span></div>${productText(data) ? `<p class="contact-product">${esc(productText(data))}</p>` : ''}<div class="contact-card-state">${syncBadge(record, l)}<span>${esc(new Map(statuses(l)).get(data.status) || l.statusNew)}</span></div><div class="contact-card-actions"><button class="button secondary small" type="button" data-contact-action="details" data-id="${esc(record.id)}">${esc(l.details)}</button><button class="button secondary small" type="button" data-contact-action="edit" data-id="${esc(record.id)}">${icon('edit-3')} ${esc(l.edit)}</button>${mailLink(record, user, l)}${conflict ? `<button class="button danger small" type="button" data-contact-action="conflict" data-id="${esc(record.id)}">${esc(l.resolve)}</button>` : ''}</div></article>`;
}

function detailHtml(record, l, language, user) {
  const d = record.data || {};
  const values = [
    [l.company, d.company], [l.email, d.email], [l.phone, d.phone], [l.mobile, d.mobile],
    [l.address, [d.street, [d.postalCode, d.city].filter(Boolean).join(' '), d.country].filter(Boolean).join(', ')],
    [l.fair, [d.fair, d.fairYear].filter(Boolean).join(' · ')], [l.seller, record.ownerName], [l.created, date(record.createdAt, language)],
    [l.status, new Map(statuses(l)).get(d.status)], [l.priority, new Map(priorities(l)).get(d.priority)],
    [l.followUp, d.followUp ? date(d.followUp, language) : ''], [l.interests, productText(d)],
    [l.requests, (d.requests || []).map(key => requestLabels(l)[key] || key).join(', ')],
    [l.cows, d.cows], [l.currentMachine, d.currentMachine], [l.machineYear, d.machineYear], [l.volume, d.volume], [l.purchaseTime, d.purchaseTime], [l.notes, d.notes]
  ].filter(([, value]) => value !== '' && value != null);
  return `<div class="contact-dialog-head"><div><p class="eyebrow">${esc(l.contact)}</p><h2>${esc(d.name || d.company)}</h2></div><button class="contact-dialog-close" type="button" data-contact-action="close" aria-label="${esc(l.close)}">×</button></div><dl class="contact-details">${values.map(([caption, value]) => `<div><dt>${esc(caption)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl><div class="contact-dialog-footer">${mailLink(record, user, l, 'button primary')}<p>${esc(l.mailHint)}</p></div>`;
}

function showDialog(dialog, html) {
  dialog.innerHTML = html;
  if (!dialog.open) dialog.showModal();
}

export function mountContactsPage(container, { language = 'de', user, store, notify = () => {}, isOffline = () => !navigator.onLine } = {}) {
  const page = container.matches?.('[data-contacts-page]') ? container : container.querySelector('[data-contacts-page]');
  if (!page || !store || !['admin', 'staff'].includes(user?.role)) return () => {};
  const l = labels(language), form = page.querySelector('[data-contact-form]'), dialog = page.querySelector('[data-contact-dialog]');
  let disposed = false, editingId = null, draftTimer, saving = false, latestSaved = null;
  let currentFair = '', query = '', formEdited = false;
  const ownContacts = () => (store.getState().contacts || []).filter(record => record.ownerId === user.id);
  function formData() {
    const values = Object.fromEntries(new FormData(form));
    delete values.requests;
    values.fairYear = Number(values.fairYear);
    values.requests = [...form.querySelectorAll('input[name="requests"]:checked')].map(el => el.value);
    values.interests = [...form.querySelectorAll('[data-contact-interest]')].map(el => Object.fromEntries(['family', 'model', 'variant', 'detail'].map(key => [key, el.querySelector(`[data-interest-field="${key}"]`).value.trim()]))).filter(item => Object.values(item).some(Boolean));
    return values;
  }
  function fill(data = {}, id = null) {
    form.reset(); editingId = id; formEdited = false;
    for (const [key, value] of Object.entries(data)) {
      const el = form.elements.namedItem(key);
      if (el?.tagName && !['checkbox', 'file'].includes(el.type)) el.value = value ?? '';
    }
    form.elements.namedItem('fairYear').value = /^(19|20|21)\d{2}$/.test(String(data.fairYear || '')) ? String(data.fairYear) : String(new Date().getFullYear());
    if (!data.country) form.elements.country.value = language === 'en' ? '' : 'Deutschland';
    if (!data.customerLanguage) form.elements.customerLanguage.value = language === 'en' ? 'en' : 'de';
    form.querySelectorAll('input[name="requests"]').forEach(el => { el.checked = (data.requests || []).includes(el.value); });
    page.querySelector('[data-contact-interests]').innerHTML = (data.interests?.length ? data.interests : [{}]).map(item => interestHtml(item, l)).join('');
    page.querySelector('[data-contact-edit-title]').hidden = !id;
    page.querySelector('[data-contact-draft-status]').textContent = l.draft;
  }
  function setTab(tab) {
    page.querySelectorAll('[data-contact-tab]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.contactTab === tab)));
    page.querySelectorAll('[data-contact-pane]').forEach(pane => { pane.hidden = pane.dataset.contactPane !== tab; });
  }
  async function persistDraft() {
    clearTimeout(draftTimer);
    try {
      await store.saveDraft({ data: formData(), editingId });
      if (!disposed) page.querySelector('[data-contact-draft-status]').textContent = l.draftSaved;
    } catch {
      if (!disposed) { page.querySelector('[data-contact-draft-status]').textContent = l.localError; notify(l.localError, true); }
    }
  }
  function changed() {
    formEdited = true;
    clearTimeout(draftTimer);
    page.querySelector('[data-contact-draft-status]').textContent = l.draft;
    draftTimer = setTimeout(persistDraft, 400);
  }
  function refresh() {
    if (disposed) return;
    const state = store.getState(), records = ownContacts(), sync = page.querySelector('[data-contact-sync]');
    const pending = state.pendingCount || 0, conflicts = state.conflicts?.length || 0, offline = isOffline();
    const message = state.syncing ? l.syncing : offline ? l.offline : conflicts ? `${conflicts} ${l.conflict}` : pending ? `${pending} ${l.waiting}` : l.synced;
    sync.classList.toggle('has-pending', pending > 0 || conflicts > 0 || offline);
    sync.innerHTML = `<span>${icon(state.syncing ? 'refresh-cw' : pending || conflicts || offline ? 'clock-3' : 'shield-check')} ${esc(message)}</span><button class="text-button" type="button" data-contact-action="sync"${state.syncing || offline ? ' disabled' : ''}>${esc(l.sync)}</button>${state.error ? `<small>${esc(l.error)} ${esc(state.error.message || state.error)}</small>` : ''}`;
    page.querySelector('[data-contact-count]').textContent = records.length;
    const fairs = [...new Set(records.map(record => record.data?.fair).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    page.querySelector('[data-contact-fair]').innerHTML = options([['', l.allFairs], ...fairs.map(fair => [fair, fair])], currentFair);
    const filtered = records.filter(record => (!currentFair || record.data?.fair === currentFair) && (!query || [record.data?.name, record.data?.company, record.data?.email, record.data?.city].join(' ').toLocaleLowerCase().includes(query)));
    page.querySelector('[data-contact-list]').innerHTML = filtered.length ? `<div class="contact-cards">${filtered.map(record => cardHtml(record, l, language, user)).join('')}</div>` : `<div class="contact-empty">${icon('users')}<h2>${esc(records.length ? l.noResults : l.empty)}</h2>${!records.length ? `<p>${esc(l.emptyHint)}</p>` : ''}</div>`;
    if (latestSaved) {
      const saved = records.find(record => record.id === latestSaved.id) || latestSaved;
      const panel = page.querySelector('[data-contact-saved]');
      panel.hidden = false;
      panel.innerHTML = `<div><span class="contact-success-icon">${icon('check')}</span><h2>${esc(l.saved)}</h2><p>${esc(saved.data.name || saved.data.company)} · ${esc(saved.data.fair)}</p>${syncBadge(saved, l)}</div><div class="contact-card-actions">${mailLink(saved, user, l, 'button primary')}<button class="button secondary" type="button" data-contact-action="dismiss-saved">${esc(l.new)}</button></div><small>${esc(l.mailHint)}</small>`;
    }
  }
  async function onSubmit(event) {
    event.preventDefault();
    if (saving || !form.reportValidity()) return;
    saving = true; clearTimeout(draftTimer);
    form.inert = true;
    form.querySelector('[type="submit"]').disabled = true;
    page.querySelector('[data-contact-save-label]').textContent = l.saving;
    const data = formData();
    try {
      const saved = await store.save(data, editingId || undefined);
      if (disposed) return;
      latestSaved = saved || ownContacts().find(record => record.id === editingId);
      const context = { fair: data.fair, fairYear: data.fairYear, customerLanguage: data.customerLanguage, country: data.country };
      fill(context);
      await store.saveDraft({ data: context, editingId: null });
      if (disposed) return;
      refresh(); notify(l.saved);
      void store.sync().catch(() => {});
      page.querySelector('[data-contact-saved]').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (error) {
      if (!disposed) notify(error.message || l.localError, true);
    } finally {
      saving = false;
      if (!disposed) { form.inert = false; form.querySelector('[type="submit"]').disabled = false; page.querySelector('[data-contact-save-label]').textContent = l.save; }
    }
  }
  async function onClick(event) {
    const tab = event.target.closest('[data-contact-tab]');
    if (tab) { setTab(tab.dataset.contactTab); return; }
    const button = event.target.closest('[data-contact-action]');
    if (!button) return;
    const action = button.dataset.contactAction, id = button.dataset.id;
    const record = ownContacts().find(item => item.id === id);
    if (action === 'close') dialog.close();
    if (action === 'sync') void store.sync().catch(error => { if (!disposed) notify(error.message || l.error, true); });
    if (action === 'add-interest' && page.querySelectorAll('[data-contact-interest]').length < 30) { page.querySelector('[data-contact-interests]').insertAdjacentHTML('beforeend', interestHtml({}, l)); changed(); }
    if (action === 'remove-interest') { button.closest('[data-contact-interest]').remove(); changed(); }
    if (action === 'dismiss-saved') { latestSaved = null; page.querySelector('[data-contact-saved]').hidden = true; form.elements.name.focus(); }
    if (action === 'new') {
      const context = { fair: form.elements.fair.value, fairYear: Number(form.elements.fairYear.value) || new Date().getFullYear(), customerLanguage: form.elements.customerLanguage.value, country: form.elements.country.value };
      fill(context); changed(); setTab('capture');
    }
    if (action === 'edit' && record) {
      latestSaved = null; page.querySelector('[data-contact-saved]').hidden = true;
      fill(record.data, record.id); setTab('capture'); await persistDraft();
      if (!disposed) form.elements.name.focus();
    }
    if (action === 'details' && record) showDialog(dialog, detailHtml(record, l, language, user));
    if (action === 'conflict') {
      const conflict = (store.getState().conflicts || []).find(item => item.id === id);
      if (!conflict) return;
      const local = conflict.local?.data ? conflict.local : { data: conflict.local || {} };
      const server = conflict.server?.data ? conflict.server : { data: conflict.server || {} };
      showDialog(dialog, `<div class="contact-dialog-head"><h2>${esc(l.conflict)}</h2><button class="contact-dialog-close" type="button" data-contact-action="close" aria-label="${esc(l.close)}">×</button></div><p class="contact-dialog-intro">${esc(l.conflictHint)}</p><div class="contact-conflict-grid">${[[l.yourVersion, local], [l.serverVersion, server]].map(([title, item]) => `<section><h3>${esc(title)}</h3><strong>${esc(item.data.name || item.data.company)}</strong><p>${esc(item.data.fair)}</p><p>${esc(item.data.email)}</p><p>${esc(item.data.notes)}</p></section>`).join('')}</div><div class="contact-dialog-footer contact-card-actions"><button class="button primary" type="button" data-contact-action="resolve-local" data-id="${esc(id)}">${esc(l.keepLocal)}</button><button class="button secondary" type="button" data-contact-action="resolve-server" data-id="${esc(id)}">${esc(l.keepServer)}</button></div>`);
    }
    if (['resolve-local', 'resolve-server'].includes(action)) {
      button.disabled = true;
      try { await store.resolveConflict(id, action === 'resolve-local' ? 'local' : 'server'); if (!disposed) { dialog.close(); refresh(); void store.sync().catch(() => {}); } }
      catch (error) { if (!disposed) { notify(error.message, true); button.disabled = false; } }
    }
  }
  function onFilter(event) {
    if (event.target.matches('[data-contact-search]')) query = event.target.value.trim().toLocaleLowerCase();
    if (event.target.matches('[data-contact-fair]')) currentFair = event.target.value;
    refresh();
  }
  fill();
  const unsubscribe = store.subscribe ? store.subscribe(refresh) : () => {};
  refresh();
  store.getDraft().then(draft => { if (!disposed && !formEdited && draft) fill(draft.data || draft, draft.editingId || null); }).catch(() => {});
  form.addEventListener('submit', onSubmit);
  form.addEventListener('input', changed); form.addEventListener('change', changed);
  page.addEventListener('click', onClick);
  page.querySelector('[data-contact-search]').addEventListener('input', onFilter);
  page.querySelector('[data-contact-fair]').addEventListener('change', onFilter);
  const onConnectivity = () => refresh();
  window.addEventListener('online', onConnectivity); window.addEventListener('offline', onConnectivity);
  return () => {
    clearTimeout(draftTimer);
    if (formEdited && !saving) void store.saveDraft({ data: formData(), editingId }).catch(() => {});
    disposed = true; unsubscribe();
    form.removeEventListener('submit', onSubmit); form.removeEventListener('input', changed); form.removeEventListener('change', changed); page.removeEventListener('click', onClick);
    window.removeEventListener('online', onConnectivity); window.removeEventListener('offline', onConnectivity);
    if (dialog.open) dialog.close();
  };
}

export function renderAdminContactsPage(language = 'de') {
  const l = labels(language);
  return `<section class="contacts-admin" data-admin-contacts-page><div class="admin-heading"><div><h1>${esc(l.title)}</h1><p>${esc(l.adminIntro)}</p></div><a class="button primary" href="${CONTACTS_ROUTE}">${icon('plus')} ${esc(l.capture)}</a></div><div class="contact-admin-toolbar"><div class="contact-admin-stat"><strong data-contact-admin-total>—</strong><span>${esc(l.total)}</span></div><div class="contact-export-actions"><button class="button secondary" type="button" data-admin-contact-action="export" disabled>${icon('file-text')} ${esc(l.export)}</button><button class="button secondary" type="button" data-admin-contact-action="export-selected" disabled>${esc(l.exportSelected)} <span data-contact-selected-count></span></button></div></div><form class="contact-admin-filters" data-contact-admin-filters><label class="field contact-admin-search"><span>${esc(l.search)}</span><input type="search" name="q" placeholder="${esc(l.search)}"></label><label class="field"><span>${esc(l.fair)}</span><select name="fair"><option value="">${esc(l.allFairs)}</option></select></label><label class="field"><span>${esc(l.year)}</span><select name="year"><option value="">${esc(l.allYears)}</option></select></label><label class="field"><span>${esc(l.status)}</span><select name="status">${options([['', l.allStatus], ...statuses(l)])}</select></label><label class="field"><span>${esc(l.priority)}</span><select name="priority">${options([['', l.allPriority], ...priorities(l)])}</select></label><label class="field"><span>${esc(l.seller)}</span><select name="ownerId"><option value="">${esc(l.allOwners)}</option></select></label></form><p class="contact-admin-hint">${esc(l.serverOnly)} ${esc(l.exportHint)}</p><div data-contact-admin-results><div class="empty-state">${esc(l.loading)}</div></div><dialog class="contact-dialog" data-contact-dialog></dialog></section>`;
}

export function mountAdminContactsPage(container, { language = 'de', user, api, notify = () => {} } = {}) {
  const page = container.matches?.('[data-admin-contacts-page]') ? container : container.querySelector('[data-admin-contacts-page]');
  if (!page || user?.role !== 'admin') return () => {};
  const l = labels(language), filters = page.querySelector('[data-contact-admin-filters]'), dialog = page.querySelector('[data-contact-dialog]');
  let disposed = false, contacts = [], selected = new Set(), timer, sequence = 0, loading = false, exporting = false, exportController = null;
  const query = () => new URLSearchParams([...new FormData(filters)].filter(([, value]) => value !== ''));
  function updateActions() {
    page.querySelector('[data-admin-contact-action="export"]').disabled = loading || exporting || !contacts.length;
    page.querySelector('[data-admin-contact-action="export-selected"]').disabled = loading || exporting || !selected.size;
    page.querySelector('[data-contact-selected-count]').textContent = selected.size ? `(${selected.size})` : '';
  }
  function renderResults() {
    page.querySelector('[data-contact-admin-total]').textContent = contacts.length;
    const allSelected = contacts.length > 0 && contacts.every(contact => selected.has(contact.id));
    page.querySelector('[data-contact-admin-results]').innerHTML = contacts.length ? `<div class="contact-table-wrap"><table class="contact-table"><thead><tr><th><input type="checkbox" data-contact-select-all aria-label="${esc(l.selectAll)}"${allSelected ? ' checked' : ''}></th><th>${esc(l.contact)}</th><th>${esc(l.fair)}</th><th>${esc(l.seller)}</th><th>${esc(l.status)}</th><th>${esc(l.date)}</th><th>${esc(l.details)}</th></tr></thead><tbody>${contacts.map(record => `<tr><td><input type="checkbox" data-contact-select="${esc(record.id)}" aria-label="${esc(l.select)}: ${esc(record.data.name || record.data.company)}"${selected.has(record.id) ? ' checked' : ''}></td><td><strong>${esc(record.data.name || record.data.company)}</strong>${record.data.company && record.data.name ? `<small>${esc(record.data.company)}</small>` : ''}<small>${esc(record.data.email || [record.data.postalCode, record.data.city].filter(Boolean).join(' '))}</small></td><td>${esc(record.data.fair)}<small>${esc(record.data.fairYear)}</small></td><td>${esc(record.ownerName)}</td><td><span class="contact-status contact-work-${esc(record.data.status)}">${esc(new Map(statuses(l)).get(record.data.status) || l.statusNew)}</span>${record.data.priority === 'high' ? `<small class="contact-priority-high">${esc(l.high)}</small>` : ''}</td><td>${esc(date(record.createdAt, language))}</td><td><button class="button secondary small" type="button" data-admin-contact-action="details" data-id="${esc(record.id)}">${esc(l.details)}</button></td></tr>`).join('')}</tbody></table></div>` : `<div class="contact-empty">${icon('users')}<h2>${esc(l.noResults)}</h2></div>`;
    updateActions();
  }
  async function load() {
    const generation = ++sequence;
    loading = true; updateActions();
    page.querySelector('[data-contact-admin-results]').setAttribute('aria-busy', 'true');
    try {
      const result = await api(`/api/admin/contacts?${query()}`);
      if (disposed || generation !== sequence) return;
      contacts = result.contacts || []; selected = new Set([...selected].filter(id => contacts.some(record => record.id === id)));
      const fairValue = filters.elements.fair.value, yearValue = filters.elements.year.value, ownerValue = filters.elements.ownerId.value;
      const fairs = [...new Set((result.fairs || []).map(item => typeof item === 'string' ? item : item.fair).filter(Boolean))].sort((a, b) => a.localeCompare(b));
      const years = [...new Set((result.fairs || []).map(item => item.year).filter(Boolean).map(String))].sort().reverse();
      filters.elements.fair.innerHTML = options([['', l.allFairs], ...fairs.map(fair => [fair, fair])], fairValue);
      filters.elements.year.innerHTML = options([['', l.allYears], ...years.map(year => [year, year])], yearValue);
      filters.elements.ownerId.innerHTML = options([['', l.allOwners], ...(result.owners || []).map(owner => [owner.id, owner.name || owner.displayName || owner.id])], ownerValue);
      loading = false; renderResults();
    } catch (error) {
      if (disposed || generation !== sequence) return;
      loading = false; contacts = []; selected.clear();
      page.querySelector('[data-contact-admin-total]').textContent = '—';
      page.querySelector('[data-contact-admin-results]').innerHTML = `<div class="contact-empty"><h2>${esc(l.loadError)}</h2><p>${esc(error.message || '')}</p><button class="button secondary" type="button" data-admin-contact-action="reload">${esc(l.retry)}</button></div>`;
      updateActions();
    } finally { if (!disposed && generation === sequence) page.querySelector('[data-contact-admin-results]').removeAttribute('aria-busy'); }
  }
  async function exportCsv(selection) {
    if (exporting || loading) return;
    if (selection && !selected.size) { notify(l.nothingSelected, true); return; }
    if (selection && selected.size > 200) { notify(language === 'en' ? 'For more than 200 contacts, please use the filtered CSV export.' : 'Für mehr als 200 Kontakte bitte den gefilterten CSV-Export nutzen.', true); return; }
    exporting = true; updateActions();
    exportController = new AbortController();
    try {
      const params = query();
      if (selection) params.set('ids', [...selected].join(','));
      const response = await fetch(`/api/admin/contacts/export.csv?${params}`, { credentials: 'same-origin', cache: 'no-store', signal: exportController.signal });
      if (!response.ok) { let payload = {}; try { payload = await response.json(); } catch {} throw new Error(payload.error || l.exportError); }
      const blob = await response.blob();
      if (disposed) return;
      const href = URL.createObjectURL(blob), anchor = document.createElement('a');
      anchor.href = href; anchor.download = `BvL-Messekontakte-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(href), 5000);
    } catch (error) { if (!disposed && error.name !== 'AbortError') notify(error.message || l.exportError, true); }
    finally { exporting = false; exportController = null; if (!disposed) updateActions(); }
  }
  function onInput(event) {
    clearTimeout(timer);
    timer = setTimeout(load, event.target.name === 'q' ? 250 : 0);
  }
  function onChange(event) {
    if (event.target.matches('[data-contact-select-all]')) {
      selected = event.target.checked ? new Set(contacts.map(record => record.id)) : new Set(); renderResults();
    } else if (event.target.matches('[data-contact-select]')) {
      event.target.checked ? selected.add(event.target.dataset.contactSelect) : selected.delete(event.target.dataset.contactSelect); updateActions();
      const all = page.querySelector('[data-contact-select-all]'); if (all) all.checked = contacts.every(record => selected.has(record.id));
    }
  }
  function onClick(event) {
    const button = event.target.closest('[data-admin-contact-action], [data-contact-action="close"]');
    if (!button) return;
    if (button.dataset.contactAction === 'close') { dialog.close(); return; }
    const action = button.dataset.adminContactAction;
    if (action === 'reload') void load();
    if (action === 'export') void exportCsv(false);
    if (action === 'export-selected') void exportCsv(true);
    if (action === 'details') { const record = contacts.find(item => item.id === button.dataset.id); if (record) showDialog(dialog, detailHtml(record, l, language, user)); }
  }
  const preventSubmit = event => event.preventDefault();
  filters.addEventListener('submit', preventSubmit); filters.addEventListener('input', onInput); filters.addEventListener('change', onInput);
  page.addEventListener('click', onClick); page.addEventListener('change', onChange);
  void load();
  return () => { disposed = true; sequence++; clearTimeout(timer); exportController?.abort(); filters.removeEventListener('submit', preventSubmit); filters.removeEventListener('input', onInput); filters.removeEventListener('change', onInput); page.removeEventListener('click', onClick); page.removeEventListener('change', onChange); if (dialog.open) dialog.close(); };
}
