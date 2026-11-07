// Amal Yaumi — UI. Two views (day editor, history) plus a settings dialog.

const $ = (id) => document.getElementById(id);
const el = {
  app: $('app'),
  btnNav: $('btn-nav'),
  btnSettings: $('btn-settings'),
  btnSettingsClose: $('btn-settings-close'),
  overlay: $('settings-overlay'),
  panel: $('settings-panel'),
  btnHomeTitle: $('btn-home-title'),
  installButton: $('btn-install'),
  installHint: $('install-hint'),
  aboutVersion: $('about-version'),
};

const PRAYER_LABELS = { subuh: 'Subuh', zuhur: 'Zuhur', asar: 'Asar', maghrib: 'Maghrib', isya: 'Isya' };
const STATE_LABELS = {
  mosque_jamaah: 'Mosque jamaah',
  other_jamaah: 'Jamaah elsewhere',
  alone: 'Alone',
  not_performed: 'Not performed',
};
// Symbols only supplement the text label.
const STATE_SYMBOL = { mosque_jamaah: '●', other_jamaah: '◐', alone: '○', not_performed: '–' };
const FAST_TYPE_LABELS = { ramadan: 'Ramadan', qada: 'Qada', sunnah: 'Sunnah', other: 'Other' };
const QUICK = { rawatib: [2, 4, 8, 12], dhuha: [2, 4, 8], witr: [1, 3, 5], ayat: [1, 3, 5, 10], pages: [1, 2, 5, 10, 20], minutes: [5, 10, 15, 30] };

const ACTIVITIES = [
  { key: 'showRawatib', label: 'Rawatib' },
  { key: 'showDhuha', label: 'Dhuha' },
  { key: 'showWitr', label: 'Witr' },
  { key: 'showQuran', label: 'Quran reading' },
  { key: 'showFasting', label: 'Fasting' },
  { key: 'showInfaq', label: 'Infaq' },
];

const zeroCounts = () => Object.fromEntries(AmalStore.PRAYER_STATES.map((k) => [k, 0]));

const state = {
  view: 'day',
  date: AmalStore.dateKey(),
  followToday: true,
  day: null,
  openPrayer: null,
  month: null, // { y, m } (m is 0-based)
  period: 'month',
  histTab: 'calendar', // calendar | trends
  gran: 'week', // day | week | month
  metric: 'prayers',
  sel: null, // selected bucket index in trends
  storageOk: true,
  status: 'idle', // idle | saved | error
};

// ---------- tiny DOM helper ----------

function h(tag, attrs, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    node.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return node;
}

const today = () => AmalStore.dateKey();
const fmtLong = (key) =>
  AmalStore.parseKey(key).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtShort = (key) =>
  AmalStore.parseKey(key).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const fmtShortY = (key) =>
  AmalStore.parseKey(key).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const fmtNum = (n) => n.toLocaleString();

// ---------- persistence glue ----------

function setStatus(s) {
  state.status = s;
  const node = document.getElementById('save-status');
  if (node) paintStatus(node);
}

function backupText() {
  const last = SettingsManager.get('lastBackup');
  return last ? `Last backup: ${fmtShortY(last.slice(0, 10))}` : 'No backup exported yet.';
}

function paintStatus(node) {
  node.className = 'save-status ' + (state.storageOk ? state.status : 'error');
  node.textContent = !state.storageOk
    ? 'Storage unavailable — changes last only until this tab closes.'
    : state.status === 'error' ? 'Could not save. Please try again.'
    : state.status === 'saved' ? 'Saved locally' : 'Changes save automatically on this device';
}

function mutate(fn) {
  // Always edit the freshest copy (another tab may have changed this day).
  state.day = AmalStore.get(state.date);
  fn(state.day);
  state.day.updated_at = AmalStore.nowStamp();
  AmalStore.save(state.day).then(
    () => { setStatus('saved'); AmalStore.requestPersistence(); },
    () => setStatus('error'),
  );
}

function loadDay(date) {
  state.date = date;
  state.followToday = date === today();
  state.day = AmalStore.get(date);
  state.openPrayer = null;
}

// ---------- day view ----------

const STEP = { rawatib: 2, dhuha: 2 }; // + button increment (default 1)
const COUNT_FIELD = { rawatib: 'rawatib_rakaat', dhuha: 'dhuha_rakaat', witr: 'witir_rakaat' };

function getCount(key) {
  return key === 'quran' ? state.day.quran.value : state.day[COUNT_FIELD[key]];
}

function quranUnit() {
  return state.day.quran.value !== null ? state.day.quran.unit : SettingsManager.get('quranUnit');
}

function setCount(key, value) {
  mutate((d) => {
    if (key === 'quran') {
      d.quran = value === null ? { unit: null, value: null } : { unit: quranUnit(), value };
    } else {
      d[COUNT_FIELD[key]] = value;
    }
  });
}

