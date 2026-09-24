import { icon, editableIcons } from './icons.js';

const root = document.getElementById('app');
const toastNode = document.getElementById('toast');
const state = {
  user: null, csrf: null, pushEnabled: false, vapidPublicKey: null,
  portal: null, adminLinks: null, adminUsers: null, adminMessages: null, overview: null,
  language: localStorage.getItem('bvl-language') === 'en' ? 'en' : 'de',
  view: 'home', adminTab: 'overview', categoryId: null, messageId: null,
  editLinkId: null, editUserId: null, selectedIcon: 'link-2',
  online: navigator.onLine, installPrompt: null,
  installHelpDismissed: sessionStorage.getItem('bvl-install-help-dismissed') === '1'
};

const labels = {
  de: {
    signIn: 'Anmelden', signInTitle: 'BvL Sales', signInIntro: 'Ihre Werkzeuge und Unterlagen an einem Ort.', username: 'Benutzername', password: 'Passwort',
    contactAdmin: 'Zugang oder Passwort vergessen? Bitte wenden Sie sich an Ihre BvL-Administration.', installTitle: 'Als App auf dem iPhone nutzen', install1: 'In Safari das Teilen-Symbol antippen.', install2: '„Zum Home-Bildschirm“ auswählen.', install3: 'Mit „Hinzufügen“ bestätigen.', dismiss: 'Schließen', install: 'App installieren',
    morning: 'Guten Morgen', day: 'Guten Tag', evening: 'Guten Abend', milkPrice: 'Milchpreis Deutschland', monthlyPrice: 'Monatswert', priceUnavailable: 'Derzeit nicht verfügbar', priceAutoWeekly: 'Automatischer Abruf: wöchentlich', priceUpdated: 'Aktualisiert', priceLastSuccess: 'Letzter erfolgreicher Abruf', priceStale: 'Abruf derzeit nicht möglich', priceNotUpdated: 'Noch nicht aktualisiert', leadTimes: 'Aktuelle Lieferzeiten', towed: 'Gezogene Maschinen', self: 'Selbstfahrer', weeks: 'Wochen', notSet: 'Noch nicht gepflegt', updated: 'Stand',
    tools: 'Vertriebswerkzeuge', items: 'Inhalte', quick: 'Schnellzugriff', open: 'Öffnen', back: 'Zurück', offline: 'Offline – externe Links und aktuelle Daten benötigen Internet.',
    home: 'Start', messages: 'Mitteilungen', profile: 'Profil', admin: 'Administration', overview: 'Übersicht', links: 'Links', users: 'Benutzer', delivery: 'Lieferzeiten', settings: 'Einstellungen', visitors: 'Besucher', visitExplanation: 'Gezählte App-Besuche; nach 30 Minuten Inaktivität beginnt ein neuer Besuch.',
    noMessages: 'Noch keine Mitteilungen vorhanden.', unread: 'Ungelesen', markRead: 'Als gelesen markieren', role: 'Rolle', language: 'Sprache', push: 'Push-Benachrichtigungen', pushIntro: 'Erhalten Sie wichtige BvL-Mitteilungen und wöchentliche Milchpreis-Updates direkt auf diesem Gerät.', pushEnable: 'Push aktivieren', pushDisable: 'Push auf diesem Gerät deaktivieren', pushMissing: 'Push ist noch nicht eingerichtet. In Coolify müssen VAPID-Schlüssel hinterlegt werden.', pushIos: 'Auf dem iPhone funktioniert Push erst nach „Zum Home-Bildschirm“ und dem Öffnen der installierten App.',
    changePassword: 'Passwort ändern', currentPassword: 'Aktuelles Passwort', newPassword: 'Neues Passwort (mindestens 6 Zeichen)', savePassword: 'Passwort speichern', signOut: 'Abmelden', openAdmin: 'Administration öffnen',
    adminIntro: 'Inhalte, Benutzer und aktuelle Informationen verwalten.', activeUsers: 'Aktive Benutzer', allLinks: 'Links & Kategorien', publishedMessages: 'Veröffentlichte Mitteilungen',
    linksIntro: 'Reihenfolge, Sichtbarkeit und Zielseiten pflegen.', newLink: 'Neuer Inhalt', editLink: 'Inhalt bearbeiten', titleDe: 'Bezeichnung (DE)', titleEn: 'Bezeichnung (EN)', descriptionDe: 'Kurztext (DE)', descriptionEn: 'Kurztext (EN)', parent: 'Übergeordnete Kategorie', topLevel: 'Hauptebene', url: 'Ziel-URL (leer = Kategorie)', icon: 'Icon', audience: 'Zielgruppe', staff: 'BvL intern', dealer: 'Händler', active: 'Aktiv', featured: 'Als Schnellzugriff hervorheben', position: 'Reihenfolge', save: 'Speichern', delete: 'Löschen', edit: 'Bearbeiten', cancelled: 'Abbrechen', chooseLink: 'Wählen Sie links einen Inhalt aus oder legen Sie einen neuen an.', statusActive: 'Aktiv', statusInactive: 'Inaktiv', category: 'Kategorie', directLink: 'Direkter Link',
    deliveryIntro: 'Aktuelle Lieferzeiten in Wochen für die Sales App pflegen.', deliveryNote: 'Bearbeitung: Admin oder berechtigte Vertriebs- und Produktionsleitung. Änderungen sind sofort auf allen Geräten sichtbar.', saveDelivery: 'Lieferzeiten speichern',
    usersIntro: 'Zugänge und Berechtigungen sicher verwalten.', newUser: 'Neuer Benutzer', displayName: 'Anzeigename', userClass: 'Nutzerklasse', leadPermission: 'Lieferzeiten bearbeiten', userActive: 'Zugang aktiv', resetPassword: 'Neues Passwort (leer lassen = unverändert)', createPassword: 'Initiales Passwort (mindestens 6 Zeichen)', saveUser: 'Benutzer speichern', chooseUser: 'Wählen Sie einen Benutzer aus oder legen Sie einen neuen an.',
    messagesIntro: 'In-App-Mitteilungen verfassen und auf Wunsch per Push veröffentlichen.', newMessage: 'Neue Mitteilung', subjectDe: 'Titel (DE)', subjectEn: 'Titel (EN)', bodyDe: 'Text (DE)', bodyEn: 'Text (EN)', all: 'Alle', selected: 'Ausgewählte Benutzer', recipients: 'Empfänger', draft: 'Entwurf speichern', publish: 'Veröffentlichen & Push senden', publishDraft: 'Entwurf veröffentlichen', published: 'Veröffentlicht', noAdminMessages: 'Noch keine Mitteilungen.',
    saved: 'Gespeichert.', deleted: 'Gelöscht.', publishedToast: 'Mitteilung veröffentlicht.', loginFailed: 'Anmeldung fehlgeschlagen.', offlineLogin: 'Ohne Internet ist keine neue Anmeldung möglich.'
  },
  en: {
    signIn: 'Sign in', signInTitle: 'BvL Sales', signInIntro: 'Your tools and documents in one place.', username: 'Username', password: 'Password',
    contactAdmin: 'Need access or forgot your password? Please contact your BvL administrator.', installTitle: 'Use as an app on iPhone', install1: 'Tap Share in Safari.', install2: 'Choose “Add to Home Screen”.', install3: 'Confirm with “Add”.', dismiss: 'Dismiss', install: 'Install app',
    morning: 'Good morning', day: 'Good afternoon', evening: 'Good evening', milkPrice: 'German milk price', monthlyPrice: 'Monthly price', priceUnavailable: 'Currently unavailable', priceAutoWeekly: 'Automatic check: weekly', priceUpdated: 'Updated', priceLastSuccess: 'Last successful check', priceStale: 'Source currently unavailable', priceNotUpdated: 'Not updated yet', leadTimes: 'Current lead times', towed: 'Trailed machines', self: 'Self-propelled', weeks: 'weeks', notSet: 'Not set yet', updated: 'Updated',
    tools: 'Sales tools', items: 'items', quick: 'Quick access', open: 'Open', back: 'Back', offline: 'Offline – external links and current data need internet.',
    home: 'Home', messages: 'Messages', profile: 'Profile', admin: 'Administration', overview: 'Overview', links: 'Links', users: 'Users', delivery: 'Lead times', settings: 'Settings', visitors: 'Visitors', visitExplanation: 'Counted app visits; a new visit begins after 30 minutes of inactivity.',
    noMessages: 'No messages yet.', unread: 'Unread', markRead: 'Mark as read', role: 'Role', language: 'Language', push: 'Push notifications', pushIntro: 'Receive BvL messages and weekly milk-price updates directly on this device.', pushEnable: 'Enable push', pushDisable: 'Disable push on this device', pushMissing: 'Push is not configured yet. VAPID keys must be added in Coolify.', pushIos: 'On iPhone, push requires adding the app to the Home Screen and opening the installed app.',
    changePassword: 'Change password', currentPassword: 'Current password', newPassword: 'New password (at least 6 characters)', savePassword: 'Save password', signOut: 'Sign out', openAdmin: 'Open administration',
    adminIntro: 'Manage content, users and current information.', activeUsers: 'Active users', allLinks: 'Links & categories', publishedMessages: 'Published messages',
    linksIntro: 'Manage order, visibility and destinations.', newLink: 'New content', editLink: 'Edit content', titleDe: 'Label (DE)', titleEn: 'Label (EN)', descriptionDe: 'Short text (DE)', descriptionEn: 'Short text (EN)', parent: 'Parent category', topLevel: 'Top level', url: 'Target URL (empty = category)', icon: 'Icon', audience: 'Audience', staff: 'BvL staff', dealer: 'Dealers', active: 'Active', featured: 'Highlight as quick access', position: 'Order', save: 'Save', delete: 'Delete', edit: 'Edit', cancelled: 'Cancel', chooseLink: 'Select content on the left or create a new item.', statusActive: 'Active', statusInactive: 'Inactive', category: 'Category', directLink: 'Direct link',
    deliveryIntro: 'Manage current delivery estimates in weeks for the sales app.', deliveryNote: 'Editable by admins and authorized sales or production managers. Changes appear on all devices immediately.', saveDelivery: 'Save lead times',
    usersIntro: 'Manage accounts and permissions securely.', newUser: 'New user', displayName: 'Display name', userClass: 'User class', leadPermission: 'Edit lead times', userActive: 'Account active', resetPassword: 'New password (leave empty to keep current)', createPassword: 'Initial password (at least 6 characters)', saveUser: 'Save user', chooseUser: 'Select a user or create a new one.',
    messagesIntro: 'Write in-app messages and optionally publish with push.', newMessage: 'New message', subjectDe: 'Title (DE)', subjectEn: 'Title (EN)', bodyDe: 'Text (DE)', bodyEn: 'Text (EN)', all: 'All', selected: 'Selected users', recipients: 'Recipients', draft: 'Save draft', publish: 'Publish & send push', publishDraft: 'Publish draft', published: 'Published', noAdminMessages: 'No messages yet.',
    saved: 'Saved.', deleted: 'Deleted.', publishedToast: 'Message published.', loginFailed: 'Sign-in failed.', offlineLogin: 'You cannot sign in offline.'
  }
};

