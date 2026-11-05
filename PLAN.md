# amal-yaumi — Product Plan

**Product:** A minimal, mobile-first, offline-capable personal worship log  
**Platform:** Static Progressive Web App (PWA)  
**Primary use case:** Record daily prayers and selected acts of worship in a few seconds.

## 1. Product principle

The app is a **private logbook, not a spiritual scorecard**. It should make recording and reviewing simple without implying that more entries, longer streaks, or higher totals make a person more religious.

Design priorities, in order:

1. Fast entry on a smartphone.
2. Clear distinction between *not recorded* and *recorded as none / not performed*.
3. Private, local-first data with reliable backup and restore.
4. Simple history and factual summaries.
5. No unnecessary religious content, social features, or gamification.

## 2. Review of similar apps

Reviewed public app descriptions and product pages on **5 November 2026**. Features can change between versions and regions.

| App | Relevant patterns | What amal-yaumi should learn |
|---|---|---|
| [Muhasaba](https://apps.apple.com/id/app/muhasaba-muslim-habit-tracker/id6769870766) | Daily, weekly and monthly deeds; count-based quick taps; reorderable Today list; custom categories; history; private notes; offline use and a single-file backup/restore. | Closest product reference. Adopt quick entry, flexible ordering later, and especially local backup/restore. Do not copy its challenges and streak emphasis into the MVP. |
| [Ihsaan](https://apps.apple.com/id/app/ihsaan-muslim-habit-tracker/id6802082681) | Prayer states; Sunnah prayers including Duha, Tahajjud and Witr; Quran by pages or minutes; fasting categories; weekly/monthly history; optional reflection; ability to pause practices. | Good reference for the breadth of worship data. Keep the useful distinction between Quran units and optional fasting types, but avoid copying every feature. |
| [BetterMuslim](https://bettermuslim.net/) | Users choose which deeds to track during onboarding; the home screen groups activities into commitments. Its screenshots also show a completion ring and multi-tab navigation. | Adopt activity selection and grouping. Avoid the completion ring, lantern/streak gamification, and multi-tab complexity for this small tracker. |
| [Everyday Muslim](https://www.everydaymuslim.app/) | Five-prayer-centered home screen; Sunnah routines; weekly progress and history; habits can be scheduled for particular days; prayer groups and widgets. | Keep the five prayers visually first. Scheduled/custom routines may be useful later, but group tracking is out of scope. |
| [Hasanat](https://play.google.com/store/apps/details?id=com.oriventstudios.hasanat) | Daily deed timeline grouped around prayer intervals; reusable deed library; custom habits; configurable prayer calculation; local backup. | Prayer-time grouping and a deed library are optional future directions, not MVP requirements. |

### Best practices to adopt

- **A focused Today screen:** make today's log the default landing page.
- **User-selected activities:** do not force every user to track every possible deed.
- **Quick counters:** provide a few common values and simple increment/decrement controls.
- **History that is easy to correct:** past entries must be editable.
- **Local-first privacy:** avoid accounts and network transmission in the first version.
- **Backup and restore:** make it visible and test it; offline storage alone is not a backup.
- **Neutral progress display:** show records and totals, not a weighted worship score or public ranking.
- **Navigation proportional to scope:** this app needs Today, History, and Settings—not a five-tab navigation bar for features it does not provide.

## 3. Tracking model and corrections

### 3.1 Five obligatory prayers

The original `O / X / triangle` idea is compact but ambiguous unless each symbol has a fixed meaning. In particular, `X` could mean prayed alone, missed, or simply not entered.

Use four explicit states:

| Stored value | UI label | Meaning |
|---|---|---|
| `mosque_jamaah` | Mosque jamaah | Performed in congregation at a mosque |
| `other_jamaah` | Jamaah elsewhere | Performed in congregation outside a mosque |
| `alone` | Alone | Performed individually |
| `not_performed` | Not performed | User explicitly records that the prayer was not performed |
| `null` | Not recorded | No status has been entered |

This preserves the user's distinction between congregation at a mosque and congregation elsewhere, while avoiding the mistake of interpreting an empty field as a missed prayer. Use text labels in the selection UI; symbols may supplement them but must not carry the meaning alone.

**Do not add prayer-time calculation, on-time/late classification, or qada tracking to the MVP.** Those introduce additional definitions and decisions that the user has not asked to track. They can be considered later as separate fields, not folded into the meaning of the four states above.

**Mobile interaction:** each prayer occupies one compact row showing its name and current state (initially `Not recorded`). Tapping the state expands an inline choice panel for that prayer. Do not place four full-width buttons beside every prayer name; that layout is too wide for a phone. Keep only one row expanded at a time. A user should be able to set a status in no more than two taps.

### 3.2 Rawatib

For the MVP, track the **total rakaat** of rawatib completed that day. A total is fast to enter, but it does not preserve which prayers' rawatib were performed.

- Start as `Not recorded`, not `0`.
- Provide quick values and a custom integer entry.
- Use a simple counter; do not hard-code one prescribed pattern or maximum.
- Consider a per-prayer breakdown only if the user later finds the daily total insufficient.

### 3.3 Dhuha and Witr

Track rakaat as integer counts, separately. Start as `Not recorded`; an explicit `0` means the user recorded none. Offer common quick values plus custom entry. Do not assume the same increment pattern for all three counters: Witr counts may be odd, so the generic counter must support increments of one.

### 3.4 Quran

Ayat, pages and minutes are different measurements; never combine or convert them into one unlabeled total. Ayat is the gentlest unit for beginners who read with translation and tafsir.

- Choose one default unit in Settings: **ayat**, **pages** or **minutes**.
- Start each day's value as `Not recorded`; `0` is an explicit zero.
- Store the unit with each daily entry. Changing the setting must not reinterpret historical records.
- Do not require more than one unit.

For this MVP, this field means Quran reading. Audio listening can be added later as a separate activity rather than being silently counted as reading.

### 3.5 Fasting

Use `Fasted`, `Did not fast`, and `Not recorded`. Add an optional type only when `Fasted` is selected, such as `Ramadan`, `Qada`, `Sunnah`, or `Other`. The type is descriptive, not a religious ruling. Do not ask for a reason when the user records that they did not fast.

Fasting is not necessarily a daily commitment. Do not treat every unrecorded day as a failure or assume the user intended to fast every day.

### 3.6 Infaq

Use `Done`, `Not done`, and `Not recorded`. An amount may be entered optionally after `Done`, but it must not be required. Keep amount tracking off or visually secondary by default. Do not require the recipient, purpose, or a note.

Treat this as the user's personal infaq log; do not imply that it covers every form of sadaqah or other charitable act.

## 4. MVP scope

| Activity | Input | Initial state |
|---|---|---|
| Subuh, Zuhur, Asar, Maghrib, Isya | Mosque jamaah / jamaah elsewhere / alone / not performed | Not recorded |
| Rawatib | Total rakaat | Not recorded |
| Dhuha | Rakaat | Not recorded |
| Witr | Rakaat | Not recorded |
| Quran reading | Ayat, pages **or** minutes | Not recorded |
| Fasting | Fasted / did not fast; optional type | Not recorded |
| Infaq | Done / not done; optional amount | Not recorded |

### Most beneficial addition: configurable activity visibility

Allow users to hide optional activities they do not want to track (for example, infaq or fasting) and show the ones they do. Keep the five obligatory prayers fixed at the top. This adopts a strong pattern from existing trackers: users should not have to complete a checklist that does not represent their own commitments.

For the MVP, use a small Settings screen with:

- Quran unit (ayat, pages or minutes).
- Show/hide optional activities.
- Optional infaq amount (on/off).
- Data export and import.

Do not add a large custom-habit builder yet.

## 5. Mobile-first interaction design

### Today screen

1. Date and a small History control at the top.
2. Five obligatory prayers first, in their normal order.
3. Sunnah prayer counters below.
4. Quran, fasting, and infaq below that.
5. A compact save/backup status, not a score or completion percentage.

Suggested wireframe:

```text
amal-yaumi                         [History]

Today · [date]

PRAYERS
Subuh       [Not recorded ▾]
Zuhur       [Mosque jamaah ▾]
Asar        [Alone ▾]
Maghrib     [Not recorded ▾]
Isya        [Not recorded ▾]

SUNNAH PRAYERS
Rawatib     [−]  Not recorded  [+]
Dhuha       [−]  Not recorded  [+]
Witr        [−]  Not recorded  [+]

QURAN READING
[−]  Not recorded pages  [+]

OTHER
Fasting     [Fasted] [Did not fast]
Infaq       [Done] [Not done]

[Saved locally]
```

The wireframe is conceptual. Use an inline selector for prayer states and a tap-friendly numeric input for rakaat. On small screens, do not cram all prayer options into a single horizontal row. Keep buttons comfortably large and show selected states with both text and visual styling.

### Interaction rules

- Save changes immediately; show a subtle `Saved locally` indication.
- Make previous dates editable.
- Make `Not recorded` visually distinct from explicit zero, `Not performed`, and `Not done`.
- No modal dialog for simple numeric changes.
- Avoid auto-filling a value based on time or assuming an activity was completed.
- Do not make color the only way to identify a state.

## 6. History and summaries

### MVP history

- Calendar or chronological list of previous days.
- Tap a date to view and edit that day's entries.
- Show unrecorded entries as unrecorded, not missed.

### Useful factual summaries

- Prayer counts by recorded status over a chosen period.
- Total rawatib, Dhuha, and Witr rakaat, with the period shown.
- Quran total, clearly labeled with its unit.
- Number of recorded fasting days, optionally grouped by type.
- Number of infaq days; total amount only when the user enabled amount tracking.

Do not calculate a combined `amal score`. Avoid default streaks, red/green failure calendars, leaderboards, and comparisons with other people. A neutral history is more useful than a judgmental progress display.

## 7. Data model

Store one record per local calendar day. Example:

```json
{
  "schema_version": 1,
  "date": "2026-11-05",
  "prayers": {
    "subuh": "mosque_jamaah",
    "zuhur": "other_jamaah",
    "asar": "alone",
    "maghrib": null,
    "isya": null
  },
  "rawatib_rakaat": 4,
  "dhuha_rakaat": null,
  "witir_rakaat": 3,
  "quran": {
    "unit": "pages",
    "value": 5
  },
  "fasting": {
    "status": "fasted",
    "type": "sunnah"
  },
  "infaq": {
    "done": true,
    "amount": null,
    "currency": null
  },
  "updated_at": "2026-11-05T20:15:00+09:00"
}
```

Data rules:

- `null` means **not recorded**. Numeric `0` means the user explicitly recorded zero.
- Prayer status is one of `mosque_jamaah`, `other_jamaah`, `alone`, `not_performed`, or `null`.
- Fasting status is `fasted`, `did_not_fast`, or `null`.
- Infaq `done` is `true`, `false`, or `null`.
- Numeric counts must be non-negative integers.
- Quran `unit` is stored with each entry so settings changes do not alter old records.
- Use a stable `YYYY-MM-DD` key in the user's local timezone. Do not derive the calendar date from UTC; that can shift an entry to the previous or next day.
- Keep `schema_version` so future releases can migrate backup files safely.

## 8. Technical approach

- Static HTML/CSS/JavaScript PWA; no backend required.
- Use IndexedDB for structured records and future schema changes. `localStorage` is acceptable only for a disposable prototype.
- Use a service worker to cache the app shell so the app can reopen offline after its first successful load.
- Include a web app manifest, app icons, and a simple install explanation.
- Export all data to one versioned JSON file; support restoring from that file. Validate the file before replacing existing data and offer a safe merge or overwrite choice.
- Consider CSV export later for spreadsheet analysis; JSON backup/restore is more important for the MVP.
- No account, analytics, ads, or network transmission by default.
- Clearly explain that local data can be lost if browser/site data is cleared or the device is lost. Encourage periodic export.
- Do not promise reliable background reminders or alarm behavior from a static PWA. Notifications and platform behavior vary, and reminders are not necessary for the core tracker.
- Test installed and browser modes on Android and iOS, including offline reload, data persistence, import, and export.

## 9. Out of scope

Do not add these to the first release:

- Prayer-time calculations, adhan alarms, or automatic prayer status.
- Qibla compass, Quran reader/audio, hadith, dua, or adhkar library.
- Custom activity builder or a large Amal library.
- Cloud sync, accounts, family groups, social sharing, or public profiles.
- Challenges, points, badges, streak pressure, or an overall worship score.
- Prayer punctuality, qada, or detailed rawatib breakdown. Revisit only when there is a clear user need and define these as separate data fields.

## 10. Implementation order

### Phase 1 — Reliable core

1. Today screen and local date handling.
2. Five prayer statuses with explicit `Not recorded` state.
3. Rakaat counters with `null` versus `0` semantics.
4. Quran unit setting (ayat/pages/minutes).
5. Fasting and infaq toggles.
6. Immediate local save using IndexedDB.
7. History and editing of past days.
8. Versioned JSON export/import.
9. PWA manifest, service worker, and offline app shell.

### Phase 2 — Refinements

- Weekly/monthly factual summaries.
- Optional infaq amount.
- CSV export.
- Reordering activities and user-defined quick counter values.
- Optional scheduled habits (for example, a weekly practice), if needed.

## 11. Acceptance criteria

The MVP is ready when:

- A prayer can be recorded in at most two taps without horizontal overflow on a phone.
- Mosque jamaah, jamaah elsewhere, alone, not performed, and not recorded are unambiguous.
- A blank numeric field is distinguishable from an explicit zero.
- Quran totals never mix pages and minutes.
- Fasting and infaq are optional records, not assumed daily obligations.
- A user can hide optional activities they do not track.
- Changes save immediately and survive app closure/reopening.
- Previous dates can be viewed and edited.
- JSON backup can be exported and restored on a fresh browser profile without losing data.
- The app works offline after its first successful load.
- The main screen is usable at smartphone widths, with accessible labels and touch targets.

## 12. Main product decision

Do not try to become an all-in-one Islamic app. The strongest positioning is a **small, private amal log**: five prayer records, a few simple counters, Quran reading, fasting, and infaq. Borrow the quick-entry, user-selected activities, history, and backup patterns from existing apps—but keep the interface and scope substantially smaller.
