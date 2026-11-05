# CLAUDE.md

This file provides guidance to Claude Code when working with code in this
repository. Family-wide conventions (three-bar settings dialog, CSS design
tokens, storage-key naming, CHANGELOG/service-worker rules) live in the
parent `github/CLAUDE.md` — this file documents only what's specific to
**Amal Yaumi**.

## What this is

Amal Yaumi — a private, offline daily worship log (prayers, sunnah
rakaat, Quran, fasting, infaq). Product rules live in `PLAN.md`; the key ones:
`null` = not recorded vs `0` = explicit zero, no scores/streaks, Quran unit is
stored per entry.

## Commands

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Architecture

```
index.html       Markup, settings dialog, script order
js/storage.js    AmalStore: date keys, sanitizeDay validation, IndexedDB, backup parse/import
js/settings.js   SettingsManager — prefs (localStorage: amal-yaumi-settings)
js/app.js        Day editor, history/summary, settings wiring (event delegation on #app)
sw.js            Service worker; CORE_ASSETS must mirror index.html; bump CACHE_VERSION on any change
```

Gotchas: all records are cached in memory and written through to IndexedDB; empty days are
deleted. Don't re-render on input `change` (swallows +/− taps). Dates are always local-time keys.
