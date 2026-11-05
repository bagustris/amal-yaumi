// User preferences (as opposed to a progress/history module, if this app
// has one), saved to its own localStorage entry so resetting progress never
// wipes configured preferences and vice versa.

const SettingsManager = (() => {
  const STORAGE_KEY = 'amal-yaumi-settings';
  const DEFAULTS = {
    quranUnit: 'pages',
    showRawatib: true,
    showDhuha: true,
    showWitr: true,
    showQuran: true,
    showFasting: true,
    showInfaq: true,
    infaqAmount: false,
    currency: 'IDR',
    lastBackup: null,
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS };
      const parsed = JSON.parse(raw);
      const out = { ...DEFAULTS, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
      // Reject values of the wrong type/range so a corrupted entry can't break rendering.
      for (const k of Object.keys(DEFAULTS)) {
        if (typeof out[k] !== typeof DEFAULTS[k] && !(k === 'lastBackup' && (out[k] === null || typeof out[k] === 'string'))) out[k] = DEFAULTS[k];
      }
      if (!['ayat', 'pages', 'minutes'].includes(out.quranUnit)) out.quranUnit = DEFAULTS.quranUnit;
      return out;
    } catch {
      return { ...DEFAULTS };
    }
  }

  function save(settings) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // localStorage unavailable (private mode, quota, etc.) — fail silently
    }
  }

  function get(key) {
    return load()[key];
  }

  function set(key, value) {
    const settings = load();
    settings[key] = value;
    save(settings);
  }

  return { DEFAULTS, load, save, get, set };
})();