function counterCard(key, title, hint) {
  const value = getCount(key);
  const unit = key === 'quran' ? quranUnit() : 'rakaat';
  const quick = key === 'quran' ? QUICK[unit] : QUICK[key];
  return h('section', { class: 'card counter' },
    h('div', { class: 'row-head' },
      h('h3', { text: title }),
      key === 'quran'
        ? h('div', { class: 'unit-switch', role: 'group', 'aria-label': 'Reading unit' },
          AmalStore.QURAN_UNITS.map((u) => h('button', {
            type: 'button', class: 'unit-opt' + (u === unit ? ' on' : ''), 'aria-pressed': String(u === unit),
            'data-act': 'quran-unit', 'data-val': u, 'data-fid': `unit-${u}`,
          }, u[0].toUpperCase() + u.slice(1))))
        : h('span', { class: 'unit-tag', text: hint || unit })),
    h('div', { class: 'stepper' },
      h('button', { type: 'button', class: 'step-btn', 'data-act': 'dec', 'data-key': key, 'data-fid': `dec-${key}`, 'aria-label': `Decrease ${title}` }, '−'),
      h('input', {
        class: 'count-input' + (value === null ? ' unset' : ''),
        type: 'text', inputmode: 'numeric', pattern: '[0-9]*', autocomplete: 'off',
        placeholder: '0', value: value === null ? '' : String(value),
        'data-key': key, 'data-fid': `in-${key}`, 'aria-label': `${title} (${unit})`,
      }),
      h('button', { type: 'button', class: 'step-btn', 'data-act': 'inc', 'data-key': key, 'data-fid': `inc-${key}`, 'aria-label': `Increase ${title}` }, '+')),
    h('div', { class: 'chips' },
      quick.map((q) => h('button', {
        type: 'button', class: 'chip' + (value === q ? ' on' : ''), 'aria-pressed': String(value === q),
        'data-act': 'set', 'data-key': key, 'data-val': q, 'data-fid': `q-${key}-${q}`,
      }, String(q))),
      value !== null && h('button', { type: 'button', class: 'chip clear', 'data-act': 'clear', 'data-key': key, 'data-fid': `clr-${key}` }, 'Clear')),
    key === 'quran' && value !== null && h('p', { class: 'hint-text', text: 'Changing the unit clears this day’s value, since it can’t be converted.' }));
}

function prayersCard() {
  const rows = AmalStore.PRAYERS.map((name) => {
    const val = state.day.prayers[name];
    const open = state.openPrayer === name;
    const row = h('div', { class: 'prayer' + (open ? ' open' : '') },
      h('div', { class: 'prayer-row' },
        h('span', { class: 'prayer-name', text: PRAYER_LABELS[name] }),
        h('button', {
          type: 'button', class: 'state-btn ' + (val ? 's-' + val : 's-none'),
          'data-act': 'toggle-prayer', 'data-prayer': name, 'data-fid': `pr-${name}`,
          'aria-expanded': String(open), 'aria-controls': `panel-${name}`,
          'aria-label': `${PRAYER_LABELS[name]}: ${val ? STATE_LABELS[val] : 'Not recorded'}. Change`,
        },
        h('span', { class: 'sym', 'aria-hidden': 'true', text: val ? STATE_SYMBOL[val] : '' }),
        h('span', { text: val ? STATE_LABELS[val] : 'Not recorded' }),
        h('span', { class: 'chev', 'aria-hidden': 'true', text: '▾' }))));
    if (open) {
      row.append(h('div', { class: 'choices', id: `panel-${name}` },
        AmalStore.PRAYER_STATES.map((st) => h('button', {
          type: 'button', class: 'choice s-' + st + (val === st ? ' on' : ''), 'aria-pressed': String(val === st),
          'data-act': 'pick-prayer', 'data-prayer': name, 'data-val': st, 'data-fid': `pick-${name}-${st}`,
        }, h('span', { class: 'sym', 'aria-hidden': 'true', text: STATE_SYMBOL[st] }), STATE_LABELS[st])),
        h('button', { type: 'button', class: 'choice s-none' + (val === null ? ' on' : ''), 'aria-pressed': String(val === null), 'data-act': 'pick-prayer', 'data-prayer': name, 'data-val': '', 'data-fid': `pick-${name}-none` }, 'Not recorded')));
    }
    return row;
  });
  return h('section', { class: 'card' }, rows);
}

function segButton(label, pressed, attrs) {
  return h('button', { type: 'button', class: 'seg' + (pressed ? ' on' : ''), 'aria-pressed': String(pressed), ...attrs }, label);
}

function fastingCard() {
  const f = state.day.fasting;
  return h('section', { class: 'card' },
    h('div', { class: 'row-head' }, h('h3', { text: 'Fasting' })),
    h('div', { class: 'seg-group' },
      segButton('Fasted', f.status === 'fasted', { 'data-act': 'fast', 'data-val': 'fasted', 'data-fid': 'fast-yes' }),
      segButton('Did not fast', f.status === 'did_not_fast', { 'data-act': 'fast', 'data-val': 'did_not_fast', 'data-fid': 'fast-no' })),
    f.status === 'fasted' && h('div', { class: 'chips' },
      h('span', { class: 'chips-label', text: 'Type (optional)' }),
      AmalStore.FASTING_TYPES.map((t) => h('button', {
        type: 'button', class: 'chip' + (f.type === t ? ' on' : ''), 'aria-pressed': String(f.type === t),
        'data-act': 'fast-type', 'data-val': t, 'data-fid': `ft-${t}`,
      }, FAST_TYPE_LABELS[t]))));
}

function infaqCard(settings) {
  const i = state.day.infaq;
  return h('section', { class: 'card' },
    h('div', { class: 'row-head' }, h('h3', { text: 'Infaq' })),
    h('div', { class: 'seg-group' },
      segButton('Done', i.done === true, { 'data-act': 'infaq', 'data-val': 'true', 'data-fid': 'inf-yes' }),
      segButton('Not done', i.done === false, { 'data-act': 'infaq', 'data-val': 'false', 'data-fid': 'inf-no' })),
    i.done === true && settings.infaqAmount && h('label', { class: 'amount' },
      h('span', { class: 'chips-label', text: `Amount (optional, ${settings.currency || 'no currency'})` }),
      h('input', {
        class: 'text-input', type: 'text', inputmode: 'decimal', autocomplete: 'off',
        placeholder: 'Not recorded', value: i.amount === null ? '' : String(i.amount), 'data-fid': 'in-amount', id: 'infaq-amount',
      })));
}