const t = key => labels[state.language][key] || key;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const text = item => state.language === 'en' ? item.titleEn || item.titleDe : item.titleDe;
const desc = item => state.language === 'en' ? item.descriptionEn || item.descriptionDe : item.descriptionDe;
const localDate = iso => iso ? new Intl.DateTimeFormat(state.language === 'en' ? 'en-GB' : 'de-DE', { dateStyle: 'medium' }).format(new Date(iso)) : '';
const formatWeeks = value => value == null ? '—' : `${value} ${state.language === 'de' && value === 1 ? 'Woche' : state.language === 'en' && value === 1 ? 'week' : t('weeks')}`;
const initials = name => (name || '').trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('');
const greeting = () => { const hour = new Date().getHours(); return t(hour < 11 ? 'morning' : hour < 18 ? 'day' : 'evening'); };
let toastTimer;

function toast(message, error = false) {
  toastNode.textContent = message;
  toastNode.classList.toggle('error', error);
  toastNode.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastNode.hidden = true; }, 4500);
}

async function api(path, { method = 'GET', data } = {}) {
  const response = await fetch(path, {
    method, credentials: 'same-origin',
    headers: data === undefined ? {} : { 'Content-Type': 'application/json', ...(state.csrf ? { 'X-CSRF-Token': state.csrf } : {}) },
    body: data === undefined ? undefined : JSON.stringify(data),
    cache: 'no-store'
  });
  let payload = {};
  try { payload = await response.json(); } catch { /* A network/proxy error may not be JSON. */ }
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
}

