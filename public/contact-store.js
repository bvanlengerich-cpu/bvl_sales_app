// Offline contacts are scoped to one signed-in Sales App account. The server
// remains authoritative; IndexedDB holds drafts and an unsent mutation queue.
const DATABASE_VERSION = 3;

const clone = value => structuredClone(value);
const timestamp = () => new Date().toISOString();
const uuid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const communicationFields = ['thanksOpenedAt', 'thanksSentAt', 'forwardOpenedAt', 'forwardedAt'];
const communication = (...sources) => Object.fromEntries(communicationFields.map(key => [key, sources.map(source => source?.[key]).find(Boolean) || null]));
const photoIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const photoMetadata = photo => ({ id: photo.id, bytes: photo.bytes || photo.blob?.size || 0, width: photo.width || 0, height: photo.height || 0, createdAt: photo.createdAt || null });

function transaction(db, stores, mode, schedule) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let result, failure;
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(failure || tx.error || new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(failure || tx.error || new Error('IndexedDB transaction aborted'));
    try {
      schedule(tx, value => { result = value; }, error => { failure = error; tx.abort(); });
    } catch (error) {
      try { tx.abort(); } catch { /* The transaction may already be closed. */ }
      reject(error);
    }
  });
}

function openDatabase(userId) {
  if (!globalThis.indexedDB) return Promise.reject(new Error('IndexedDB ist auf diesem Gerät nicht verfügbar.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(`bvl-sales-contacts-v1:${encodeURIComponent(userId)}`, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('contacts')) db.createObjectStore('contacts', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('activity')) db.createObjectStore('activity', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error || new Error('IndexedDB konnte nicht geöffnet werden.'));
    request.onblocked = () => reject(new Error('Lokaler Kontaktspeicher ist in einem anderen Fenster blockiert.'));
  });
}

function readAll(db) {
  return transaction(db, ['contacts', 'queue', 'activity', 'photos'], 'readonly', (tx, done) => {
    const records = tx.objectStore('contacts').getAll();
    const pending = tx.objectStore('queue').getAll();
    const activities = tx.objectStore('activity').getAll();
    const photos = tx.objectStore('photos').getAll();
    const values = {};
    const ready = () => {
      if (values.records && values.pending && values.activities && values.photos) done(values);
    };
    records.onsuccess = () => { values.records = records.result; ready(); };
    pending.onsuccess = () => { values.pending = pending.result; ready(); };
    activities.onsuccess = () => { values.activities = activities.result; ready(); };
    photos.onsuccess = () => { values.photos = photos.result; ready(); };
  });
}

function purgeForeignContacts(db, userId) {
  return transaction(db, ['contacts', 'queue', 'activity', 'photos'], 'readwrite', (tx, done) => {
    const contacts = tx.objectStore('contacts');
    const queue = tx.objectStore('queue');
    const activity = tx.objectStore('activity');
    const request = contacts.getAll();
    request.onsuccess = () => {
      for (const record of request.result) {
        if (record.ownerId === userId) continue;
        contacts.delete(record.id);
        queue.delete(record.id);
      }
      done(null);
    };
    const actions = activity.getAll();
    actions.onsuccess = () => {
      for (const action of actions.result) {
        const owner = contacts.get(action.id);
        owner.onsuccess = () => { if (!owner.result || owner.result.ownerId !== userId || owner.result.deleted) activity.delete(action.key); };
      }
    };
    const images = tx.objectStore('photos').getAll();
    images.onsuccess = () => {
      for (const image of images.result) {
        const owner = contacts.get(image.contactId);
        owner.onsuccess = () => { if (!owner.result || owner.result.ownerId !== userId || owner.result.deleted) tx.objectStore('photos').delete(image.id); };
      }
    };
  });
}

function normalizeRemote(value) {
  if (!value || typeof value !== 'object' || typeof value.id !== 'string' ||
      !Number.isInteger(value.revision) || value.revision < 0 ||
      !value.data || typeof value.data !== 'object' || Array.isArray(value.data)) {
    throw new Error('Ungültiger Kontakt vom Server.');
  }
  return {
    id: value.id,
    revision: value.revision,
    ownerId: value.ownerId || '',
    ownerName: value.ownerName || '',
    createdAt: value.createdAt || value.updatedAt || timestamp(),
    updatedAt: value.updatedAt || timestamp(),
    data: clone(value.data),
    communication: communication(value.communication),
    photos: Array.isArray(value.photos) ? value.photos.map(photoMetadata) : [],
    syncState: 'synced'
  };
}