function dateNav() {
  const isToday = state.date === today();
  const picker = h('input', {
    type: 'date', class: 'date-picker', id: 'date-picker', value: state.date, max: today(), min: '2000-01-01',
    tabindex: '-1', 'aria-hidden': 'true',
  });
  return h('div', { class: 'date-nav' },
    h('button', { type: 'button', class: 'step-btn', 'data-act': 'day-prev', 'data-fid': 'day-prev', 'aria-label': 'Previous day' }, '‹'),
    h('button', { type: 'button', class: 'date-label', 'data-act': 'pick-date', 'data-fid': 'pick-date', 'aria-label': `${fmtLong(state.date)}. Choose another date` },
      h('span', { class: 'eyebrow', text: isToday ? 'Today' : 'Editing a past day' }),
      h('span', { class: 'date-text', text: fmtLong(state.date) })),
    h('button', { type: 'button', class: 'step-btn', 'data-act': 'day-next', 'data-fid': 'day-next', 'aria-label': 'Next day', disabled: isToday }, '›'),
    picker);
}

function section(title, ...kids) {
  return h('div', { class: 'group' }, h('h2', { class: 'group-title', text: title }), ...kids);
}

function renderDay() {
  const s = SettingsManager.load();
  const parts = [dateNav(), section('Prayers', prayersCard())];

  const sunnah = [];
  if (s.showRawatib) sunnah.push(counterCard('rawatib', 'Rawatib', 'total rakaat'));
  if (s.showDhuha) sunnah.push(counterCard('dhuha', 'Dhuha'));
  if (s.showWitr) sunnah.push(counterCard('witr', 'Witr'));
  if (sunnah.length) parts.push(section('Sunnah prayers', ...sunnah));

  if (s.showQuran) parts.push(section('Quran reading', counterCard('quran', 'Reading', quranUnit())));

  const other = [];
  if (s.showFasting) other.push(fastingCard());
  if (s.showInfaq) other.push(infaqCard(s));
  if (other.length) parts.push(section('Other', ...other));

  const status = h('p', { id: 'save-status', role: 'status', 'aria-live': 'polite' });
  paintStatus(status);
  parts.push(h('div', { class: 'footer' }, status, h('p', { class: 'hint-text', text: backupText() })));
  el.app.replaceChildren(...parts);
}

// ---------- history view ----------

function monthRange(y, m) {
  return [AmalStore.dateKey(new Date(y, m, 1)), AmalStore.dateKey(new Date(y, m + 1, 0))];
}

function periodRange() {
  if (state.period === 'month') return monthRange(state.month.y, state.month.m);
  if (state.period === 'week') return [AmalStore.addDays(today(), -6), today()];
  return ['0000-00-00', '9999-99-99'];
}

function summarize(days, s) {
  const sum = {
    days: days.length,
    prayers: zeroCounts(),
    rawatib: 0, rawatibDays: 0, dhuha: 0, dhuhaDays: 0, witr: 0, witrDays: 0,
    quran: { ayat: 0, pages: 0, minutes: 0 }, quranDays: 0,
    fasted: 0, fastTypes: {}, notFasted: 0,
    infaqDays: 0, amounts: {},
  };
  for (const d of days) {
    for (const n of AmalStore.PRAYERS) if (d.prayers[n]) sum.prayers[d.prayers[n]]++;
    if (d.rawatib_rakaat !== null) { sum.rawatib += d.rawatib_rakaat; sum.rawatibDays++; }
    if (d.dhuha_rakaat !== null) { sum.dhuha += d.dhuha_rakaat; sum.dhuhaDays++; }
    if (d.witir_rakaat !== null) { sum.witr += d.witir_rakaat; sum.witrDays++; }
    if (d.quran.value !== null) { sum.quran[d.quran.unit] += d.quran.value; sum.quranDays++; }
    if (d.fasting.status === 'fasted') {
      sum.fasted++;
      const t = d.fasting.type || 'untyped';
      sum.fastTypes[t] = (sum.fastTypes[t] || 0) + 1;
    } else if (d.fasting.status === 'did_not_fast') sum.notFasted++;
    if (d.infaq.done === true) {
      sum.infaqDays++;
      if (s.infaqAmount && d.infaq.amount !== null) {
        const c = d.infaq.currency || '';
        sum.amounts[c] = (sum.amounts[c] || 0) + d.infaq.amount;
      }
    }
  }
  return sum;
}

const recordedDays = (n) => `${n} recorded day${n === 1 ? '' : 's'}`;

function statRow(label, value, note) {
  return h('div', { class: 'stat' }, h('span', { text: label }), h('strong', { text: value }), note && h('small', { text: note }));
}

