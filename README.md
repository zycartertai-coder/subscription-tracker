# Subscription Tracker

Personal PWA for tracking recurring subscriptions on iPhone. Calendar reminders via per-subscription `.ics` exports. Data lives in `localStorage`; manual JSON export/import to Files / iCloud Drive is the durability path. Gist auto-sync is planned for v2.

See `docs/superpowers/specs/2026-05-16-subscription-tracker-design.md` for the full design.

## Local development

- Requires Node 20+.
- Run unit tests: `npm test`.
- Regenerate icons (after editing `tools/icon-source.svg`): `npm run icons`.
- Serve locally for a smoke test: `uv run --no-project python -m http.server 8000`, then open `http://localhost:8000/`.

## Deploy

1. Push to `main`.
2. In **Settings → Pages**, set Source = "Deploy from a branch", Branch = `main`, Folder = `/ (root)`.
3. Wait for the Pages build. Site URL appears in the Pages tab.

Whenever you change browser-side code, bump `CACHE_NAME` in `sw.js` so the service worker fetches the new shell.

## Install on iPhone

1. Open the site in Safari.
2. Share → "Add to Home Screen".
3. Open from the home screen so it runs in standalone mode.
4. Recommended: open the Calendar app and create a new calendar named "Subscriptions" first; use it as the destination when prompted by `.ics` downloads.

## Backup

This app stores everything in your iPhone's local Safari storage. If you clear Safari data, the data is gone. Use Settings → **Export JSON** to save a snapshot to the Files app (which auto-syncs to iCloud Drive). Recommended monthly. Restore via Settings → **Import JSON** → "Replace".

Auto-sync to a private GitHub Gist is planned for v2; see the design spec.

## Manual smoke test (run after every deploy)

- [ ] Open the site in Safari. List view loads with totals (£0 /mo if empty).
- [ ] Tap "+". Form opens. Fill all fields, including a URL. Save.
- [ ] Row appears with the correct relative time and a "↗" link icon.
- [ ] Tap the toast "Add". An `.ics` file downloads and prompts you to add to a Calendar; pick the "Subscriptions" calendar.
- [ ] In Calendar, the event appears on the next payment date with an alarm at the right offset.
- [ ] Edit the subscription, change the amount, Save → "Update" toast → re-download `.ics`. The existing Calendar event updates (same UID).
- [ ] Delete the subscription → "Remove" toast → import the CANCEL `.ics`. Calendar event is removed.
- [ ] Settings → Export JSON. File saves to Files / iCloud Drive.
- [ ] Force-quit Safari, clear site data, reopen → empty state. Settings → Import JSON → pick the exported file → "Replace" → data restored.
- [ ] Import a second copy with "Merge" instead of "Replace" → no duplicates.
- [ ] Toggle airplane mode → app still works fully (no network calls expected in v1).