function languageSwitch() {
  return `<div class="language-switch" role="group" aria-label="${esc(t('language'))}">
    <button type="button" data-action="language" data-value="de" aria-pressed="${state.language === 'de'}">DE</button>
    <button type="button" data-action="language" data-value="en" aria-pressed="${state.language === 'en'}">EN</button>
  </div>`;
}

function installGuide() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (standalone || state.installHelpDismissed || !ios) return '';
  return `<div class="install-help">
    <div class="install-help-head"><strong>${icon('phone')} ${esc(t('installTitle'))}</strong><button class="text-button" type="button" data-action="dismiss-install">${esc(t('dismiss'))}</button></div>
    <ol><li>${esc(t('install1'))}</li><li>${esc(t('install2'))}</li><li>${esc(t('install3'))}</li></ol>
  </div>`;
}

function renderLogin() {
  return `<main class="auth-shell"><section class="auth-card" aria-label="${esc(t('signIn'))}">
    <div class="auth-top"><img class="auth-logo" src="/bvl-logo.svg" alt="BvL van Lengerich">${languageSwitch()}</div>
    <div class="auth-intro"><p class="eyebrow">BvL Sales</p><h1>${esc(t('signInTitle'))}</h1><p>${esc(t('signInIntro'))}</p></div>
    <form class="auth-form" data-form="login">
      <label class="field">${esc(t('username'))}<input name="username" autocomplete="username" required></label>
      <label class="field">${esc(t('password'))}<input name="password" type="password" autocomplete="current-password" required></label>
      <button class="button primary" type="submit">${esc(t('signIn'))} ${icon('arrow-up-right')}</button>
    </form>
    <p class="auth-note">${esc(t('contactAdmin'))}</p>
    ${!state.online ? `<p class="form-error">${esc(t('offlineLogin'))}</p>` : ''}
    ${installGuide()}
    ${state.installPrompt ? `<button class="button secondary" type="button" data-action="install-app">${esc(t('install'))}</button>` : ''}
  </section></main>`;
}

function renderTopbar() {
  return `<header class="topbar">
    <a class="brand" href="#/home"><img src="/bvl-logo.svg" alt="BvL van Lengerich"><span>Sales</span></a>
    <div class="top-actions">${renderVisitorCounter()}${languageSwitch()}<button type="button" class="avatar" data-action="go-profile" aria-label="${esc(t('profile'))}">${esc(initials(state.user?.displayName))}</button></div>
  </header>`;
}

function renderBottomNav() {
  if (state.view === 'admin') return '';
  return `<nav class="bottom-nav" aria-label="App-Navigation">
    ${[['home','home','home'],['messages','bell','messages'],['profile','user-round','profile']].map(([view, symbol, label]) =>
      `<button type="button" data-action="navigate" data-value="${view}" class="${state.view === view || state.view === 'category' && view === 'home' ? 'active' : ''}" aria-current="${state.view === view ? 'page' : 'false'}">${icon(symbol)}<span>${esc(t(label))}</span></button>`).join('')}
  </nav>`;
}