function calendarNodes() {
  const s = SettingsManager.load();
  const { y, m } = state.month;
  const now = new Date();
  const atCurrent = y === now.getFullYear() && m === now.getMonth();
  const monthName = new Date(y, m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const first = (new Date(y, m, 1).getDay() + 6) % 7; // Monday-first
  const count = new Date(y, m + 1, 0).getDate();
  const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const cells = wd.map((w) => h('span', { class: 'wd', 'aria-hidden': 'true', text: w[0] }));
  for (let i = 0; i < first; i++) cells.push(h('span'));
  const [startKey] = monthRange(y, m);
  for (let n = 1; n <= count; n++) {
    const key = startKey.slice(0, 8) + String(n).padStart(2, '0');
    const future = key > today();
    const rec = AmalStore.has(key);
    cells.push(h('button', {
      type: 'button', class: 'cell' + (rec ? ' rec' : '') + (key === today() ? ' today' : ''),
      'data-act': 'open-day', 'data-val': key, disabled: future,
      'aria-label': `${fmtLong(key)}${rec ? ', has records' : ', no records'}`,
    }, String(n)));
  }

  const [from, to] = periodRange();
  const inRange = AmalStore.all().filter((d) => d.date >= from && d.date <= to);
  const sum = summarize(inRange, s);
  const periodLabel = state.period === 'all'
    ? 'All time'
    : `${fmtShort(from)} – ${fmtShortY(to)}`;

  const stats = [];
  stats.push(statRow('Days with records', String(sum.days)));
  const pr = sum.prayers;
  const prTotal = pr.mosque_jamaah + pr.other_jamaah + pr.alone + pr.not_performed;
  if (prTotal) {
    stats.push(h('h3', { class: 'sum-title', text: 'Prayers by recorded status' }));
    for (const st of AmalStore.PRAYER_STATES) stats.push(statRow(STATE_LABELS[st], String(pr[st])));
  }
  const sunnahStats = [];
  if (s.showRawatib && sum.rawatibDays) sunnahStats.push(statRow('Rawatib', `${fmtNum(sum.rawatib)} rakaat`, recordedDays(sum.rawatibDays)));
  if (s.showDhuha && sum.dhuhaDays) sunnahStats.push(statRow('Dhuha', `${fmtNum(sum.dhuha)} rakaat`, recordedDays(sum.dhuhaDays)));
  if (s.showWitr && sum.witrDays) sunnahStats.push(statRow('Witr', `${fmtNum(sum.witr)} rakaat`, recordedDays(sum.witrDays)));
  if (sunnahStats.length) stats.push(h('h3', { class: 'sum-title', text: 'Sunnah prayers' }), ...sunnahStats);
  if (s.showQuran && sum.quranDays) {
    stats.push(h('h3', { class: 'sum-title', text: 'Quran reading' }));
    if (sum.quran.ayat) stats.push(statRow('Ayat', fmtNum(sum.quran.ayat)));
    if (sum.quran.pages) stats.push(statRow('Pages', fmtNum(sum.quran.pages)));
    if (sum.quran.minutes) stats.push(statRow('Minutes', fmtNum(sum.quran.minutes)));
  }
  if (s.showFasting && (sum.fasted || sum.notFasted)) {
    stats.push(h('h3', { class: 'sum-title', text: 'Fasting' }), statRow('Days fasted', String(sum.fasted)));
    for (const [t, n] of Object.entries(sum.fastTypes)) {
      stats.push(statRow(t === 'untyped' ? 'No type chosen' : FAST_TYPE_LABELS[t], String(n)));
    }
  }
  if (s.showInfaq && (sum.infaqDays || Object.keys(sum.amounts).length)) {
    stats.push(h('h3', { class: 'sum-title', text: 'Infaq' }), statRow('Days done', String(sum.infaqDays)));
    for (const [c, a] of Object.entries(sum.amounts)) stats.push(statRow('Amount recorded', `${c ? c + ' ' : ''}${fmtNum(a)}`));
  }

  const periodBtn = (id, label) =>
    segButton(label, state.period === id, { 'data-act': 'period', 'data-val': id, 'data-fid': `period-${id}` });

  return [
    h('div', { class: 'month-nav' },
      h('button', { type: 'button', class: 'step-btn', 'data-act': 'month-prev', 'data-fid': 'month-prev', 'aria-label': 'Previous month' }, '‹'),
      h('h2', { class: 'month-title', text: monthName, 'aria-live': 'polite' }),
      h('button', { type: 'button', class: 'step-btn', 'data-act': 'month-next', 'data-fid': 'month-next', 'aria-label': 'Next month', disabled: atCurrent }, '›')),
    h('div', { class: 'calendar card' }, cells),
    h('p', { class: 'hint-text center', text: 'A dot means something was recorded that day. Days without a dot are simply not recorded.' }),
    h('div', { class: 'group' },
      h('h2', { class: 'group-title', text: 'Summary' }),
      h('div', { class: 'seg-group' }, periodBtn('month', atCurrent ? 'This month' : new Date(y, m, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })), periodBtn('week', 'Last 7 days'), periodBtn('all', 'All time')),
      h('p', { class: 'hint-text', text: periodLabel }),
      h('div', { class: 'card stats' }, stats))];
}


// ---------- trends ----------
// Self-reflection (muhasabah), not a score: averages use recorded days only,
// unrecorded days are never counted as zero, and nothing is ranked or colored good/bad.

const GRANS = { day: { n: 14, label: 'Days' }, week: { n: 8, label: 'Weeks' }, month: { n: 6, label: 'Months' } };
const STACK = ['mosque_jamaah', 'other_jamaah', 'alone', 'not_performed'];
const SINGLE = {
  rawatib: { label: 'Rawatib', unit: 'rakaat', get: (d) => d.rawatib_rakaat, setting: 'showRawatib' },
  dhuha: { label: 'Dhuha', unit: 'rakaat', get: (d) => d.dhuha_rakaat, setting: 'showDhuha' },
  witr: { label: 'Witr', unit: 'rakaat', get: (d) => d.witir_rakaat, setting: 'showWitr' },
  'quran-ayat': { label: 'Quran ayat', unit: 'ayat', get: (d) => (d.quran.unit === 'ayat' ? d.quran.value : null), setting: 'showQuran' },
  'quran-pages': { label: 'Quran pages', unit: 'pages', get: (d) => (d.quran.unit === 'pages' ? d.quran.value : null), setting: 'showQuran' },
  'quran-minutes': { label: 'Quran minutes', unit: 'minutes', get: (d) => (d.quran.unit === 'minutes' ? d.quran.value : null), setting: 'showQuran' },
  fasting: { label: 'Fasting', unit: 'days fasted', days: true, get: (d) => (d.fasting.status === null ? null : d.fasting.status === 'fasted' ? 1 : 0), setting: 'showFasting' },
  infaq: { label: 'Infaq', unit: 'days done', days: true, get: (d) => (d.infaq.done === null ? null : d.infaq.done ? 1 : 0), setting: 'showInfaq' },
};

const fmt1 = (x) => (Number.isInteger(x) ? String(x) : x.toFixed(1));

