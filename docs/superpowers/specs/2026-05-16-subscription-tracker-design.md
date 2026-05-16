# Subscription Tracker — Design

**Date:** 2026-05-16
**Status:** Approved for implementation planning
**Owner:** alexander.darch@gresearch.co.uk

## 1. Goal

A personal Progressive Web App (PWA) installed on the owner's iPhone that tracks recurring subscriptions and reminds the owner before each payment is taken. Reminders are delivered through Apple Calendar via per-subscription `.ics` exports, so the app needs no push-notification backend. Data is held in `localStorage` for offline-first use and auto-synced to a private GitHub Gist for off-device durability, with a manual JSON export/import as a final fallback.

## 2. Scope

### v1 (this spec)

- Add, edit, delete subscriptions with the fields in §4.
- List view with monthly/yearly total in the owner's currency (GBP, single-currency only).
- Per-subscription "Add/Update/Remove Calendar reminder" via `.ics` download.
- Auto-sync of the full data document to a private GitHub Gist using a user-provided personal access token (PAT) with `gist` scope.
- Manual JSON export and import.
- Installable PWA with offline app-shell caching.

### Out of scope for v1

- **Bank account linking / Open Banking.** Deferred to v2; see §12.
- Multi-user, multi-device real-time sync, accounts, login.
- Multi-currency. Single currency only (GBP).
- Push notifications. Reminders go through Apple Calendar only.
- Native mobile build, App Store distribution.
- Spend analytics beyond the monthly/yearly total.
- Trial-to-paid auto-conversion logic beyond a single "trial ends" reminder.

## 3. Architecture

Static site served by GitHub Pages from this repository. No backend, no runtime npm dependencies. All application logic ships as ES modules. The browser is the only runtime.

```
iPhone Safari (PWA)
  ├─ Working copy in localStorage (source of truth at runtime)
  ├─ Generates .ics files → Apple Calendar (reminders)
  └─ Auto-syncs JSON document → private GitHub Gist (durability)
                                       │
                                       └─ Manual export/import to Files/iCloud Drive (fallback)
```

Failure isolation: the app keeps working fully offline if either GitHub or the network is unavailable; sync queues and retries.

## 4. Data model

A single JSON document represents the entire app state. The same shape is used for `localStorage`, gist contents, and export files.

```js
{
  "version": 1,
  "updatedAt": "2026-05-16T10:23:00Z", // max of all child updatedAt values; used by sync
  "settings": {
    "currency": "GBP",
    "defaultReminderDays": 2,
    "gistId": "abc123…",         // populated after first sync
    "tokenHint": "ghp_…last4",   // display-only; full token in localStorage under a separate key
    "sync": {
      "lastPushedAt": null,                // local timestamp of last successful push
      "lastFetchedRemoteUpdatedAt": null   // document.updatedAt observed on the last successful fetch
    },
    "updatedAt": "2026-05-16T10:23:00Z"
  },
  "subscriptions": [
    {
      "id": "uuid-v4",
      "name": "Netflix",
      "amount": 12.99,
      "frequency": "monthly",        // monthly | yearly | weekly | custom-days
      "customIntervalDays": null,    // required iff frequency === "custom-days"
      "nextPaymentDate": "2026-06-01",
      "category": "Entertainment",   // freeform, autocomplete from prior entries
      "paymentMethod": "Visa •1234", // freeform, autocomplete from prior entries
      "notes": "Shared with partner",
      "trialEndDate": null,          // optional ISO date for one-off trial-end reminder
      "reminderDaysBefore": 2,       // overrides settings.defaultReminderDays
      "icsSequence": 0,              // bumped on every edit; written into .ics SEQUENCE
      "createdAt": "2026-05-16T10:23:00Z",
      "updatedAt": "2026-05-16T10:23:00Z"
    }
  ]
}
```

Notes:

- **Monthly equivalent for totals is computed, not stored:** `yearly → amount/12`, `weekly → amount × 52/12`, `custom-days → amount × 30/customIntervalDays`.
- **Trial end date** generates a separate one-off `VEVENT` distinct from the recurring renewal event.
- **Categories and payment methods are freeform strings** with autocomplete sourced from existing entries — avoids a fixed taxonomy while keeping consistency.
- **Deletes are hard deletes.** No tombstones, no history in v1.
- **Root `updatedAt`** is recomputed by the store on every mutation as the maximum of `settings.updatedAt` and every `subscriptions[].updatedAt`. The sync layer compares document-level `updatedAt` values, not the gist's metadata `updated_at`.
- **PAT** is stored under a separate `localStorage` key (`subtracker.gistToken`), not in this document, so exports and gist contents never contain the token.