function renderMilk() {
  const price = state.portal?.milkPrice;
  const available = price?.status === 'fresh' || price?.status === 'stale';
  const stale = price?.status === 'stale';
  const value = available ? new Intl.NumberFormat(state.language === 'en' ? 'en-GB' : 'de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price.value) : '—';
  const month = available ? new Intl.DateTimeFormat(state.language === 'en' ? 'en-GB' : 'de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${price.period}-01T00:00:00Z`)) : '';
  const updatedAt = price?.fetchedAt ? new Intl.DateTimeFormat(state.language === 'en' ? 'en-GB' : 'de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin'
  }).format(new Date(price.fetchedAt)) : '';
  const updateText = updatedAt
    ? `${t(stale ? 'priceLastSuccess' : 'priceUpdated')}: ${updatedAt}${state.language === 'de' ? ' Uhr' : ''}${stale ? ` · ${t('priceStale')}` : ''}`
    : t('priceNotUpdated');
  return `<div class="milk-strip"><div class="milk-main"><span class="milk-label">${esc(t('milkPrice'))}</span><strong class="milk-value">${available ? `${esc(value)} ct/kg` : esc(t('priceUnavailable'))}</strong></div>
    <div class="milk-meta"><span>${available ? `${esc(t('monthlyPrice'))} · ${esc(month)}` : ''}</span><span>${esc(t('priceAutoWeekly'))}</span></div>
    <p class="milk-updated">${esc(updateText)}</p></div>`;
}

function renderLeadTimes(lead = state.portal?.leadTimes) {
  return `<section class="lead-card" aria-label="${esc(t('leadTimes'))}">
    <h2 class="lead-title">${icon('clock-3')} ${esc(t('leadTimes'))}</h2>
    <div class="lead-values"><div><span>${esc(t('towed'))}</span><strong>${esc(formatWeeks(lead?.towedWeeks))}</strong></div><div><span>${esc(t('self'))}</span><strong>${esc(formatWeeks(lead?.selfWeeks))}</strong></div></div>
    ${lead?.updatedAt ? `<p class="lead-updated">${esc(t('updated'))}: ${esc(localDate(lead.updatedAt))}</p>` : `<p class="lead-updated">${esc(t('notSet'))}</p>`}
  </section>`;
}

function renderTool(link, childCount) {
  const isCategory = !link.url;
  const className = `tool-card${link.featured ? ' featured' : ''}`;
  const inner = `<span class="tile-icon">${icon(link.icon)}</span><span class="tile-copy">${link.featured ? `<span class="tile-kicker">${esc(t('quick'))}</span>` : ''}<span class="tile-title">${esc(text(link))}</span>
    <span class="tile-meta">${esc(desc(link) || (isCategory ? `${childCount} ${t('items')}` : t('open')))} ${icon(isCategory ? 'chevron-right' : 'external-link')}</span></span>${link.featured ? `<span class="tile-arrow">${icon('arrow-up-right')}</span>` : ''}`;
  return isCategory
    ? `<button type="button" class="${className}" data-action="open-category" data-id="${esc(link.id)}">${inner}</button>`
    : `<a class="${className}" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${inner}</a>`;
}

function renderHome() {
  if (!state.portal) return `<main class="main-content"><p>${esc(t('tools'))} …</p></main>`;
  const all = state.portal.links;
  const top = all.filter(link => !link.parentId).sort((a,b) => a.position - b.position);
  return `<main class="main-content">
    <div class="welcome"><p class="eyebrow">${esc(greeting())}</p><h1 class="page-title">${esc(state.user.displayName.split(' ')[0])}</h1></div>
    <div class="insights">${renderMilk()}${renderLeadTimes()}</div>
    <div class="section-header"><h2 class="section-title">${esc(t('tools'))}</h2><small>${top.length} ${esc(t('items'))}</small></div>
    ${top.length ? `<div class="tool-grid">${top.map(link => renderTool(link, all.filter(child => child.parentId === link.id).length)).join('')}</div>` : `<div class="empty-state">${esc(t('notSet'))}</div>`}
  </main>`;
}

function renderCategory() {
  const all = state.portal?.links || [];
  const category = all.find(link => link.id === state.categoryId);
  if (!category) return `<main class="main-content"><button class="button secondary" type="button" data-action="navigate" data-value="home">${icon('arrow-left')} ${esc(t('back'))}</button></main>`;
  const children = all.filter(link => link.parentId === category.id).sort((a,b) => a.position - b.position);
  const parentUrl = category.parentId ? `#/category/${encodeURIComponent(category.parentId)}` : '#/home';
  return `<main class="main-content content-narrow"><div class="category-header"><a class="button secondary back" href="${parentUrl}">${icon('arrow-left')} ${esc(t('back'))}</a><div><p class="eyebrow">${esc(t('tools'))}</p><h1 class="page-title">${esc(text(category))}</h1></div></div>
    ${desc(category) ? `<p class="page-intro">${esc(desc(category))}</p>` : ''}
    <div class="category-links">${children.length ? children.map(link => {
      const nested = !link.url;
      const inner = `<span class="row-icon">${icon(link.icon)}</span><span><strong>${esc(text(link))}</strong>${desc(link) ? `<small>${esc(desc(link))}</small>` : ''}</span>${icon(nested ? 'chevron-right' : 'external-link')}`;
      return nested ? `<button class="category-row" type="button" data-action="open-category" data-id="${esc(link.id)}">${inner}</button>` : `<a class="category-row" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${inner}</a>`;
    }).join('') : `<div class="empty-state">${esc(t('notSet'))}</div>`}</div></main>`;
}

function renderMessages() {
  const messages = state.portal?.messages || [];
  const selected = state.messageId ? messages.find(message => message.id === state.messageId) : null;
  if (selected) return `<main class="main-content content-narrow"><div class="category-header"><a class="button secondary" href="#/messages">${icon('arrow-left')} ${esc(t('back'))}</a></div>
    <article class="message-detail"><p class="eyebrow">${esc(localDate(selected.publishedAt))}</p><h1 class="page-title">${esc(text(selected))}</h1><p>${esc(state.language === 'en' ? selected.bodyEn : selected.bodyDe)}</p></article></main>`;
  return `<main class="main-content content-narrow"><h1 class="page-title">${esc(t('messages'))}</h1><p class="page-intro">${esc(t('messagesIntro'))}</p>
    <div class="message-list">${messages.length ? messages.map(message => `<button class="message-card ${message.readAt ? '' : 'unread'}" type="button" data-action="open-message" data-id="${esc(message.id)}"><small>${esc(localDate(message.publishedAt))}${message.readAt ? '' : ` · ${esc(t('unread'))}`}</small><h3>${esc(text(message))}</h3><p>${esc((state.language === 'en' ? message.bodyEn : message.bodyDe).slice(0, 135))}</p></button>`).join('') : `<div class="empty-state">${esc(t('noMessages'))}</div>`}</div>
  </main>`;
}

function renderProfile() {
  const user = state.user;
  const canAdmin = user.role === 'admin' || user.canEditLeadTimes;
  return `<main class="main-content content-narrow"><h1 class="page-title">${esc(t('profile'))}</h1><p class="page-intro">${esc(user.displayName)} · ${esc(user.role)}</p>
    <div class="profile-grid">
      <section class="profile-panel"><h2>${esc(t('language'))}</h2>${languageSwitch()}</section>
      <section class="profile-panel"><h2>${esc(t('push'))}</h2><p>${esc(t('pushIntro'))}</p>
        ${!state.pushEnabled ? `<p>${esc(t('pushMissing'))}</p>` : `<div class="form-actions"><button class="button primary" type="button" data-action="push-enable">${icon('bell')} ${esc(t('pushEnable'))}</button><button class="button secondary" type="button" data-action="push-disable">${esc(t('pushDisable'))}</button></div><p>${esc(t('pushIos'))}</p>`}
      </section>
      <section class="profile-panel"><h2>${esc(t('changePassword'))}</h2><form data-form="password" class="form-grid"><label class="field">${esc(t('currentPassword'))}<input name="currentPassword" type="password" autocomplete="current-password" required></label><label class="field">${esc(t('newPassword'))}<input name="newPassword" type="password" minlength="6" autocomplete="new-password" required></label><div class="span-2"><button class="button secondary" type="submit">${esc(t('savePassword'))}</button></div></form></section>
      ${canAdmin ? `<section class="profile-panel"><h2>${esc(t('admin'))}</h2><a class="button secondary" href="#/admin/${user.role === 'admin' ? 'overview' : 'delivery'}">${icon('settings')} ${esc(t('openAdmin'))}</a></section>` : ''}
      ${installGuide() ? `<section class="profile-panel">${installGuide()}</section>` : ''}
      <button class="button secondary" type="button" data-action="logout">${icon('log-out')} ${esc(t('signOut'))}</button>
    </div></main>`;
}

function adminNav() {
  const tabs = state.user.role === 'admin'
    ? [['overview','home'],['links','link-2'],['delivery','clock-3'],['users','users'],['messages','bell']]
    : [['delivery','clock-3']];
  return `<aside class="admin-sidebar"><nav class="admin-nav" aria-label="${esc(t('admin'))}">${tabs.map(([tab, symbol]) =>
    `<button type="button" data-action="admin-tab" data-value="${tab}" class="${state.adminTab === tab ? 'active' : ''}" aria-current="${state.adminTab === tab ? 'page' : 'false'}">${icon(symbol)}<span>${esc(t(tab))}</span></button>`).join('')}</nav></aside>`;
}

function adminHeading(title, intro, action = '') {
  return `<div class="admin-heading"><div><h1>${esc(title)}</h1><p>${esc(intro)}</p></div>${action}</div>`;
}

function renderOverview() {
  const data = state.overview;
  return `${adminHeading(t('overview'), t('adminIntro'))}
    ${data ? `<div class="admin-cards"><div class="metric-card">${icon('users')}<strong>${data.users}</strong><span>${esc(t('activeUsers'))}</span></div><div class="metric-card">${icon('link-2')}<strong>${data.links}</strong><span>${esc(t('allLinks'))}</span></div><div class="metric-card">${icon('bell')}<strong>${data.messages}</strong><span>${esc(t('publishedMessages'))}</span></div></div>` : `<div class="empty-state">…</div>`}`;
}

function renderLinkEditor() {
  const link = state.adminLinks?.find(item => item.id === state.editLinkId);
  const isNew = state.editLinkId === 'new';
  if (!link && !isNew) return `<aside class="editor-panel"><p class="muted">${esc(t('chooseLink'))}</p></aside>`;
  const selected = link || { titleDe: '', titleEn: '', descriptionDe: '', descriptionEn: '', url: '', parentId: null, icon: 'link-2', audienceStaff: true, audienceDealer: true, active: true, featured: false, position: Math.max(0, ...((state.adminLinks || []).map(item => item.position))) + 10 };
  const parentOptions = (state.adminLinks || []).filter(item => item.id !== link?.id && !item.url).map(item => `<option value="${esc(item.id)}" ${selected.parentId === item.id ? 'selected' : ''}>${esc(text(item))}</option>`).join('');
  return `<aside class="editor-panel"><h2>${esc(isNew ? t('newLink') : t('editLink'))}</h2>
    <form data-form="link"><label class="field">${esc(t('titleDe'))}<input name="titleDe" value="${esc(selected.titleDe)}" required maxlength="100"></label>
    <label class="field">${esc(t('titleEn'))}<input name="titleEn" value="${esc(selected.titleEn)}" required maxlength="100"></label>
    <label class="field">${esc(t('descriptionDe'))}<input name="descriptionDe" value="${esc(selected.descriptionDe)}" maxlength="180"></label>
    <label class="field">${esc(t('descriptionEn'))}<input name="descriptionEn" value="${esc(selected.descriptionEn)}" maxlength="180"></label>
    <label class="field">${esc(t('parent'))}<select name="parentId"><option value="">${esc(t('topLevel'))}</option>${parentOptions}</select></label>
    <label class="field">${esc(t('url'))}<input name="url" type="url" value="${esc(selected.url)}" inputmode="url" maxlength="2000"></label>
    <div class="field"><span>${esc(t('icon'))}</span><div class="icon-picker" role="group" aria-label="${esc(t('icon'))}">${editableIcons.map(symbol => `<button type="button" data-action="choose-icon" data-value="${symbol}" aria-label="${symbol}" aria-pressed="${state.selectedIcon === symbol}">${icon(symbol)}</button>`).join('')}</div></div>
    <label class="field">${esc(t('position'))}<input name="position" type="number" min="0" max="100000" value="${selected.position}" required></label>
    <div><p class="field">${esc(t('audience'))}</p><label class="check-field"><input name="audienceStaff" type="checkbox" ${selected.audienceStaff ? 'checked' : ''}>${esc(t('staff'))}</label><label class="check-field"><input name="audienceDealer" type="checkbox" ${selected.audienceDealer ? 'checked' : ''}>${esc(t('dealer'))}</label></div>
    <label class="check-field"><input name="active" type="checkbox" ${selected.active ? 'checked' : ''}>${esc(t('active'))}</label>
    <label class="check-field"><input name="featured" type="checkbox" ${selected.featured ? 'checked' : ''}>${esc(t('featured'))}</label>
    <div class="form-actions"><button class="button primary" type="submit">${esc(t('save'))}</button>${!isNew ? `<button class="button danger" type="button" data-action="delete-link" data-id="${esc(link.id)}">${esc(t('delete'))}</button>` : ''}</div>
  </form></aside>`;
}

function renderAdminLinks() {
  const items = state.adminLinks || [];
  const ordered = [];
  const visit = (parentId, depth) => {
    items.filter(link => link.parentId === parentId).sort((a, b) => a.position - b.position || a.titleDe.localeCompare(b.titleDe)).forEach(link => {
      ordered.push({ link, depth });
      visit(link.id, depth + 1);
    });
  };
  visit(null, 0);
  return `${adminHeading(t('allLinks'), t('linksIntro'), `<button class="button primary" type="button" data-action="new-link">${icon('plus')} ${esc(t('newLink'))}</button>`)}
    <div class="admin-links-layout"><div class="record-list">${ordered.map(({ link, depth }) => `<div class="record-row depth-${Math.min(depth, 2)} ${state.editLinkId === link.id ? 'selected' : ''}"><span class="record-icon">${icon(link.icon)}</span><span><strong>${esc(text(link))}</strong><small>${esc(link.url ? t('directLink') : t('category'))}</small></span><span class="status ${link.active ? '' : 'inactive'}">${esc(link.active ? t('statusActive') : t('statusInactive'))}</span><span class="record-actions"><button class="button secondary small" type="button" data-action="move-link" data-id="${esc(link.id)}" data-direction="up" aria-label="Move up">↑</button><button class="button secondary small" type="button" data-action="move-link" data-id="${esc(link.id)}" data-direction="down" aria-label="Move down">↓</button><button class="button secondary small" type="button" data-action="edit-link" data-id="${esc(link.id)}">${esc(t('edit'))}</button></span></div>`).join('')}</div>${renderLinkEditor()}</div>`;
}

function renderDelivery() {
  const lead = state.portal?.leadTimes || {};
  return `${adminHeading(t('delivery'), t('deliveryIntro'))}<form data-form="delivery"><div class="delivery-form">
    <div class="delivery-field"><span class="record-icon">${icon('truck')}</span><h2>${esc(t('towed'))}</h2><label class="field">${esc(t('weeks'))}<input name="towedWeeks" type="number" min="1" max="52" step="1" value="${lead.towedWeeks ?? ''}" required></label></div>
    <div class="delivery-field"><span class="record-icon">${icon('settings')}</span><h2>${esc(t('self'))}</h2><label class="field">${esc(t('weeks'))}<input name="selfWeeks" type="number" min="1" max="52" step="1" value="${lead.selfWeeks ?? ''}" required></label></div>
    </div><div class="delivery-actions"><button class="button primary" type="submit">${esc(t('saveDelivery'))}</button>${lead.updatedAt ? `<span class="status-line">${esc(t('updated'))}: ${esc(localDate(lead.updatedAt))}</span>` : ''}</div></form>
    <div class="delivery-note">${icon('shield-check')}<span>${esc(t('deliveryNote'))}</span></div>`;
}

function renderUserEditor() {
  const target = state.adminUsers?.find(item => item.id === state.editUserId);
  const isNew = state.editUserId === 'new';
  if (!target && !isNew) return `<aside class="editor-panel"><p class="muted">${esc(t('chooseUser'))}</p></aside>`;
  const item = target || { username: '', displayName: '', role: 'dealer', canEditLeadTimes: false, active: true };
  return `<aside class="editor-panel"><h2>${esc(isNew ? t('newUser') : item.displayName)}</h2><form data-form="user">
    <label class="field">${esc(t('username'))}<input name="username" value="${esc(item.username)}" ${isNew ? 'required minlength="3"' : 'readonly'} maxlength="80" autocomplete="off"></label>
    <label class="field">${esc(t('displayName'))}<input name="displayName" value="${esc(item.displayName)}" required maxlength="100"></label>
    <label class="field">${esc(t('userClass'))}<select name="role"><option value="admin" ${item.role === 'admin' ? 'selected' : ''}>Admin</option><option value="staff" ${item.role === 'staff' ? 'selected' : ''}>${esc(t('staff'))}</option><option value="dealer" ${item.role === 'dealer' ? 'selected' : ''}>${esc(t('dealer'))}</option></select></label>
    <label class="field">${esc(isNew ? t('createPassword') : t('resetPassword'))}<input name="password" type="password" minlength="6" ${isNew ? 'required' : ''} autocomplete="new-password"></label>
    <label class="check-field"><input name="canEditLeadTimes" type="checkbox" ${item.canEditLeadTimes ? 'checked' : ''}>${esc(t('leadPermission'))}</label>
    ${!isNew ? `<label class="check-field"><input name="active" type="checkbox" ${item.active ? 'checked' : ''}>${esc(t('userActive'))}</label>` : ''}
    <div class="form-actions"><button class="button primary" type="submit">${esc(t('saveUser'))}</button>${!isNew ? `<button class="button danger" type="button" data-action="delete-user" data-id="${esc(item.id)}">${esc(t('delete'))}</button>` : ''}</div>
  </form></aside>`;
}

function renderAdminUsers() {
  const users = state.adminUsers || [];
  return `${adminHeading(t('users'), t('usersIntro'), `<button class="button primary" type="button" data-action="new-user">${icon('plus')} ${esc(t('newUser'))}</button>`)}
    <div class="admin-user-grid"><div class="record-list">${users.map(user => `<div class="record-row ${state.editUserId === user.id ? 'selected' : ''}"><span class="record-icon">${icon('user-round')}</span><span><strong>${esc(user.displayName)}</strong><small>${esc(user.username)} · ${esc(user.role)}</small></span><span class="status ${user.active ? '' : 'inactive'}">${esc(user.active ? t('statusActive') : t('statusInactive'))}</span><span class="record-actions"><button class="button secondary small" type="button" data-action="edit-user" data-id="${esc(user.id)}">${esc(t('edit'))}</button></span></div>`).join('')}</div>${renderUserEditor()}</div>`;
}

function renderAdminMessages() {
  const list = state.adminMessages || [];
  const users = state.adminUsers || [];
  return `${adminHeading(t('messages'), t('messagesIntro'))}<div class="admin-message-grid">
    <div class="record-list">${list.length ? list.map(message => `<div class="record-row"><span class="record-icon">${icon('bell')}</span><span><strong>${esc(text(message))}</strong><small>${esc(localDate(message.createdAt))} · ${esc(message.audience)}</small></span><span class="status ${message.status === 'published' ? '' : 'inactive'}">${esc(message.status === 'published' ? t('published') : t('draft'))}</span><span class="record-actions">${message.status === 'draft' ? `<button class="button secondary small" type="button" data-action="publish-message" data-id="${esc(message.id)}">${esc(t('publishDraft'))}</button>` : ''}</span></div>`).join('') : `<div class="empty-state admin-empty">${esc(t('noAdminMessages'))}</div>`}</div>
    <aside class="editor-panel"><h2>${esc(t('newMessage'))}</h2><form data-form="message">
      <label class="field">${esc(t('subjectDe'))}<input name="titleDe" maxlength="120" required></label>
      <label class="field">${esc(t('subjectEn'))}<input name="titleEn" maxlength="120" required></label>
      <label class="field">${esc(t('bodyDe'))}<textarea name="bodyDe" maxlength="1200" required></textarea></label>
      <label class="field">${esc(t('bodyEn'))}<textarea name="bodyEn" maxlength="1200" required></textarea></label>
      <label class="field">${esc(t('audience'))}<select name="audience" data-audience><option value="all">${esc(t('all'))}</option><option value="staff">${esc(t('staff'))}</option><option value="dealer">${esc(t('dealer'))}</option><option value="selected">${esc(t('selected'))}</option></select></label>
      <div class="target-users" data-target-users hidden><p class="field-help">${esc(t('recipients'))}</p>${users.map(user => `<label class="check-field"><input type="checkbox" name="targetIds" value="${esc(user.id)}">${esc(user.displayName)}</label>`).join('')}</div>
      <div class="form-actions"><button class="button secondary" name="publish" value="false" type="submit">${esc(t('draft'))}</button><button class="button primary" name="publish" value="true" type="submit">${esc(t('publish'))}</button></div>
      ${!state.pushEnabled ? `<p class="field-help">${esc(t('pushMissing'))}</p>` : ''}
    </form></aside></div>`;
}

function renderAdmin() {
  if (state.user.role !== 'admin' && !state.user.canEditLeadTimes) return renderHome();
  const tab = state.user.role === 'admin' ? state.adminTab : 'delivery';
  const content = tab === 'overview' ? renderOverview() : tab === 'links' ? renderAdminLinks() : tab === 'delivery' ? renderDelivery() : tab === 'users' ? renderAdminUsers() : renderAdminMessages();
  return `<div class="admin-layout">${adminNav()}<main class="admin-content">${content}</main></div>`;
}

function renderVisitorCounter() {
  const count = state.portal?.visitorCount;
  if (!Number.isSafeInteger(count) || count < 0) return '';
  return `<div class="visitor-counter" role="status" aria-live="off" aria-label="${esc(t('visitors'))}: ${count}" title="${esc(t('visitExplanation'))}"><span>${esc(t('visitors'))}</span><strong>${String(count).padStart(5, '0')}</strong></div>`;
}

function render() {
  document.documentElement.lang = state.language;
  const offline = !state.online ? `<div class="offline-banner">${icon('wifi-off')} ${esc(t('offline'))}</div>` : '';
  root.innerHTML = state.user
    ? `<div class="app-shell">${offline}${renderTopbar()}${state.view === 'admin' ? renderAdmin() : state.view === 'category' ? renderCategory() : state.view === 'messages' ? renderMessages() : state.view === 'profile' ? renderProfile() : renderHome()}${renderBottomNav()}</div>`
    : `${offline}${renderLogin()}`;
}

function readRoute() {
  const route = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  if (route.startsWith('category/')) { state.view = 'category'; state.categoryId = route.slice(9); }
  else if (route.startsWith('messages/')) { state.view = 'messages'; state.messageId = route.slice(9); }
  else if (route === 'messages') { state.view = 'messages'; state.messageId = null; }
  else if (route === 'profile') state.view = 'profile';
  else if (route.startsWith('admin/')) { state.view = 'admin'; state.adminTab = route.slice(6); }
  else state.view = 'home';
  if (state.view === 'admin' && state.user?.role !== 'admin' && !state.user?.canEditLeadTimes) state.view = 'home';
  if (state.view === 'admin' && state.user?.role !== 'admin') state.adminTab = 'delivery';
  render();
  if (state.view === 'admin') loadAdminTab().catch(error => toast(error.message, true));
}

async function loadPortal() {
  state.portal = await api('/api/portal');
  render();
}

async function loadAdminTab() {
  if (state.user.role !== 'admin' && state.adminTab !== 'delivery') return;
  if (state.adminTab === 'overview') state.overview = await api('/api/admin/overview');
  if (state.adminTab === 'links') {
    state.adminLinks = (await api('/api/admin/links')).links;
    if (!state.editLinkId) state.editLinkId = state.adminLinks[0]?.id || null;
    state.selectedIcon = state.adminLinks.find(item => item.id === state.editLinkId)?.icon || 'link-2';
  }
  if (state.adminTab === 'users') state.adminUsers = (await api('/api/admin/users')).users;
  if (state.adminTab === 'messages') {
    [state.adminMessages, state.adminUsers] = await Promise.all([
      api('/api/admin/messages').then(data => data.messages),
      api('/api/admin/users').then(data => data.users)
    ]);
  }
  render();
}

function formData(form) {
  return new FormData(form);
}

async function submitForm(form, submitter) {
  const values = formData(form);
  const kind = form.dataset.form;
  if (kind === 'login') {
    const result = await api('/api/login', { method: 'POST', data: { username: values.get('username'), password: values.get('password') } });
    state.user = result.user; state.csrf = result.csrfToken; state.pushEnabled = result.pushEnabled; state.vapidPublicKey = result.vapidPublicKey; state.language = result.user.language;
    localStorage.setItem('bvl-language', state.language);
    location.hash = '#/home';
    await loadPortal();
    readRoute();
    return;
  }
  if (kind === 'delivery') {
    const result = await api('/api/admin/lead-times', { method: 'PUT', data: { towedWeeks: Number(values.get('towedWeeks')), selfWeeks: Number(values.get('selfWeeks')) } });
    state.portal.leadTimes = { towedWeeks: result.leadTimes.towed_weeks, selfWeeks: result.leadTimes.self_weeks, updatedAt: result.leadTimes.updated_at };
    toast(t('saved')); render(); return;
  }
  if (kind === 'link') {
    const data = {
      titleDe: values.get('titleDe'), titleEn: values.get('titleEn'), descriptionDe: values.get('descriptionDe'), descriptionEn: values.get('descriptionEn'),
      parentId: values.get('parentId') || null, url: values.get('url'), icon: state.selectedIcon, position: Number(values.get('position')),
      audienceStaff: values.has('audienceStaff'), audienceDealer: values.has('audienceDealer'), active: values.has('active'), featured: values.has('featured')
    };
    const created = state.editLinkId === 'new';
    const result = await api(created ? '/api/admin/links' : `/api/admin/links/${encodeURIComponent(state.editLinkId)}`, { method: created ? 'POST' : 'PUT', data });
    state.editLinkId = result.link.id;
    await Promise.all([loadPortal(), loadAdminTab()]);
    toast(t('saved')); return;
  }
  if (kind === 'user') {
    const data = { username: values.get('username'), displayName: values.get('displayName'), role: values.get('role'), canEditLeadTimes: values.has('canEditLeadTimes'), active: values.has('active') || state.editUserId === 'new' };
    if (values.get('password')) data.password = values.get('password');
    const created = state.editUserId === 'new';
    const result = await api(created ? '/api/admin/users' : `/api/admin/users/${encodeURIComponent(state.editUserId)}`, { method: created ? 'POST' : 'PUT', data });
    state.editUserId = result.user.id;
    await loadAdminTab(); toast(t('saved')); return;
  }
  if (kind === 'message') {
    const data = { titleDe: values.get('titleDe'), titleEn: values.get('titleEn'), bodyDe: values.get('bodyDe'), bodyEn: values.get('bodyEn'), audience: values.get('audience'), targetIds: values.getAll('targetIds'), publish: submitter?.value === 'true' };
    const result = await api('/api/admin/messages', { method: 'POST', data });
    await Promise.all([loadPortal(), loadAdminTab()]);
    toast(data.publish ? `${t('publishedToast')}${result.push?.configured ? ` Push: ${result.push.sent}` : ''}` : t('saved'));
    return;
  }
  if (kind === 'password') {
    await api('/api/profile/password', { method: 'POST', data: { currentPassword: values.get('currentPassword'), newPassword: values.get('newPassword') } });
    form.reset(); toast(t('saved'));
  }
}

async function changeLanguage(language) {
  if (!['de', 'en'].includes(language)) return;
  if (state.user) {
    const result = await api('/api/profile', { method: 'PATCH', data: { language } });
    state.user = result.user;
  }
  state.language = language;
  localStorage.setItem('bvl-language', language);
  render();
}

function urlBase64ToBytes(value) {
  const padded = value + '='.repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(padded.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
}

async function enablePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !state.pushEnabled) throw new Error(t('pushMissing'));
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Benachrichtigungen wurden nicht erlaubt.');
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(state.vapidPublicKey) });
  await api('/api/push-subscriptions', { method: 'POST', data: subscription.toJSON() });
  toast(t('saved'));
}