function trendBuckets(gran) {
  const t = today();
  const now = new Date();
  const dow = (AmalStore.parseKey(t).getDay() + 6) % 7;
  const out = [];
  for (let i = GRANS[gran].n - 1; i >= 0; i--) {
    let from, to, label, name;
    if (gran === 'day') {
      from = to = AmalStore.addDays(t, -i);
      const dt = AmalStore.parseKey(from);
      label = dt.toLocaleDateString(undefined, { weekday: 'narrow' });
      name = dt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    } else if (gran === 'week') {
      from = AmalStore.addDays(t, -dow - 7 * i);
      to = AmalStore.addDays(from, 6);
      label = fmtShort(from);
      name = `Week of ${fmtShort(from)}`;
    } else {
      const base = new Date(now.getFullYear(), now.getMonth() - i, 1);
      [from, to] = monthRange(base.getFullYear(), base.getMonth());
      label = base.toLocaleDateString(undefined, { month: 'short' });
      name = base.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }
    const partial = gran !== 'day' && to > t;
    out.push({ from, to, label, name: name + (partial ? ' (so far)' : '') });
  }
  return out;
}

function bucketStats(metric, days) {
  if (metric === 'prayers') {
    const c = zeroCounts();
    let n = 0;
    for (const d of days) {
      let any = false;
      for (const p of AmalStore.PRAYERS) if (d.prayers[p]) { c[d.prayers[p]]++; any = true; }
      if (any) n++;
    }
    const jam = c.mosque_jamaah + c.other_jamaah;
    return { n, counts: c, value: n ? jam / n : null, total: jam };
  }
  const M = SINGLE[metric];
  const vals = days.map(M.get).filter((v) => v !== null);
  const total = vals.reduce((a, b) => a + b, 0);
  const n = vals.length;
  return { n, total, value: n ? (M.days ? total : total / n) : null };
}

function availableMetrics(s, all) {
  const ids = ['prayers'];
  for (const [id, M] of Object.entries(SINGLE)) {
    if (!s[M.setting]) continue;
    if (id.startsWith('quran-') && id !== `quran-${s.quranUnit}` && !all.some((d) => M.get(d) !== null)) continue;
    ids.push(id);
  }
  return ids;
}

function trendsNodes() {
  const s = SettingsManager.load();
  const all = AmalStore.all();
  const ids = availableMetrics(s, all);
  if (!ids.includes(state.metric)) state.metric = 'prayers';
  const isPr = state.metric === 'prayers';
  const M = isPr ? { label: 'Prayers', unit: 'jamaah prayers per day' } : SINGLE[state.metric];

  const buckets = trendBuckets(state.gran).map((b) => {
    const days = all.filter((d) => d.date >= b.from && d.date <= b.to);
    return { ...b, days, st: bucketStats(state.metric, days) };
  });
  const last = buckets.length - 1;
  const sel = state.sel !== null && state.sel <= last ? state.sel : last;
  const perUnit = state.gran === 'day' ? 'day' : state.gran;
  const max = isPr ? 5 : Math.max(1, ...buckets.map((b) => b.st.value || 0));

  // Bars
  const cols = buckets.map((b, i) => {
    const v = b.st.value;
    const kids = [];
    if (v === null) {
      kids.push(h('span', { class: 'bar-none', 'aria-hidden': 'true', text: '–' }));
    } else if (isPr) {
      const segs = STACK.map((k) => [k, b.st.counts[k] / b.st.n]).filter(([, x]) => x > 0);
      const tot = segs.reduce((a, [, x]) => a + x, 0);
      kids.push(h('span', { class: 'stack', style: `height:${(tot / max) * 100}%` },
        segs.map(([k, x]) => h('span', { class: 'seg-bar c-' + k, style: `flex:${x} 1 0` }))));
    } else {
      kids.push(h('span', { class: 'bar', style: `height:${(v / max) * 100}%` }));
    }
    if (v !== null && (state.gran !== 'day' || i === sel)) {
      kids.push(h('span', { class: 'bar-val' + (isPr ? ' pill' : ''), 'aria-hidden': 'true', style: `bottom:calc(${(v / max) * 100}% + 2px)`, text: fmt1(v) }));
    }
    const desc = v === null ? 'nothing recorded' : `${fmt1(v)} ${M.unit}, ${b.st.n} recorded day${b.st.n === 1 ? '' : 's'}`;
    return h('button', {
      type: 'button', class: 'col' + (i === sel ? ' sel' : ''), 'aria-pressed': String(i === sel),
      'data-act': 'sel', 'data-val': i, 'data-fid': `col-${i}`, 'aria-label': `${b.name}: ${desc}`,
    }, kids);
  });

  // Average line (single-series only): pooled over recorded days / buckets
  let avg = null;
  if (!isPr) {
    const withData = buckets.filter((b) => b.st.n);
    if (withData.length) {
      avg = SINGLE[state.metric].days
        ? withData.reduce((a, b) => a + b.st.total, 0) / withData.length
        : withData.reduce((a, b) => a + b.st.total, 0) / withData.reduce((a, b) => a + b.st.n, 0);
    }
  }

  const chartTitle = isPr
    ? 'Prayers in congregation (mosque + elsewhere), average per recorded day'
    : SINGLE[state.metric].days ? `${M.label}: ${M.unit} per ${perUnit}` : `${M.label}: average ${M.unit} per recorded day`;

  const chart = h('div', { class: 'card chart' },
    h('h3', { class: 'chart-title', text: chartTitle }),
    h('div', { class: 'plot' + (state.gran === 'day' ? ' dense' : '') },
      cols,
      avg !== null && h('span', { class: 'avg-line', style: `bottom:${(avg / max) * 100}%`, 'aria-hidden': 'true' })),
    h('div', { class: 'axis' + (state.gran === 'day' ? ' dense' : ''), 'aria-hidden': 'true' },
      buckets.map((b) => h('span', { text: b.label }))),
    isPr
      ? h('ul', { class: 'legend' }, STACK.map((k) => h('li', {}, h('i', { class: 'sw c-' + k }), STATE_LABELS[k])))
      : avg !== null && h('p', { class: 'hint-text' }, h('i', { class: 'sw-line' }), ` Average ${fmt1(avg)} ${SINGLE[state.metric].days ? `${M.unit} per ${perUnit}` : M.unit}`));

  // Selected vs previous
  const cur = buckets[sel];
  const prev = sel > 0 ? buckets[sel - 1] : null;
  const line = (b) => `${b.name}: ${b.st.value === null ? 'nothing recorded' : `${fmt1(b.st.value)} ${M.unit}`}` +
    (b.st.n ? ` · ${b.st.n} recorded day${b.st.n === 1 ? '' : 's'}` : '');
  let delta = '';
  if (prev && cur.st.value !== null && prev.st.value !== null) {
    const diff = cur.st.value - prev.st.value;
    delta = Math.abs(diff) < 0.05 ? 'About the same as the one before.' : `${fmt1(Math.abs(diff))} ${diff > 0 ? 'higher' : 'lower'} than the one before.`;
  } else if (prev) delta = 'Not enough records to compare.';
  const detail = h('div', { class: 'card compare', role: 'status', 'aria-live': 'polite' },
    h('p', { class: 'cmp-main', text: line(cur) }),
    isPr && cur.st.n > 0 && h('p', { class: 'hint-text', text: STACK.map((k) => `${STATE_LABELS[k]} ${cur.st.counts[k]}`).join(' · ') }),
    prev && h('p', { class: 'hint-text', text: line(prev) }),
    delta && h('p', { class: 'cmp-delta', text: delta }));

  const out = [chart, detail];

  // Distribution by prayer over the whole window
  if (isPr) {
    const from = buckets[0].from, to = buckets[last].to;
    const win = all.filter((d) => d.date >= from && d.date <= to);
    const rows = AmalStore.PRAYERS.map((p) => {
      const c = zeroCounts();
      let n = 0;
      for (const d of win) if (d.prayers[p]) { c[d.prayers[p]]++; n++; }
      const desc = n ? STACK.map((k) => `${STATE_LABELS[k]} ${c[k]}`).join(', ') : 'nothing recorded';
      return h('div', { class: 'dist-row', role: 'img', 'aria-label': `${PRAYER_LABELS[p]}: ${desc}` },
        h('span', { class: 'dist-name', text: PRAYER_LABELS[p] }),
        h('span', { class: 'dist-bar' }, STACK.filter((k) => c[k]).map((k) => h('span', { class: 'c-' + k, style: `flex:${c[k]} 1 0` }))),
        h('span', { class: 'dist-n', text: n ? String(n) : '–' }));
    });
    out.push(h('div', { class: 'card chart' },
      h('h3', { class: 'chart-title', text: `Distribution by prayer · ${fmtShort(from)} – ${fmtShortY(to > today() ? today() : to)}` }),
      rows,
      h('p', { class: 'hint-text', text: 'Number on the right = days recorded for that prayer.' })));
  }

  out.push(h('p', { class: 'hint-text center', text: 'For reflection, not a score. Averages count recorded days only; unrecorded days are never counted as zero.' }));

  const gran = h('div', { class: 'seg-group' }, Object.entries(GRANS).map(([id, g]) =>
    segButton(g.label, state.gran === id, { 'data-act': 'gran', 'data-val': id, 'data-fid': `gran-${id}` })));
  const metrics = h('div', { class: 'chips metric-chips', role: 'group', 'aria-label': 'Metric' }, ids.map((id) => {
    const label = id === 'prayers' ? 'Prayers' : SINGLE[id].label;
    return h('button', { type: 'button', class: 'chip' + (state.metric === id ? ' on' : ''), 'aria-pressed': String(state.metric === id), 'data-act': 'metric', 'data-val': id, 'data-fid': `m-${id}` }, label);
  }));
  return [gran, metrics, ...out];
}