## 5. Screens / UX

Single-page app with hash-based routing. Four logical screens, mobile-first, single column:

### 5.1 List / Home (`#/`)

- Top bar: monthly total (e.g. "£42.86 /mo · £514.32 /yr") and a settings cog.
- Sorted list of subscriptions; each row shows name, amount + frequency, next payment date with relative time ("in 4 days"), and a small category chip.
- Rows are tinted amber if a payment is within `reminderDaysBefore`, red if today or overdue.
- Floating "+" button bottom-right opens `#/new`. Safe-area inset respected so it does not sit under the iOS home indicator.

### 5.2 Add / Edit (`#/new`, `#/edit/<id>`)

- Form covering every field in §4.
- "Save" button; after save, returns to the list with a toast offering "Add to Calendar" (new) / "Update Calendar reminder" (edit). See §6.
- "Delete" button on edit screen with a confirm.

### 5.3 Settings (`#/settings`)

- Default currency (locked to GBP in v1; visible so the constraint is clear).
- Default reminder lead time (days).
- **Gist sync:** "Connect GitHub" / paste-token flow, connection status, "Sync now", "Disconnect", last-synced timestamp.
- **Export JSON / Import JSON** (manual fallback).

### 5.4 No separate "detail" view

Tapping a row opens the Edit screen directly; the form serves as the detail view.

## 6. Calendar export flow

The app generates per-subscription `.ics` files. Apple Calendar handles all notification scheduling.

### 6.1 .ics shape

- Recurring `VEVENT` with `RRULE` matching the frequency (`FREQ=MONTHLY`, `FREQ=YEARLY`, `FREQ=WEEKLY`, or `FREQ=DAILY;INTERVAL=N` for `custom-days`).
- `DTSTART` = next payment date.
- A `VALARM` firing `reminderDaysBefore` days before each occurrence.
- `UID` = the subscription's UUID, so re-imports update the same calendar event.
- `SEQUENCE` = the subscription's `icsSequence`, bumped on every edit before generating the `.ics`.
- `SUMMARY` = "<name> – <currency><amount>"; `DESCRIPTION` = notes plus a deep link back to the PWA edit screen.
- For subscriptions with `trialEndDate`, a second one-off `VEVENT` with no `RRULE` and `UID` = `trial-<subscription-id>`.

### 6.2 User flow

1. **Create:** save a subscription → toast "Saved. Add reminders to Calendar?" → tap → download `.ics` → iOS prompts to add to a chosen calendar.
2. **Edit:** the store bumps `icsSequence` on save. The toast offers "Update Calendar reminder?" → tap downloads an `.ics` with the same `UID` and the bumped `SEQUENCE`. Apple Calendar treats this as an update of the existing event.
3. **Delete:** toast offers "Remove Calendar reminder?" → downloads a `METHOD:CANCEL` `.ics`, which Apple Calendar treats as a cancellation.
4. **Re-export:** the Edit screen has a persistent "Re-export to Calendar" button for manual resync.

### 6.3 Caveats surfaced in UI

- `METHOD:REQUEST` updates and `METHOD:CANCEL` are reliable on Apple Calendar but not bulletproof in every case. The Settings screen and first-run onboarding include a note: "If a calendar event ever gets out of sync, delete it manually and re-add from the subscription."
- Onboarding recommends creating a dedicated "Subscriptions" calendar in Apple Calendar before first use so reminders are grouped and easy to remove en masse.

## 7. Sync to private GitHub Gist

### 7.1 Setup (one-time)

1. Settings → "Connect GitHub" shows step-by-step instructions for creating a fine-grained PAT with `gist` scope only.
2. User pastes the PAT. The app creates a new private gist containing a single file `subscription-tracker.json` with the current data document.
3. The app stores the PAT in `localStorage` and the gist ID in `settings.gistId`. Only the last four characters of the token are displayed thereafter.

### 7.2 Runtime behaviour

- **On load**, if a token + gist ID exist: fetch the gist file `subscription-tracker.json`. Compare the document-level `updatedAt` inside it against the local document's `updatedAt`. If remote is newer, pull and overwrite local. Otherwise use local.
- **On every change** (add / edit / delete / settings change): write to `localStorage` immediately, then debounce a 2-second push to the gist so a flurry of edits results in one network call. On a successful push, set `settings.sync.lastPushedAt` to now and `settings.sync.lastFetchedRemoteUpdatedAt` to the just-pushed `updatedAt`.
- **Dirty flag:** local has unpushed changes iff `document.updatedAt > settings.sync.lastPushedAt`.
- **Status indicator** in the top bar: grey (not connected — no token), green (synced), amber (pending push), red (last push failed; tap to retry).
- **"Sync now"** in Settings forces an immediate push and pull.

