# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The version shown in the app's Settings → About panel is read from the latest
entry below (see `loadAppVersion()` in `js/app.js`), so this file is the single
source of truth for the app version.

## [0.4.3] - 2026-11-19

### Changed
- The prayer state "Not performed" is now labelled "Qadha".
- Rawatib quick-pick adds 14.
- Days with no record show real (unset) values in the editor instead of defaults; defaults apply once the day is logged.
- Tap a selected prayer state again to reset it.
- Calendar dot size is capped (6–12px) and the day's cell label reports the share of activities done.

### Fixed
- Summary and Trends count only explicitly recorded items again; editor defaults are display-only.
- History calendar crashed because `dotSize` was missing.
- "−" on an unset counter and re-tapping a default fasting/infaq button no longer create or touch a record.
- Settings are read once per summary/trends render instead of per record.
- Quran reading shows approximate equivalents (1 page = 2 minutes = 12 ayat) under the counter and as a combined total in the summary. Stored values are not converted.

## [0.4.2] - 2026-11-08

### Changed
- History calendar dots grow with the share of shown activities done that day.

## [0.4.1] - 2026-11-08

### Changed
- Prayers default to "Not performed", fasting to "Did not fast" and infaq to "Not done" (Witr and the other counters show 0). Defaults apply to untouched, shown items on a day you have logged (Quran reading shows 0 but is not counted by default); days with no record stay out of history and summaries.
- Removed the "Not recorded" prayer option; tap an active Fasted / Did not fast / Done / Not done button again to return to the default.

## [0.4.0] - 2026-11-08

### Changed
- Rawatib, Dhuha and Quran reading show 0 instead of "Not recorded" on an empty day (nothing is saved until you enter a value).
- "+" and "−" on Rawatib and Dhuha change the count by 2 rakaat per tap.
- New eight-point star in the app icon.

## [0.3.3] - 2026-11-06

### Added
- 20-page quick value for Quran reading.
- Change the reading unit directly on the Quran card (clears that day's value, since units can't be converted).

## [0.3.2] - 2026-11-06

### Fixed
- "Mosque jamaah" option in the prayer picker was white text on a light background.

## [0.3.1] - 2026-11-06

### Fixed
- Edits always apply to the latest copy of a day, so two open windows can't overwrite each other.
- Failed saves resync from storage instead of leaving unsaved data on screen.
- Import: accurate "imported" count, confirmation before "Replace all", backup records without a timestamp never override newer local data.
- Infaq amount length limit; corrupted settings no longer blank the screen; "This month" label shows the browsed month.

## [0.3.0] - 2026-11-06

### Added
- Ayat as a Quran reading unit (alongside pages and minutes), with its own totals and trend chart.

## [0.2.0] - 2026-11-06

### Added
- History → Trends: bar charts per day, week or month for prayers (stacked by status), rawatib, Dhuha, Witr, Quran, fasting and infaq; dashed average line; compare any period with the one before; per-prayer distribution. Averages use recorded days only and nothing is scored.

## [0.1.1] - 2026-11-06

### Removed
- Arabic text and Arabic fonts (header bismillah).

## [0.1.0] - 2026-11-05

### Added
- Today screen: five prayers (mosque jamaah / jamaah elsewhere / alone / not performed / not recorded), rawatib, Dhuha and Witr rakaat counters, Quran reading (pages or minutes), fasting with optional type, infaq with optional amount.
- `null` (not recorded) is kept distinct from an explicit zero throughout.
- Editable history calendar with neutral, factual summaries (week, month, all time).
- Settings: Quran unit, show/hide optional activities, infaq amount, JSON backup export and merge/replace import.
- Offline-capable PWA (IndexedDB storage, service worker, manifest, icons).