function renderHistory() {
  const tab = (id, label) => segButton(label, state.histTab === id, { 'data-act': 'hist-tab', 'data-val': id, 'data-fid': `tab-${id}` });
  el.app.replaceChildren(
    h('div', { class: 'seg-group tabs' }, tab('calendar', 'Calendar'), tab('trends', 'Trends')),
    ...(state.histTab === 'trends' ? trendsNodes() : calendarNodes()));
}

// ---------- view switching ----------

function render() {
  if (state.view === 'day' && !state.day) return; // storage still opening
  const focusId = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.fid;
  if (state.view === 'day') {
    renderDay();
    el.btnNav.textContent = 'History';
    el.btnNav.setAttribute('aria-label', 'Open history');
  } else {
    renderHistory();
    el.btnNav.textContent = 'Today';
    el.btnNav.setAttribute('aria-label', 'Back to today');
  }
  if (focusId) {
    const again = el.app.querySelector(`[data-fid="${focusId}"]`);
    if (again && !again.disabled) again.focus({ preventScroll: true });
  }
}

function goDay(date, { scroll = true } = {}) {
  if (!AmalStore.isValidKey(date) || date > today()) date = today();
  state.view = 'day';
  loadDay(date);
  setStatus('idle');
  render();
  if (scroll) window.scrollTo(0, 0);
}

function goHistory() {
  state.view = 'history';
  const d = AmalStore.parseKey(state.date);
  state.month = { y: d.getFullYear(), m: d.getMonth() };
  render();
  window.scrollTo(0, 0);
}

// ---------- events ----------