function remoteFromError(error) {
  const payload = error?.payload;
  const candidate = payload?.contact || payload?.server || payload?.current || payload?.currentContact || payload;
  try { return normalizeRemote(candidate); } catch { return null; }
}

function errorMessage(error) {
  return error?.message || 'Kontakte konnten nicht synchronisiert werden.';
}

/** Create one store per signed-in user. `api` must reject with {status,payload} on HTTP errors. */
export function createContactStore({ user, api, onChange } = {}) {
  const userId = String(user?.id || '');
  if (!userId) throw new Error('Kontakt-Speicher benötigt eine Benutzer-ID.');
  if (typeof api !== 'function') throw new Error('Kontakt-Speicher benötigt eine API-Funktion.');
  const ownerName = String(user.displayName || user.username || '');
  const listeners = new Set();
  let db;
  let initPromise;
  let work = Promise.resolve();
  let syncPromise = null;
  let closed = false;
  let syncing = false;
  let error = null;
  let records = [];
  let pending = [];
  let activities = [];
  let photos = [];
  const deleting = new Set();
  const abort = new AbortController();

  function getState() {
    return {
      contacts: clone(records.filter(record => !record.deleted)),
      pendingCount: new Set([...pending, ...activities, ...photos.filter(photo => photo.pending).map(photo => ({ id: photo.contactId }))].map(item => item.id)).size,
      conflicts: clone(pending.filter(item => item.conflictServer).map(item => ({
        id: item.id,
        local: records.find(record => record.id === item.id) || null,
        server: item.conflictServer
      }))),
      syncing,
      error
    };
  }

  function emit() {
    if (closed) return;
    const snapshot = getState();
    try { onChange?.(snapshot); } catch { /* A view must not break data writes. */ }
    for (const listener of listeners) {
      try { listener(snapshot); } catch { /* A view must not break data writes. */ }
    }
  }

  async function reload() {
    const loaded = await readAll(db);
    if (closed) return;
    records = loaded.records.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    pending = loaded.pending.sort((a, b) => String(a.queuedAt).localeCompare(String(b.queuedAt)));
    activities = loaded.activities.sort((a, b) => String(a.queuedAt).localeCompare(String(b.queuedAt)));
    photos = loaded.photos;
    const pendingIds = new Set([...pending, ...activities, ...photos.filter(photo => photo.pending).map(photo => ({ id: photo.contactId }))].map(item => item.id));
    records = records.map(record => record.deleted ? record : { ...record, photos: photos.filter(photo => photo.contactId === record.id && !photo.removed && photo.pending !== 'delete').map(photoMetadata), communication: communication(record.communication), syncState: pending.some(item => item.id === record.id && item.conflictServer) ? 'conflict' : pendingIds.has(record.id) ? 'pending' : 'synced' });
    emit();
  }

  async function init({ allowClosed = false } = {}) {
    if (closed && !allowClosed) throw new Error('Kontakt-Speicher ist geschlossen.');
    if (!initPromise) initPromise = openDatabase(userId).then(async opened => {
      db = opened;
      await purgeForeignContacts(db, userId);
      await reload();
    });
    await initPromise;
    return getState();
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('Listener muss eine Funktion sein.');
    if (!closed) {
      listeners.add(listener);
      try { listener(getState()); } catch { /* A view must not break data writes. */ }
    }
    return () => listeners.delete(listener);
  }

  // Every IndexedDB mutation and snapshot read is ordered. Network requests
  // happen outside this lane, so editing remains possible during a fetch.
  function enqueue(action, { local = false, refresh = true } = {}) {
    if (closed) return Promise.reject(new Error('Kontakt-Speicher ist geschlossen.'));
    const job = work.then(async () => {
      await init({ allowClosed: local });
      if (closed && !local) return undefined;
      const result = await action();
      if (refresh) await reload();
      return result;
    });
    work = job.catch(() => {});
    return job;
  }

  function save(data, id, desiredPhotos) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return Promise.reject(new TypeError('Kontaktdaten müssen ein Objekt sein.'));
    if (desiredPhotos !== undefined && (!Array.isArray(desiredPhotos) || desiredPhotos.length > 2 ||
        new Set(desiredPhotos.map(photo => photo?.id)).size !== desiredPhotos.length || desiredPhotos.some(photo =>
          !photo || !photoIdPattern.test(photo.id) || (photo.blob !== undefined && (!(photo.blob instanceof Blob) ||
            photo.blob.type !== 'image/jpeg' || photo.blob.size < 1 || photo.blob.size > 250 * 1024))))) {
      return Promise.reject(new TypeError('Bitte höchstens zwei komprimierte JPEG-Fotos mit jeweils maximal 250 KB verwenden.'));
    }
    const contactId = id || uuid();
    if (deleting.has(contactId)) return Promise.reject(new Error('Kontakt wird gerade gelöscht.'));
    const safeData = clone(data);
    const safePhotos = desiredPhotos === undefined ? undefined : clone(desiredPhotos);
    return enqueue(() => transaction(db, ['contacts', 'queue', 'photos'], 'readwrite', (tx, done, fail) => {
      const contactStore = tx.objectStore('contacts');
      const queueStore = tx.objectStore('queue');
      const contactRequest = contactStore.get(contactId);
      contactRequest.onsuccess = () => {
        const existing = contactRequest.result;
        if (existing?.deleted) { fail(new Error('Dieser Kontakt wurde gelöscht.')); return; }
        const queueRequest = queueStore.get(contactId);
        queueRequest.onsuccess = () => {
          const previous = queueRequest.result;
          const time = timestamp();
          const contact = {
            id: contactId,
            revision: existing?.revision || 0,
            ownerId: existing?.ownerId || userId,
            ownerName: existing?.ownerName || ownerName,
            createdAt: existing?.createdAt || time,
            updatedAt: time,
            data: safeData,
            communication: communication(existing?.communication),
            photos: existing?.photos || [],
            syncState: previous?.conflictServer ? 'conflict' : 'pending'
          };
          const mutation = {
            id: contactId,
            baseRevision: previous?.baseRevision ?? existing?.revision ?? 0,
            mutationId: uuid(),
            data: safeData,
            queuedAt: time,
            conflictServer: previous?.conflictServer || null,
            // Keep an already-started POST intact if the user edits again
            // before its acknowledgement arrives.
            inFlight: previous?.inFlight || null
          };
          contactStore.put(contact);
          queueStore.put(mutation);
          if (safePhotos === undefined) { done(contact); return; }
          const imageStore = tx.objectStore('photos');
          const imageRequest = imageStore.getAll();
          imageRequest.onsuccess = () => {
            const existingRows = imageRequest.result.filter(photo => photo.contactId === contactId);
            const known = new Map(imageRequest.result.map(photo => [photo.id, photo]));
            const wanted = new Set(safePhotos.map(photo => photo.id));
            const nextPhotos = [];
            for (const photo of safePhotos) {
              const previousPhoto = known.get(photo.id);
              if (previousPhoto && (previousPhoto.contactId !== contactId || previousPhoto.removed || previousPhoto.pending === 'delete')) {
                fail(new Error('Dieses Foto wurde bereits entfernt. Bitte erneut mit neuer Aufnahme hinzufügen.')); return;
              }
              if (!previousPhoto && !photo.blob) { fail(new Error('Bilddatei fehlt. Bitte das Foto erneut hinzufügen.')); return; }
              const row = previousPhoto || { ...photoMetadata(photo), contactId, blob: photo.blob, createdAt: time, pending: 'put', queuedAt: time, serverKnown: false, inFlight: null };
              if (!row.blob && photo.blob) row.blob = photo.blob;
              imageStore.put(row);
              nextPhotos.push(photoMetadata(row));
            }
            for (const row of existingRows) {
              if (wanted.has(row.id) || row.removed) continue;
              if (!row.serverKnown && !row.inFlight && !row.attempted) imageStore.put({ id: row.id, contactId, removed: true, pending: null });
              else imageStore.put({ ...row, pending: 'delete', queuedAt: time });
            }
            contact.photos = nextPhotos;
            contactStore.put(contact);
            done(contact);
          };
        };
      };
    }), { local: true });
  }

  function recordCommunication(id, kind, state) {
    if (!['thanks', 'forward'].includes(kind) || !['opened', 'sent'].includes(state)) return Promise.reject(new TypeError('Ungültige Mailaktion.'));
    if (deleting.has(id)) return Promise.reject(new Error('Kontakt wird gerade gelöscht.'));
    return enqueue(() => transaction(db, ['contacts', 'activity'], 'readwrite', (tx, done, fail) => {
      const contactStore = tx.objectStore('contacts');
      const request = contactStore.get(id);
      request.onsuccess = () => {
        const record = request.result;
        if (!record || record.deleted || record.ownerId !== userId) { fail(new Error('Kontakt nicht gefunden oder gelöscht.')); return; }
        const field = kind === 'thanks' ? state === 'sent' ? 'thanksSentAt' : 'thanksOpenedAt' : state === 'sent' ? 'forwardedAt' : 'forwardOpenedAt';
        const value = communication(record.communication);
        if (!value[field]) {
          const time = timestamp();
          value[field] = time;
          if (state === 'sent') value[kind === 'thanks' ? 'thanksOpenedAt' : 'forwardOpenedAt'] ||= time;
          tx.objectStore('activity').put({ key: `${id}:${kind}:${state}`, id, kind, state, queuedAt: time });
          contactStore.put({ ...record, communication: value });
        }
        done({ ...record, communication: value });
      };
    }), { local: true });
  }

  function discardContact(id) {
    return enqueue(() => transaction(db, ['contacts', 'queue', 'activity', 'meta', 'photos'], 'readwrite', (tx, done) => {
      tx.objectStore('contacts').put({ id, ownerId: userId, deleted: true });
      tx.objectStore('queue').delete(id);
      const actions = tx.objectStore('activity').getAll();
      actions.onsuccess = () => { for (const action of actions.result) if (action.id === id) tx.objectStore('activity').delete(action.key); };
      const draft = tx.objectStore('meta').get('draft');
      draft.onsuccess = () => { if (draft.result?.value?.editingId === id) tx.objectStore('meta').delete('draft'); };
      const images = tx.objectStore('photos').getAll();
      images.onsuccess = () => { for (const image of images.result) if (image.contactId === id) tx.objectStore('photos').delete(image.id); };
      done({ deletedId: id });
    }));
  }

  async function remove(id) {
    if (deleting.has(id)) throw new Error('Kontakt wird gerade gelöscht.');
    if (globalThis.navigator?.onLine === false) throw new Error('Zum Löschen bitte eine Internetverbindung herstellen.');
    deleting.add(id);
    try {
      await init();
      // Finish any active upload before deleting, including a retry after a
      // lost acknowledgement. Deletion must never leave an orphan on the VPS.
      await sync();
      if (closed) throw new Error('Kontakt-Speicher ist geschlossen.');
      if (records.find(record => record.id === id)?.deleted) return { deletedId: id };
      if (error || pending.some(item => item.id === id) || activities.some(item => item.id === id) || photos.some(photo => photo.contactId === id && photo.pending)) throw new Error(error || 'Vor dem Löschen bitte den Kontakt synchronisieren und Änderungskonflikte klären.');
      const response = await api(`/api/contacts/${encodeURIComponent(id)}`, { method: 'DELETE', signal: abort.signal });
      if (response?.deletedId !== id) throw new Error('Löschen wurde vom Server nicht bestätigt.');
      return await discardContact(id);
    } finally { deleting.delete(id); }
  }

  function saveDraft(data) {
    const value = clone(data);
    return enqueue(() => transaction(db, ['meta'], 'readwrite', (tx, done) => {
      tx.objectStore('meta').put({ key: 'draft', value });
      done(value);
    }), { local: true, refresh: false });
  }

  function getDraft() {
    return enqueue(() => transaction(db, ['meta'], 'readonly', (tx, done) => {
      const request = tx.objectStore('meta').get('draft');
      request.onsuccess = () => done(request.result?.value ?? null);
    }), { refresh: false });
  }

  function clearDraft() {
    return enqueue(() => transaction(db, ['meta'], 'readwrite', (tx, done) => {
      tx.objectStore('meta').delete('draft');
      done(null);
    }), { local: true, refresh: false });
  }

  async function getPhotos(id) {
    const localPhotos = await enqueue(() => transaction(db, ['contacts', 'photos'], 'readonly', (tx, done, fail) => {
      const owner = tx.objectStore('contacts').get(id);
      owner.onsuccess = () => {
        if (!owner.result || owner.result.deleted || owner.result.ownerId !== userId) { fail(new Error('Kontakt nicht gefunden oder gelöscht.')); return; }
        const request = tx.objectStore('photos').getAll();
        request.onsuccess = () => done(request.result.filter(photo => photo.contactId === id && !photo.removed && photo.pending !== 'delete'));
      };
    }), { refresh: false });
    const result = [];
    for (const photo of localPhotos || []) {
      if (closed) return [];
      if (photo.blob) { result.push({ ...photoMetadata(photo), blob: photo.blob }); continue; }
      try {
        const blob = await api(`/api/contacts/${encodeURIComponent(id)}/photos/${encodeURIComponent(photo.id)}`, { responseType: 'blob', signal: abort.signal });
        if (closed) return [];
        if (!(blob instanceof Blob) || !blob.size || blob.size > 250 * 1024 || blob.type !== 'image/jpeg') throw new Error('Ungültiges Foto vom Server.');
        const cached = await enqueue(() => transaction(db, ['photos'], 'readwrite', (tx, done) => {
          const imageStore = tx.objectStore('photos');
          const request = imageStore.get(photo.id);
          request.onsuccess = () => {
            const current = request.result;
            if (!current || current.removed || current.pending === 'delete') { done(false); return; }
            imageStore.put({ ...current, blob }); done(true);
          };
        }), { refresh: false });
        if (cached) result.push({ ...photoMetadata(photo), blob });
      } catch (failure) {
        if (closed) return [];
        result.push({ ...photoMetadata(photo), loadError: errorMessage(failure) });
      }
    }
    return result;
  }

  function mergeRemote(remoteContacts, deletedIds = []) {
    const incoming = remoteContacts.map(normalizeRemote).filter(contact => contact.ownerId === userId);
    const removed = new Set(deletedIds.filter(id => typeof id === 'string'));
    return enqueue(() => transaction(db, ['contacts', 'queue', 'activity', 'meta', 'photos'], 'readwrite', (tx, done) => {
      const contactStore = tx.objectStore('contacts');
      const queueStore = tx.objectStore('queue');
      const localRequest = contactStore.getAll();
      const queueRequest = queueStore.getAll();
      const imageRequest = tx.objectStore('photos').getAll();
      let localRows, queueRows, imageRows;
      const merge = () => {
        if (!localRows || !queueRows || !imageRows) return;
        const locals = new Map(localRows.map(row => [row.id, row]));
        const queued = new Map(queueRows.map(row => [row.id, row]));
        for (const id of removed) {
          contactStore.put({ id, ownerId: userId, deleted: true });
          queueStore.delete(id);
        }
        const imageStore = tx.objectStore('photos');
        for (const image of imageRows) if (removed.has(image.contactId)) imageStore.delete(image.id);
        const actions = tx.objectStore('activity').getAll();
        actions.onsuccess = () => { for (const action of actions.result) if (removed.has(action.id)) tx.objectStore('activity').delete(action.key); };
        const draft = tx.objectStore('meta').get('draft');
        draft.onsuccess = () => { if (removed.has(draft.result?.value?.editingId)) tx.objectStore('meta').delete('draft'); };
        for (const remote of incoming) {
          const local = locals.get(remote.id);
          if (removed.has(remote.id) || local?.deleted) continue;
          const remoteImages = new Map(remote.photos.map(photo => [photo.id, photo]));
          const localImages = new Map(imageRows.filter(photo => photo.contactId === remote.id).map(photo => [photo.id, photo]));
          for (const photo of remote.photos) {
            const previousPhoto = localImages.get(photo.id);
            if (previousPhoto?.removed || previousPhoto?.pending) continue;
            imageStore.put({ ...photo, contactId: remote.id, blob: previousPhoto?.blob, serverKnown: true, pending: null });
          }
          for (const photo of localImages.values()) {
            if (!photo.pending && !photo.removed && !remoteImages.has(photo.id)) imageStore.put({ id: photo.id, contactId: remote.id, removed: true, pending: null });
          }
          const mutation = queued.get(remote.id);
          const merged = communication(remote.communication, local?.communication);
          if (mutation) {
            if (local) contactStore.put({ ...local, communication: merged });
            if (remote.revision > mutation.baseRevision &&
                JSON.stringify(remote.data) !== JSON.stringify(mutation.data) &&
                !(mutation.inFlight && remote.revision > mutation.inFlight.baseRevision &&
                  JSON.stringify(remote.data) === JSON.stringify(mutation.inFlight.data))) {
              queueStore.put({ ...mutation, conflictServer: remote });
              if (local) contactStore.put({ ...local, communication: merged, syncState: 'conflict' });
            }
          } else if (!local || remote.revision >= local.revision) {
            contactStore.put({ ...remote, communication: merged });
          }
        }
        done(null);
      };
      localRequest.onsuccess = () => { localRows = localRequest.result; merge(); };
      queueRequest.onsuccess = () => { queueRows = queueRequest.result; merge(); };
      imageRequest.onsuccess = () => { imageRows = imageRequest.result; merge(); };
    }));
  }

  function firstPending() {
    return enqueue(() => transaction(db, ['queue'], 'readwrite', (tx, done) => {
      const queueStore = tx.objectStore('queue');
      const request = queueStore.getAll();
      request.onsuccess = () => {
        const item = request.result.find(candidate => !candidate.conflictServer);
        if (!item) { done(null); return; }
        if (item.inFlight) { done(item.inFlight); return; }
        const sent = {
          id: item.id,
          baseRevision: item.baseRevision,
          mutationId: item.mutationId,
          data: item.data
        };
        queueStore.put({ ...item, inFlight: sent });
        done(sent);
      };
    }), { refresh: false });
  }

  function acceptMutation(sent, remoteValue) {
    const remote = normalizeRemote(remoteValue);
    return enqueue(() => transaction(db, ['contacts', 'queue'], 'readwrite', (tx, done) => {
      const contactStore = tx.objectStore('contacts');
      const queueStore = tx.objectStore('queue');
      const queueRequest = queueStore.get(sent.id);
      queueRequest.onsuccess = () => {
        const latest = queueRequest.result;
        if (!latest) { done(null); return; }
        const contactRequest = contactStore.get(sent.id);
        contactRequest.onsuccess = () => {
          const local = contactRequest.result;
          if (local?.deleted) { queueStore.delete(sent.id); done(null); return; }
          const merged = communication(remote.communication, local?.communication);
          if (latest.mutationId === sent.mutationId) {
            queueStore.delete(sent.id);
            const accepted = { ...remote, communication: merged };
            contactStore.put(accepted);
            done(accepted);
            return;
          }
          // A newer local edit and any mail actions remain intact while only
          // the revision used for the next upload advances.
          queueStore.put({ ...latest, baseRevision: remote.revision, inFlight: null });
          if (local) contactStore.put({ ...local, communication: merged, revision: remote.revision, syncState: latest.conflictServer ? 'conflict' : 'pending' });
          done(null);
        };
      };
    }));
  }

  function recordConflict(sent, remoteValue) {
    const remote = normalizeRemote(remoteValue);
    return enqueue(() => transaction(db, ['contacts', 'queue'], 'readwrite', (tx, done) => {
      const contactStore = tx.objectStore('contacts');
      const queueStore = tx.objectStore('queue');
      const queueRequest = queueStore.get(sent.id);
      queueRequest.onsuccess = () => {
        const latest = queueRequest.result;
        if (!latest) { done(null); return; }
        const currentRequest = contactStore.get(sent.id);
        currentRequest.onsuccess = () => {
          const current = currentRequest.result;
          if (current?.deleted) { queueStore.delete(sent.id); done(null); return; }
          remote.communication = communication(remote.communication, current?.communication);
          if (remote.revision > sent.baseRevision && JSON.stringify(remote.data) === JSON.stringify(sent.data)) {
            if (latest.mutationId === sent.mutationId) {
              queueStore.delete(sent.id);
              contactStore.put(remote);
              done(remote);
              return;
            }
            queueStore.put({ ...latest, baseRevision: remote.revision, inFlight: null, conflictServer: null });
            if (current) contactStore.put({ ...current, communication: remote.communication, revision: remote.revision, syncState: 'pending' });
            done(null);
            return;
          }
          if (JSON.stringify(latest.data) === JSON.stringify(remote.data)) {
            queueStore.delete(sent.id);
            contactStore.put(remote);
            done(remote);
            return;
          }
          queueStore.put({ ...latest, conflictServer: remote });
          if (current) contactStore.put({ ...current, communication: remote.communication, syncState: 'conflict' });
          done(null);
        };
      };
    }));
  }

  function resolveConflict(id, choice) {
    if (!['server', 'local'].includes(choice)) return Promise.reject(new TypeError('Ungültige Konfliktentscheidung.'));
    return enqueue(() => transaction(db, ['contacts', 'queue'], 'readwrite', (tx, done) => {
      const contactStore = tx.objectStore('contacts');
      const queueStore = tx.objectStore('queue');
      const queueRequest = queueStore.get(id);
      queueRequest.onsuccess = () => {
        const mutation = queueRequest.result;
        if (!mutation?.conflictServer) { done(null); return; }
        if (choice === 'server') {
          queueStore.delete(id);
          const request = contactStore.get(id);
          request.onsuccess = () => {
            const remote = { ...mutation.conflictServer, communication: communication(mutation.conflictServer.communication, request.result?.communication) };
            contactStore.put(remote);
            done(remote);
          };
          return;
        }
        const nextMutation = {
          ...mutation,
          baseRevision: mutation.conflictServer.revision,
          mutationId: uuid(),
          queuedAt: timestamp(),
          conflictServer: null,
          inFlight: null
        };
        queueStore.put(nextMutation);
        const contactRequest = contactStore.get(id);
        contactRequest.onsuccess = () => {
          const contact = contactRequest.result && {
            ...contactRequest.result,
            revision: nextMutation.baseRevision,
            syncState: 'pending'
          };
          if (contact) contactStore.put(contact);
          done(contact || null);
        };
      };
    }), { local: true });
  }

  function firstActivity() {
    return enqueue(() => transaction(db, ['activity', 'queue', 'contacts'], 'readonly', (tx, done) => {
      const actions = tx.objectStore('activity').getAll();
      const queued = tx.objectStore('queue').getAll();
      let actionRows, queueRows;
      const pick = () => {
        if (!actionRows || !queueRows) return;
        const blocked = new Set(queueRows.map(item => item.id));
        done(actionRows.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt)).find(item => !blocked.has(item.id)) || null);
      };
      actions.onsuccess = () => { actionRows = actions.result; pick(); };
      queued.onsuccess = () => { queueRows = queued.result; pick(); };
    }), { refresh: false });
  }

  function acceptActivity(action, remoteValue) {
    const remote = normalizeRemote(remoteValue);
    return enqueue(() => transaction(db, ['activity', 'contacts'], 'readwrite', (tx, done) => {
      tx.objectStore('activity').delete(action.key);
      const store = tx.objectStore('contacts');
      const request = store.get(action.id);
      request.onsuccess = () => {
        const local = request.result;
        // A mail response must never replace an edit made while the mail
        // request was in flight. Only its monotonic timestamps are merged.
        if (local && !local.deleted) store.put({ ...local, communication: communication(remote.communication, local.communication) });
        done(null);
      };
    }));
  }

  function firstPhotoAction() {
    return enqueue(() => transaction(db, ['photos', 'queue'], 'readwrite', (tx, done) => {
      const photoStore = tx.objectStore('photos');
      const images = photoStore.getAll(), queued = tx.objectStore('queue').getAll();
      let imageRows, queueRows;
      const pick = () => {
        if (!imageRows || !queueRows) return;
        const blocked = new Set(queueRows.map(item => item.id));
        const row = imageRows.filter(photo => photo.pending && !blocked.has(photo.contactId))
          .sort((a, b) => Number(b.pending === 'delete') - Number(a.pending === 'delete') || String(a.queuedAt).localeCompare(String(b.queuedAt)))[0];
        if (!row) { done(null); return; }
        if (row.inFlight) { done(row.inFlight); return; }
        const sent = { photoId: row.id, contactId: row.contactId, kind: row.pending, token: uuid(), ...(row.pending === 'put' ? { blob: row.blob } : {}) };
        photoStore.put({ ...row, attempted: true, inFlight: sent });
        done(sent);
      };
      images.onsuccess = () => { imageRows = images.result; pick(); };
      queued.onsuccess = () => { queueRows = queued.result; pick(); };
    }), { refresh: false });
  }

  function acceptPhotoAction(sent, response) {
    if (sent.kind === 'put' && (!response?.photo || response.photo.id !== sent.photoId)) throw new Error('Foto-Upload wurde nicht bestätigt.');
    if (sent.kind === 'delete' && response?.deletedPhotoId !== sent.photoId) throw new Error('Foto-Löschung wurde nicht bestätigt.');
    return enqueue(() => transaction(db, ['photos'], 'readwrite', (tx, done) => {
      const photoStore = tx.objectStore('photos');
      const request = photoStore.get(sent.photoId);
      request.onsuccess = () => {
        const row = request.result;
        if (!row || row.inFlight?.token !== sent.token) { done(null); return; }
        if (sent.kind === 'delete') photoStore.put({ id: row.id, contactId: row.contactId, removed: true, pending: null });
        else photoStore.put({ ...row, ...photoMetadata(response.photo), serverKnown: true, inFlight: null, pending: row.pending === 'delete' ? 'delete' : null });
        done(null);
      };
    }));
  }

  function rejectPhotoAction(sent) {
    return enqueue(() => transaction(db, ['photos'], 'readwrite', (tx, done) => {
      const photoStore = tx.objectStore('photos'), request = photoStore.get(sent.photoId);
      request.onsuccess = () => {
        const current = request.result;
        if (current?.inFlight?.token === sent.token) photoStore.put({ ...current, inFlight: null });
        done(null);
      };
    }));
  }

  async function forgetGonePhoto(action) {
    const latest = await api('/api/contacts?scope=mine', { signal: abort.signal });
    if (closed) return;
    if (!Array.isArray(latest?.contacts)) throw new Error('Ungültige Kontaktliste vom Server.');
    await mergeRemote(latest.contacts, latest.deletedIds || []);
    if (!(latest.contacts || []).some(record => record.id === action.contactId)) {
      if ((latest.deletedIds || []).includes(action.contactId)) return;
      throw new Error('Kontakt zum Foto nicht mehr verfügbar.');
    }
    return enqueue(() => transaction(db, ['photos'], 'readwrite', (tx, done) => {
      tx.objectStore('photos').put({ id: action.photoId, contactId: action.contactId, removed: true, pending: null });
      done(null);
    }));
  }

  async function performSync() {
    syncing = true;
    error = null;
    emit();
    try {
      const result = await api('/api/contacts?scope=mine', { signal: abort.signal });
      if (closed) return;
      if (!Array.isArray(result?.contacts)) throw new Error('Ungültige Kontaktliste vom Server.');
      await mergeRemote(result.contacts, result.deletedIds || []);
      while (!closed) {
        const mutation = await firstPending();
        if (!mutation || closed) break;
        try {
          const response = await api('/api/contacts', {
            method: 'POST',
            signal: abort.signal,
            data: {
              id: mutation.id,
              baseRevision: mutation.baseRevision,
              mutationId: mutation.mutationId,
              data: mutation.data
            }
          });
          if (closed) break;
          await acceptMutation(mutation, response?.contact);
        } catch (requestError) {
          if (closed) break;
          if (requestError?.status === 410) { await discardContact(mutation.id); continue; }
          if (requestError?.status !== 409) throw requestError;
          let server = remoteFromError(requestError);
          if (!server) {
            const latest = await api('/api/contacts?scope=mine', { signal: abort.signal });
            if (closed) break;
            server = latest?.contacts?.find(item => item.id === mutation.id);
          }
          if (!server) throw new Error('Konflikt erkannt, aber Serverfassung fehlt.');
          await recordConflict(mutation, server);
        }
      }
      while (!closed) {
        const action = await firstPhotoAction();
        if (!action || closed) break;
        try {
          const path = `/api/contacts/${encodeURIComponent(action.contactId)}/photos/${encodeURIComponent(action.photoId)}`;
          const response = await api(path, {
            method: action.kind === 'put' ? 'PUT' : 'DELETE', signal: abort.signal,
            ...(action.kind === 'put' ? { blob: action.blob } : {})
          });
          if (closed) break;
          await acceptPhotoAction(action, response);
        } catch (failure) {
          if (closed) break;
          if (failure?.status === 410) { await forgetGonePhoto(action); continue; }
          // A definitive rejection did not acknowledge an upload. Keep its
          // bytes for retry but let a subsequent removal supersede this PUT.
          // Network/5xx failures keep inFlight because their ACK is uncertain.
          if (failure?.status >= 400 && failure.status < 500 && ![408, 429].includes(failure.status)) await rejectPhotoAction(action);
          throw failure;
        }
      }
      while (!closed) {
        const action = await firstActivity();
        if (!action || closed) break;
        try {
          const response = await api(`/api/contacts/${encodeURIComponent(action.id)}/communication`, {
            method: 'POST', signal: abort.signal, data: { kind: action.kind, state: action.state }
          });
          if (closed) break;
          await acceptActivity(action, response?.contact);
        } catch (failure) {
          if (closed) break;
          if (failure?.status === 410) { await discardContact(action.id); continue; }
          throw failure;
        }
      }
    } catch (failure) {
      if (!closed) error = errorMessage(failure);
    } finally {
      syncing = false;
      emit();
    }
    return getState();
  }

  function sync() {
    if (closed) return Promise.resolve(getState());
    if (!syncPromise) syncPromise = performSync().finally(() => { syncPromise = null; });
    return syncPromise;
  }

  function close() {
    if (closed) return;
    closed = true;
    abort.abort();
    listeners.clear();
    records = [];
    pending = [];
    activities = [];
    photos = [];
    syncing = false;
    error = null;
    // Do not close an active local transaction: it must be durable even when
    // logout happens immediately after tapping Save.
    void Promise.allSettled([work, initPromise || Promise.resolve()]).then(() => db?.close());
  }

  return { init, getState, subscribe, save, remove, recordCommunication, getPhotos, sync, resolveConflict, saveDraft, getDraft, clearDraft, close };
}