async function disablePush() {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await api('/api/push-subscriptions', { method: 'DELETE', data: { endpoint: subscription.endpoint } });
    await subscription.unsubscribe();
  }
  toast(t('saved'));
}

async function moveLink(id, direction) {
  const item = state.adminLinks.find(link => link.id === id);
  const siblings = state.adminLinks.filter(link => link.parentId === item.parentId).sort((a,b) => a.position - b.position);
  const index = siblings.findIndex(link => link.id === id);
  const target = index + (direction === 'up' ? -1 : 1);
  if (target < 0 || target >= siblings.length) return;
  siblings.splice(index, 1);
  siblings.splice(target, 0, item);
  for (let i = 0; i < siblings.length; i++) {
    const position = (i + 1) * 10;
    if (siblings[i].position !== position) {
      await api(`/api/admin/links/${encodeURIComponent(siblings[i].id)}`, { method: 'PUT', data: { ...siblings[i], position } });
    }
  }
  await Promise.all([loadAdminTab(), loadPortal()]);
}

root.addEventListener('submit', async event => {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  const submitter = event.submitter;
  const button = submitter || form.querySelector('[type="submit"]');
  if (button) button.disabled = true;
  try { await submitForm(form, submitter); } catch (error) { toast(error.message, true); }
  finally { if (button?.isConnected) button.disabled = false; }
});