function onClick(e) {
  const t = e.target.closest('[data-act]');
  if (!t || t.disabled) return;
  const act = t.dataset.act;
  const key = t.dataset.key;
  const val = t.dataset.val;

  switch (act) {
    case 'toggle-prayer':
      state.openPrayer = state.openPrayer === t.dataset.prayer ? null : t.dataset.prayer;
      return render();
    case 'pick-prayer':
      mutate((d) => { d.prayers[t.dataset.prayer] = val || null; });
      state.openPrayer = null;
      return render();
    case 'inc': {
      const v = getCount(key);
      setCount(key, Math.min(AmalStore.MAX_COUNT, (v ?? 0) + (STEP[key] || 1)));
      return render();
    }
    case 'dec': {
      const v = getCount(key);
      setCount(key, v === null ? 0 : Math.max(0, v - 1));
      return render();
    }
    case 'set':
      setCount(key, Number(val));
      return render();
    case 'clear':
      setCount(key, null);
      return render();
    case 'fast':
      mutate((d) => {
        d.fasting = d.fasting.status === val ? { status: null, type: null } : { status: val, type: null };
      });
      return render();
    case 'fast-type':
      mutate((d) => { d.fasting.type = d.fasting.type === val ? null : val; });
      return render();
    case 'infaq': {
      const done = val === 'true';
      mutate((d) => {
        d.infaq = d.infaq.done === done ? { done: null, amount: null, currency: null } : { done, amount: null, currency: null };
      });
      return render();
    }
    case 'day-prev': return goDay(AmalStore.addDays(state.date, -1), { scroll: false });
    case 'day-next': return goDay(AmalStore.addDays(state.date, 1), { scroll: false });
    case 'pick-date': {
      const p = $('date-picker');
      if (p.showPicker) { try { p.showPicker(); return; } catch { /* fall through */ } }
      p.tabIndex = 0; p.focus(); p.click();
      return;
    }
    case 'open-day': return goDay(val);
    case 'month-prev': {
      const { y, m } = state.month;
      state.month = m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 };
      return render();
    }
    case 'month-next': {
      const { y, m } = state.month;
      state.month = m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 };
      return render();
    }
    case 'period':
      state.period = val;
      return render();
    case 'quran-unit':
      SettingsManager.set('quranUnit', val);
      if (state.day.quran.value !== null && state.day.quran.unit !== val) setCount('quran', null);
      return render();
    case 'hist-tab': state.histTab = val; return render();
    case 'gran': state.gran = val; state.sel = null; return render();
    case 'metric': state.metric = val; return render();
    case 'sel': state.sel = Number(val); return render();
  }
}

function onInput(e) {
  const t = e.target;
  if (t.classList.contains('count-input')) {
    const digits = t.value.replace(/\D/g, '').slice(0, 4);
    if (digits !== t.value) t.value = digits;
    setCount(t.dataset.key, digits === '' ? null : Math.min(AmalStore.MAX_COUNT, parseInt(digits, 10)));
    t.classList.toggle('unset', digits === '');
  } else if (t.id === 'infaq-amount') {
    let v = t.value.replace(',', '.').replace(/[^0-9.]/g, '');
    const [whole, ...frac] = v.split('.');
    v = whole.slice(0, 12) + (frac.length ? '.' + frac.join('').slice(0, 2) : '');
    if (v !== t.value) t.value = v;
    const n = v === '' || v === '.' ? null : Number(v);
    mutate((d) => {
      d.infaq.amount = n === null || !Number.isFinite(n) ? null : n;
      d.infaq.currency = d.infaq.amount === null ? null : (SettingsManager.get('currency') || null);
    });
  }
}

function onChange(e) {
  const t = e.target;
  // Typed values are already saved on `input`; re-rendering here would swallow
  // a tap on +/− (blur fires before click), so only the Enter key re-renders.
  if (t.id === 'date-picker') {
    if (AmalStore.isValidKey(t.value)) goDay(t.value, { scroll: false });
  }
}

el.app.addEventListener('click', onClick);
el.app.addEventListener('input', onInput);
el.app.addEventListener('change', onChange);
el.app.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type === 'text') {
    e.preventDefault();
    e.target.blur();
    render();
  }
});
el.btnNav.addEventListener('click', () => (state.view === 'day' ? goHistory() : goDay(today())));
el.btnHomeTitle.addEventListener('click', () => goDay(today()));

// Roll over to the new day if the app stays open past midnight.
function checkRollover() {
  if (state.view === 'day' && state.followToday && state.date !== today()) goDay(today(), { scroll: false });
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkRollover(); });
window.addEventListener('focus', checkRollover);
window.addEventListener('pageshow', checkRollover);

// ---------- settings dialog ----------

let lastFocus = null;
let pendingImport = null;

function openSettings() {
  lastFocus = document.activeElement;
  el.overlay.classList.remove('hidden');
  document.body.classList.add('modal-open');
  refreshSettingsUi();
  el.btnSettingsClose.focus();
}

