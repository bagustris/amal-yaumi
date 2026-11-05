# Amal Yaumi

A small, private, offline daily worship log (static PWA, no build step, no accounts, no network use).
See [PLAN.md](PLAN.md) for the product principles: it is a logbook, not a score — no streaks, points or rankings.

## Run

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Features

- Five prayers with explicit states; "Not recorded" is never treated as missed.
- Rawatib / Dhuha / Witr rakaat, Quran (ayat, pages or minutes; unit stored per entry), fasting, infaq.
- Past days are editable; history shows factual totals only.
- Data is stored in IndexedDB on the device. **Export a JSON backup regularly** — clearing site data erases the log.

Deploy as plain static files (e.g. GitHub Pages).