root.addEventListener('change', event => {
  if (event.target.matches('[data-audience]')) root.querySelector('[data-target-users]').hidden = event.target.value !== 'selected';
});

root.addEventListener('click', async event => {
  const control = event.target.closest('[data-action]');
  if (!control) return;
  const { action, value, id, direction } = control.dataset;
  try {
    if (action === 'language') await changeLanguage(value);
    if (action === 'dismiss-install') { state.installHelpDismissed = true; sessionStorage.setItem('bvl-install-help-dismissed', '1'); render(); }
    if (action === 'install-app' && state.installPrompt) { await state.installPrompt.prompt(); state.installPrompt = null; render(); }
    if (action === 'navigate') location.hash = `#/${value}`;
    if (action === 'go-profile') location.hash = '#/profile';
    if (action === 'open-category') location.hash = `#/category/${encodeURIComponent(id)}`;
    if (action === 'open-message') {
      await api(`/api/messages/${encodeURIComponent(id)}/read`, { method: 'POST', data: {} });
      const message = state.portal.messages.find(item => item.id === id); if (message) message.readAt = new Date().toISOString();
      location.hash = `#/messages/${encodeURIComponent(id)}`;
    }
    if (action === 'logout') {
      await api('/api/logout', { method: 'POST', data: {} });
      state.user = null; state.csrf = null; state.portal = null;
      location.hash = '#/home'; render();
    }
    if (action === 'admin-tab') location.hash = `#/admin/${value}`;
    if (action === 'new-link') { state.editLinkId = 'new'; state.selectedIcon = 'link-2'; render(); }
    if (action === 'edit-link') { state.editLinkId = id; state.selectedIcon = state.adminLinks.find(item => item.id === id)?.icon || 'link-2'; render(); }
    if (action === 'choose-icon') {
      state.selectedIcon = value;
      root.querySelectorAll('[data-action="choose-icon"]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.value === value)));
    }
    if (action === 'move-link') await moveLink(id, direction);
    if (action === 'delete-link' && confirm(`${t('delete')}: ${state.adminLinks.find(item => item.id === id)?.titleDe}?`)) {
      await api(`/api/admin/links/${encodeURIComponent(id)}`, { method: 'DELETE', data: {} });
      state.editLinkId = null; await Promise.all([loadPortal(), loadAdminTab()]); toast(t('deleted'));
    }
    if (action === 'new-user') { state.editUserId = 'new'; render(); }
    if (action === 'edit-user') { state.editUserId = id; render(); }
    if (action === 'delete-user' && confirm(`${t('delete')}: ${state.adminUsers.find(item => item.id === id)?.displayName}?`)) {
      await api(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE', data: {} });
      state.editUserId = null; await loadAdminTab(); toast(t('deleted'));
    }
    if (action === 'publish-message' && confirm(t('publishDraft') + '?')) {
      const result = await api(`/api/admin/messages/${encodeURIComponent(id)}/publish`, { method: 'POST', data: {} });
      await Promise.all([loadPortal(), loadAdminTab()]);
      toast(`${t('publishedToast')}${result.push?.configured ? ` Push: ${result.push.sent}` : ''}`);
    }
    if (action === 'push-enable') await enablePush();
    if (action === 'push-disable') await disablePush();
  } catch (error) { toast(error.message, true); }
});

window.addEventListener('hashchange', () => { readRoute(); if (state.user && state.online) loadPortal().catch(() => {}); });
window.addEventListener('online', () => { state.online = true; render(); if (state.user) loadPortal().catch(() => {}); });
window.addEventListener('offline', () => { state.online = false; render(); });
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); state.installPrompt = event; render(); });
let lastReturnRefresh = 0;
function refreshOnReturn() {
  if (!state.user || !state.online || Date.now() - lastReturnRefresh < 5000) return;
  lastReturnRefresh = Date.now();
  loadPortal().catch(() => {});
}
window.addEventListener('focus', refreshOnReturn);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshOnReturn(); });

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(error => console.warn('Service worker:', error));
}

async function init() {
  try {
    const result = await api('/api/session');
    state.user = result.user; state.csrf = result.csrfToken; state.pushEnabled = result.pushEnabled; state.vapidPublicKey = result.vapidPublicKey;
    state.language = result.user.language;
    localStorage.setItem('bvl-language', state.language);
    await loadPortal();
  } catch { /* No session is a normal first-visit state. */ }
  readRoute();
}

render();
init();