function closeSettings() {
  el.overlay.classList.add('hidden');
  document.body.classList.remove('modal-open');
  clearImport();
  render();
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

function refreshSettingsUi() {
  const s = SettingsManager.load();
  document.querySelectorAll('[data-quran-unit]').forEach((b) => {
    const on = b.dataset.quranUnit === s.quranUnit;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });
  document.querySelectorAll('#toggle-list input').forEach((i) => { i.checked = !!s[i.dataset.key]; });
  $('set-infaq-amount').checked = !!s.infaqAmount;
  $('row-currency').classList.toggle('hidden', !s.infaqAmount);
  $('set-currency').value = s.currency || '';
  $('backup-status').textContent = backupText();
}

function buildToggles() {
  $('toggle-list').replaceChildren(...ACTIVITIES.map((a) =>
    h('label', { class: 'toggle-item' },
      h('span', { text: a.label }),
      h('span', { class: 'switch' },
        h('input', { type: 'checkbox', 'data-key': a.key, 'aria-label': `Track ${a.label}` }),
        h('span', { class: 'switch-slider' })))));
}

function clearImport() {
  pendingImport = null;
  const rb = $('btn-replace');
  delete rb.dataset.armed;
  rb.textContent = 'Replace all';
  $('import-box').classList.add('hidden');
  $('import-actions').classList.add('hidden');
  $('file-import').value = '';
}

function showImportMsg(text, actions) {
  $('import-box').classList.remove('hidden');
  $('import-msg').textContent = text;
  $('import-actions').classList.toggle('hidden', !actions);
}

function applyImportedSettings(src) {
  if (!src) return;
  const D = SettingsManager.DEFAULTS;
  const next = SettingsManager.load();
  if (AmalStore.QURAN_UNITS.includes(src.quranUnit)) next.quranUnit = src.quranUnit;
  for (const k of Object.keys(D)) {
    if ((k.startsWith('show') || k === 'infaqAmount') && typeof src[k] === 'boolean') next[k] = src[k];
  }
  if (typeof src.currency === 'string') next.currency = src.currency.trim().slice(0, 8);
  SettingsManager.save(next);
}

function exportBackup() {
  const { lastBackup, ...settings } = SettingsManager.load();
  const blob = new Blob([JSON.stringify(AmalStore.buildExport(settings), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: `amal-yaumi-backup-${today()}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  SettingsManager.set('lastBackup', AmalStore.nowStamp());
  $('backup-status').textContent = backupText();
}

async function handleImportFile(file) {
  pendingImport = null;
  if (!file) return;
  if (file.size > 20 * 1024 * 1024) return showImportMsg('That file is too large to be a backup.', false);
  let text;
  try { text = await file.text(); } catch { return showImportMsg('Could not read that file.', false); }
  const res = AmalStore.parseBackup(text);
  if (res.error) return showImportMsg(res.error, false);
  if (!res.days.length) return showImportMsg('The backup contains no records.', false);
  pendingImport = res;
  const dates = res.days.map((d) => d.date).sort();
  showImportMsg(
    `Found ${res.days.length} day${res.days.length === 1 ? '' : 's'} (${fmtShortY(dates[0])} – ${fmtShortY(dates[dates.length - 1])})` +
    `${res.skipped ? `, ${res.skipped} unreadable entr${res.skipped === 1 ? 'y' : 'ies'} skipped` : ''}. ` +
    'Merge keeps the newest version of each day and your other days. Replace all erases the current records first and also restores the backup\'s settings.',
    true);
}

async function applyImport(mode) {
  if (!pendingImport) return;
  const { days, settings } = pendingImport;
  try {
    const n = await AmalStore.importDays(days, mode);
    if (mode === 'replace') applyImportedSettings(settings);
    const kept = days.length - n;
    clearImport();
    showImportMsg(`Imported ${n} day${n === 1 ? '' : 's'}` +
      (mode === 'merge' && kept ? `; ${kept} kept as they were (your copy was newer or identical).` : '.'), false);
    loadDay(state.date);
    refreshSettingsUi();
  } catch {
    showImportMsg('Import failed; nothing was changed in storage.', false);
  }
}

// ---------- PWA install ----------

let deferredInstallPrompt = null;
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function renderInstallRow() {
  const installed = isStandalone();
  el.installButton.classList.toggle('hidden', installed || !deferredInstallPrompt);
  const showHint = !installed && !deferredInstallPrompt && isIos();
  el.installHint.textContent = showHint ? 'On iPhone/iPad: tap Share, then “Add to Home Screen”.' : '';
  el.installHint.classList.toggle('hidden', !showHint);
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  renderInstallRow();
});
window.addEventListener('appinstalled', () => { deferredInstallPrompt = null; renderInstallRow(); });

function initSettingsPanel() {
  buildToggles();

  el.btnSettings.addEventListener('click', openSettings);
  el.btnSettingsClose.addEventListener('click', closeSettings);
  el.overlay.addEventListener('click', (e) => { if (e.target === el.overlay) closeSettings(); });

  el.overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') return closeSettings();
    if (e.key !== 'Tab') return;
    const f = [...el.panel.querySelectorAll('button, input:not([type=file]), a[href]')]
      .filter((n) => !n.disabled && n.offsetParent !== null && n.tabIndex !== -1);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  document.querySelectorAll('[data-quran-unit]').forEach((b) =>
    b.addEventListener('click', () => { SettingsManager.set('quranUnit', b.dataset.quranUnit); refreshSettingsUi(); }));
  $('toggle-list').addEventListener('change', (e) => {
    const k = e.target.dataset.key;
    if (k) SettingsManager.set(k, e.target.checked);
  });
  $('set-infaq-amount').addEventListener('change', (e) => {
    SettingsManager.set('infaqAmount', e.target.checked);
    refreshSettingsUi();
  });
  $('set-currency').addEventListener('input', (e) => SettingsManager.set('currency', e.target.value.trim().slice(0, 8)));

  $('btn-export').addEventListener('click', exportBackup);
  $('btn-import').addEventListener('click', () => $('file-import').click());
  $('file-import').addEventListener('change', (e) => {
    const f = e.target.files[0];
    e.target.value = ''; // allow re-selecting the same file
    handleImportFile(f);
  });
  $('btn-merge').addEventListener('click', () => applyImport('merge'));
  $('btn-replace').addEventListener('click', () => {
    const btn = $('btn-replace');
    if (!btn.dataset.armed) {
      btn.dataset.armed = '1';
      btn.textContent = `Erase ${AmalStore.all().length} current days and replace?`;
      return;
    }
    applyImport('replace');
  });
  $('btn-import-cancel').addEventListener('click', clearImport);

  el.installButton.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    renderInstallRow();
  });
  renderInstallRow();
}

async function loadAppVersion() {
  try {
    const res = await fetch('CHANGELOG.md');
    if (!res.ok) return;
    const match = (await res.text()).match(/^##\s*\[(\d+\.\d+\.\d+)\]/m);
    if (match) el.aboutVersion.textContent = `v${match[1]}`;
  } catch { /* offline and not cached yet */ }
}

// ---------- start ----------

(async function start() {
  initSettingsPanel();
  loadAppVersion();
  state.storageOk = await AmalStore.init();
  AmalStore.onExternalChange(() => {
    if (!state.day) return;
    const typing = document.activeElement && document.activeElement.tagName === 'INPUT';
    if (state.view === 'day' && typing) return; // don't disturb typing; refreshed on next navigation
    state.day = AmalStore.get(state.date);
    render();
  });
  loadDay(today());
  render();
})();
