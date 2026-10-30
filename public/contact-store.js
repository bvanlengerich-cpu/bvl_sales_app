// Offline contacts are scoped to one signed-in Sales App account. The server
// remains authoritative; IndexedDB holds drafts and an unsent mutation queue.
const DATABASE_VERSION = 1;

const clone = value => structuredClone(value);
const timestamp = () => new Date().toISOString();
const uuid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function transaction(db, stores, mode, schedule) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let result;
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
    try {
      schedule(tx, value => { result = value; });
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
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB konnte nicht geöffnet werden.'));
    request.onblocked = () => reject(new Error('Lokaler Kontaktspeicher ist in einem anderen Fenster blockiert.'));
  });
}

function readAll(db) {
  return transaction(db, ['contacts', 'queue'], 'readonly', (tx, done) => {
    const records = tx.objectStore('contacts').getAll();
    const pending = tx.objectStore('queue').getAll();
    const values = {};
    const ready = () => {
      if (values.records && values.pending) done(values);
    };
    records.onsuccess = () => { values.records = records.result; ready(); };
    pending.onsuccess = () => { values.pending = pending.result; ready(); };
  });
}

function purgeForeignContacts(db, userId) {
  return transaction(db, ['contacts', 'queue'], 'readwrite', (tx, done) => {
    const contacts = tx.objectStore('contacts');
    const queue = tx.objectStore('queue');
    const request = contacts.getAll();
    request.onsuccess = () => {
      for (const record of request.result) {
        if (record.ownerId === userId) continue;
        contacts.delete(record.id);
        queue.delete(record.id);
      }
      done(null);
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
  const abort = new AbortController();

  function getState() {
    return {
      contacts: clone(records),
      pendingCount: pending.length,
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

  function save(data, id) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return Promise.reject(new TypeError('Kontaktdaten müssen ein Objekt sein.'));
    const contactId = id || uuid();
    const safeData = clone(data);
    return enqueue(() => transaction(db, ['contacts', 'queue'], 'readwrite', (tx, done) => {
      const contactStore = tx.objectStore('contacts');
      const queueStore = tx.objectStore('queue');
      const contactRequest = contactStore.get(contactId);
      contactRequest.onsuccess = () => {
        const existing = contactRequest.result;
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
          done(contact);
        };
      };
    }), { local: true });
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

  function mergeRemote(remoteContacts) {
    const incoming = remoteContacts.map(normalizeRemote).filter(contact => contact.ownerId === userId);
    return enqueue(() => transaction(db, ['contacts', 'queue'], 'readwrite', (tx, done) => {
      const contactStore = tx.objectStore('contacts');
      const queueStore = tx.objectStore('queue');
      const localRequest = contactStore.getAll();
      const queueRequest = queueStore.getAll();
      let localRows, queueRows;
      const merge = () => {
        if (!localRows || !queueRows) return;
        const locals = new Map(localRows.map(row => [row.id, row]));
        const queued = new Map(queueRows.map(row => [row.id, row]));
        for (const remote of incoming) {
          const local = locals.get(remote.id);
          const mutation = queued.get(remote.id);
          if (mutation) {
            if (remote.revision > mutation.baseRevision &&
                JSON.stringify(remote.data) !== JSON.stringify(mutation.data) &&
                !(mutation.inFlight && remote.revision > mutation.inFlight.baseRevision &&
                  JSON.stringify(remote.data) === JSON.stringify(mutation.inFlight.data))) {
              queueStore.put({ ...mutation, conflictServer: remote });
              if (local) contactStore.put({ ...local, syncState: 'conflict' });
            }
          } else if (!local || remote.revision >= local.revision) {
            contactStore.put(remote);
          }
        }
        done(null);
      };
      localRequest.onsuccess = () => { localRows = localRequest.result; merge(); };
      queueRequest.onsuccess = () => { queueRows = queueRequest.result; merge(); };
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
        if (latest.mutationId === sent.mutationId) {
          queueStore.delete(sent.id);
          contactStore.put(remote);
          done(remote);
          return;
        }
        // A new local edit occurred during POST. Preserve it and advance only
        // the revision used for its next upload.
        queueStore.put({ ...latest, baseRevision: remote.revision, inFlight: null });
        const contactRequest = contactStore.get(sent.id);
        contactRequest.onsuccess = () => {
          if (contactRequest.result) contactStore.put({
            ...contactRequest.result,
            revision: remote.revision,
            syncState: latest.conflictServer ? 'conflict' : 'pending'
          });
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
        if (remote.revision > sent.baseRevision && JSON.stringify(remote.data) === JSON.stringify(sent.data)) {
          if (latest.mutationId === sent.mutationId) {
            queueStore.delete(sent.id);
            contactStore.put(remote);
            done(remote);
            return;
          }
          queueStore.put({ ...latest, baseRevision: remote.revision, inFlight: null, conflictServer: null });
          const contactRequest = contactStore.get(sent.id);
          contactRequest.onsuccess = () => {
            if (contactRequest.result) contactStore.put({ ...contactRequest.result, revision: remote.revision, syncState: 'pending' });
            done(null);
          };
          return;
        }
        if (JSON.stringify(latest.data) === JSON.stringify(remote.data)) {
          queueStore.delete(sent.id);
          contactStore.put(remote);
          done(remote);
          return;
        }
        queueStore.put({ ...latest, conflictServer: remote });
        const contactRequest = contactStore.get(sent.id);
        contactRequest.onsuccess = () => {
          if (contactRequest.result) contactStore.put({ ...contactRequest.result, syncState: 'conflict' });
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
          contactStore.put(mutation.conflictServer);
          done(mutation.conflictServer);
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

  async function performSync() {
    syncing = true;
    error = null;
    emit();
    try {
      const result = await api('/api/contacts?scope=mine', { signal: abort.signal });
      if (closed) return;
      if (!Array.isArray(result?.contacts)) throw new Error('Ungültige Kontaktliste vom Server.');
      await mergeRemote(result.contacts);
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
    syncing = false;
    error = null;
    // Do not close an active local transaction: it must be durable even when
    // logout happens immediately after tapping Save.
    void Promise.allSettled([work, initPromise || Promise.resolve()]).then(() => db?.close());
  }

  return { init, getState, subscribe, save, sync, resolveConflict, saveDraft, getDraft, clearDraft, close };
}