### 7.3 Conflict model: last-write-wins

The app is designed for one user on one phone. We do not build merge logic. On load, if the fetched remote `updatedAt` is newer than `settings.sync.lastFetchedRemoteUpdatedAt` **and** the dirty flag is set (local has unpushed changes), we surface a one-time dialog: "Remote is newer than your last sync. Keep local or use remote?" — explicit manual resolution.

### 7.4 Security posture

- The PAT is stored in plain `localStorage`. Anyone with physical access to the unlocked phone and Safari devtools could read it. Acceptable for personal use; flagged in onboarding.
- The PAT carries `gist` scope only. Worst-case leak exposes the user's private gists; no other GitHub account scope is reachable.
- Private gists are unlisted but not access-controlled. The gist URL is therefore treated as a secret: never logged, never shown in error messages.

### 7.5 Failure modes

- **Network offline:** queue the push; retry on next save and on the `online` event.
- **Token revoked / 401:** red dot, persistent error toast, link to re-paste.
- **Gist deleted on GitHub.com / 404:** prompt to recreate; on confirm, create a fresh gist and update `settings.gistId`.

## 8. Manual export / import (fallback)

A belt-and-braces path in case the gist is lost or the token is revoked.

- **Export JSON:** downloads the full document as `subscriptions-YYYY-MM-DD.json`. iOS Safari hands this to the Files app; the user saves it to iCloud Drive.
- **Import JSON:** file picker; on selection, asks "Replace all data, or merge?". Replace wipes and loads. Merge upserts by `id` — existing IDs are overwritten, new IDs appended.
- Onboarding nudges the user to export once a month, but no enforcement.

## 9. PWA specifics

- `manifest.webmanifest` with name, short name, theme colour, icons (192, 512, plus maskable variants), `display: standalone`, `start_url: "."`.
- A service worker pre-caches the app shell (HTML/CSS/JS) and serves it offline. Data lives in `localStorage` so the app is fully functional offline; only gist sync needs network, and it queues.
- Icons generated in-repo by `tools/make-icons.js` from a single SVG (calendar-with-bell motif) so they are regeneratable.
- Service-worker cache name includes a build hash; bumped on each deploy to force-refresh.
- On first visit in browser mode (`display-mode: browser`), show an "Add to Home Screen" tip.

## 10. Code structure

Single-page app, no bundler, no transpiler, no runtime npm dependencies. ES modules served as-is by GitHub Pages.

```
/
├── index.html
├── manifest.webmanifest
├── sw.js
├── styles/
│   └── app.css
├── src/
│   ├── app.js              # entry, router, mount
│   ├── store.js            # data document, getters, mutations, persistence to localStorage
│   ├── sync.js             # gist push/pull, debounce, status
│   ├── ics.js              # generate .ics for create/update/cancel
│   ├── totals.js           # monthly-equivalent math
│   ├── ui/
│   │   ├── list.js
│   │   ├── form.js
│   │   ├── settings.js
│   │   └── components.js   # toast, chip, button, etc.
│   └── lib/
│       ├── dom.js          # tiny h() helper, no framework
│       └── date.js         # ISO + relative time
├── tests/                  # see §11
├── tools/
│   └── make-icons.js
└── docs/superpowers/specs/2026-05-16-subscription-tracker-design.md
```

## 11. Testing

Per the user's standing rule, Red/Green TDD is required for all feature development.

- Pure-logic modules — `store`, `sync`, `ics`, `totals`, `lib/date` — have no DOM dependencies and are unit-tested under Node using the built-in `node:test` runner. No test framework dependency.
- UI modules are deliberately kept thin (rendering and event wiring only). Anything with branching logic is pushed down into a testable pure module.
- `sync` is tested against a stub `fetch` so tests never hit GitHub.
- On-device verification of the full flow (install to home screen, .ics import to Apple Calendar, notification firing) is documented as a manual test pass before each release.

## 12. v2 backlog

- **Bank account linking via Open Banking.** Likely route: GoCardless Bank Account Data API (free in UK/EU for personal use), Cloudflare Workers backend to hold OAuth tokens, 90-day re-consent UX. Auto-suggest recurring transactions as candidate subscriptions.
- Possible interim step: CSV import from bank statements with recurring-transaction detection.
- Multi-currency support with FX conversion for the dashboard.
- Push notifications via Web Push (server cron + subscription) for users who don't want calendar reminders.
- Spend analytics: category breakdowns, month-over-month change.
- Multi-device real-time sync via a proper backend.

## 13. Open questions

None at time of approval. Any issues uncovered during planning will be reflected back into this document before implementation begins.
