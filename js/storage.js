// Day records: validation, IndexedDB persistence, and JSON backup/restore.
// One record per local calendar day, keyed by "YYYY-MM-DD".
// `null` always means "not recorded"; a numeric 0 is an explicit zero.

const AmalStore = (() => {
  const SCHEMA_VERSION = 1;
  const DB_NAME = 'amal-yaumi';
  const STORE = 'days';
  const MAX_COUNT = 9999;

  const PRAYERS = ['subuh', 'zuhur', 'asar', 'maghrib', 'isya'];
  const PRAYER_STATES = ['mosque_jamaah', 'other_jamaah', 'alone', 'not_performed'];
  const FASTING_STATUSES = ['fasted', 'did_not_fast'];
  const FASTING_TYPES = ['ramadan', 'qada', 'sunnah', 'other'];
  const QURAN_UNITS = ['ayat', 'pages', 'minutes'];

  // ---------- Dates (always local time, never UTC) ----------

  const pad = (n) => String(n).padStart(2, '0');

  function dateKey(d = new Date()) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function isValidKey(key) {
    if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  }

  // Noon avoids DST edge cases when adding days.
  function parseKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d, 12);
  }

  function addDays(key, n) {
    const d = parseKey(key);
    d.setDate(d.getDate() + n);
    return dateKey(d);
  }

  // ISO timestamp with the local UTC offset, e.g. 2026-11-05T20:15:00+09:00
  function nowStamp() {
    const d = new Date();
    const off = -d.getTimezoneOffset();
    const sign = off >= 0 ? '+' : '-';
    const abs = Math.abs(off);
    return `${dateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
      `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
  }

  // ---------- Records ----------

  function emptyDay(date) {
    return {
      schema_version: SCHEMA_VERSION,
      date,
      prayers: { subuh: null, zuhur: null, asar: null, maghrib: null, isya: null },
      rawatib_rakaat: null,
      dhuha_rakaat: null,
      witir_rakaat: null,
      quran: { unit: null, value: null },
      fasting: { status: null, type: null },
      infaq: { done: null, amount: null, currency: null },
      updated_at: nowStamp(),
    };
  }

  const cleanCount = (v) =>
    Number.isInteger(v) && v >= 0 && v <= MAX_COUNT ? v : null;

  // Returns a normalized record, or null if `raw` has no usable date.
  function sanitizeDay(raw) {
    if (!raw || typeof raw !== 'object' || !isValidKey(raw.date)) return null;
    const day = emptyDay(raw.date);
    const p = raw.prayers && typeof raw.prayers === 'object' ? raw.prayers : {};
    for (const name of PRAYERS) {
      day.prayers[name] = PRAYER_STATES.includes(p[name]) ? p[name] : null;
    }
    day.rawatib_rakaat = cleanCount(raw.rawatib_rakaat);
    day.dhuha_rakaat = cleanCount(raw.dhuha_rakaat);
    day.witir_rakaat = cleanCount(raw.witir_rakaat);

    const q = raw.quran && typeof raw.quran === 'object' ? raw.quran : {};
    const qv = cleanCount(q.value);
    if (qv !== null && QURAN_UNITS.includes(q.unit)) {
      day.quran = { unit: q.unit, value: qv };
    }

    const f = raw.fasting && typeof raw.fasting === 'object' ? raw.fasting : {};
    if (FASTING_STATUSES.includes(f.status)) {
      day.fasting.status = f.status;
      if (f.status === 'fasted' && FASTING_TYPES.includes(f.type)) day.fasting.type = f.type;
    }

    const i = raw.infaq && typeof raw.infaq === 'object' ? raw.infaq : {};
    if (typeof i.done === 'boolean') {
      day.infaq.done = i.done;
      if (i.done && typeof i.amount === 'number' && Number.isFinite(i.amount) &&
          i.amount >= 0 && i.amount <= 1e12) {
        day.infaq.amount = Math.round(i.amount * 100) / 100;
        const cur = typeof i.currency === 'string' ? i.currency.trim().slice(0, 8) : '';
        day.infaq.currency = cur || null;
      }
    }

    // A missing/unreadable timestamp ranks as oldest so it never beats real data in a merge.
    day.updated_at = typeof raw.updated_at === 'string' && !Number.isNaN(Date.parse(raw.updated_at))
      ? raw.updated_at : '1970-01-01T00:00:00+00:00';
    return day;
  }

  function isEmptyDay(day) {
    return PRAYERS.every((n) => day.prayers[n] === null) &&
      day.rawatib_rakaat === null && day.dhuha_rakaat === null && day.witir_rakaat === null &&
      day.quran.value === null && day.fasting.status === null && day.infaq.done === null;
  }

  // ---------- Persistence ----------

  const cache = new Map();
  let sorted = null; // memoized all(); cleared on every cache change
  const ts = (d) => Date.parse(d.updated_at) || 0;
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('amal-yaumi') : null;
  let onExternal = null;
  let db = null;
  let persistent = false;

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable'));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE, { keyPath: 'date' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB blocked'));
    });
  }

  function txDone(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
    });
  }

  // Loads every record into memory (a year of days is only a few hundred KB).
  async function init() {
    try {
      db = await openDb();
      persistent = true;
      const all = await new Promise((resolve, reject) => {
        const req = db.transaction(STORE).objectStore(STORE).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      for (const raw of all) {
        const day = sanitizeDay(raw);
        if (day) cache.set(day.date, day);
      }
      sorted = null;
    } catch {
      persistent = false; // session-only fallback; the UI warns the user
    }
    return persistent;
  }

  function isPersistent() { return persistent; }

  function get(date) {
    const found = cache.get(date);
    return found ? structuredClone(found) : emptyDay(date);
  }

  function has(date) { return cache.has(date); }

  function all() {
    if (!sorted) sorted = [...cache.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
    return sorted;
  }

  // In-flight writes. A reload from IndexedDB must never run while writes are
  // pending (it could replace newer local data with an older snapshot).
  let pending = 0;
  let reloadWanted = false;

  async function run(apply, write) {
    if (!persistent) { apply(); throw new Error('Storage unavailable'); }
    apply();
    pending++;
    try {
      await write();
    } catch (err) {
      reloadWanted = true; // IndexedDB is the source of truth; resync the cache
      throw err;
    } finally {
      pending--;
      if (!pending && reloadWanted) { reloadWanted = false; reloadFromDb(); }
    }
  }

  // Saves (or deletes, when nothing is recorded) a single day. The cache is
  // updated first so the UI is instant; a failed write resyncs from the database.
  async function save(day) {
    const clean = sanitizeDay(day);
    if (!clean) throw new Error('Invalid day');
    const empty = isEmptyDay(clean);
    await run(
      () => { if (empty) cache.delete(clean.date); else cache.set(clean.date, clean); sorted = null; },
      async () => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        if (empty) store.delete(clean.date); else store.put(clean);
        await txDone(tx);
      });
    if (channel) channel.postMessage({ type: 'day', date: clean.date });
  }

  // Applies many days in one transaction. `replace` clears everything first.
  async function writeMany(days, replace) {
    if (!persistent) throw new Error('Storage unavailable'); // nothing touched
    await run(
      () => {
        if (replace) cache.clear();
        for (const d of days) cache.set(d.date, d);
        sorted = null;
      },
      async () => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        if (replace) store.clear();
        for (const d of days) store.put(d);
        await txDone(tx);
      });
    if (channel) channel.postMessage({ type: 'all' });
  }

  // Another tab or the installed app changed the data (or a write failed):
  // refresh our cache from IndexedDB.
  async function reloadFromDb() {
    if (!persistent) return;
    if (pending) { reloadWanted = true; return; }
    try {
      const rows = await new Promise((resolve, reject) => {
        const req = db.transaction(STORE).objectStore(STORE).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      if (pending) { reloadWanted = true; return; } // a write started meanwhile
      cache.clear();
      for (const raw of rows) { const d = sanitizeDay(raw); if (d) cache.set(d.date, d); }
      sorted = null;
      if (onExternal) onExternal();
    } catch { /* keep current cache */ }
  }
  if (channel) channel.onmessage = reloadFromDb;
  function onExternalChange(fn) { onExternal = fn; }

  async function requestPersistence() {
    try {
      if (navigator.storage && navigator.storage.persist) await navigator.storage.persist();
    } catch { /* best effort */ }
  }

  // ---------- Backup / restore ----------

  function buildExport(settings) {
    return {
      app: 'amal-yaumi',
      schema_version: SCHEMA_VERSION,
      exported_at: nowStamp(),
      settings,
      days: all(),
    };
  }

  // Validates backup text without touching stored data.
  function parseBackup(text) {
    let data;
    try { data = JSON.parse(text); } catch { return { error: 'This file is not valid JSON.' }; }
    if (!data || typeof data !== 'object' || data.app !== 'amal-yaumi' || !Array.isArray(data.days)) {
      return { error: 'This is not an Amal Yaumi backup file.' };
    }
    if (!Number.isInteger(data.schema_version) || data.schema_version < 1) {
      return { error: 'The backup has no valid version.' };
    }
    if (data.schema_version > SCHEMA_VERSION) {
      return { error: 'This backup was made by a newer version of the app. Please update first.' };
    }
    const byDate = new Map();
    let skipped = 0;
    for (const raw of data.days) {
      const day = sanitizeDay(raw);
      if (!day) { skipped++; continue; }
      const prev = byDate.get(day.date);
      if (!prev || ts(prev) <= ts(day)) byDate.set(day.date, day);
    }
    const days = [...byDate.values()].filter((d) => !isEmptyDay(d));
    return { days, skipped, settings: data.settings && typeof data.settings === 'object' ? data.settings : null };
  }

  // Merge keeps whichever version of a day was updated most recently.
  async function importDays(days, mode) {
    if (mode === 'replace') { await writeMany(days, true); return days.length; }
    const take = days.filter((d) => {
      const mine = cache.get(d.date);
      return !mine || ts(mine) < ts(d);
    });
    await writeMany(take, false);
    return take.length;
  }

  return {
    PRAYERS, PRAYER_STATES, FASTING_TYPES, QURAN_UNITS, MAX_COUNT,
    dateKey, isValidKey, parseKey, addDays, nowStamp,
    emptyDay, sanitizeDay, isEmptyDay,
    init, isPersistent, get, has, all, save, requestPersistence, onExternalChange,
    buildExport, parseBackup, importDays,
  };
})();
