# Subscription Tracker — Design

**Date:** 2026-05-16
**Status:** Approved for implementation planning
**Owner:** alexander.darch@gresearch.co.uk

## 1. Goal

A personal Progressive Web App (PWA) installed on the owner's iPhone that tracks recurring subscriptions and reminds the owner before each payment is taken. Reminders are delivered through Apple Calendar via per-subscription `.ics` exports, so the app needs no push-notification backend. Data is held in `localStorage` for offline-first use, with a manual JSON export/import to Files / iCloud Drive as the durability path.

## 2. Scope

### v1 (this spec)

- Add, edit, delete subscriptions with the fields in §4.
- List view with monthly/yearly total in the owner's currency (GBP, single-currency only).
- Per-subscription "Add/Update/Remove Calendar reminder" via `.ics` download.
- Manual JSON export and import (Files / iCloud Drive as durability path).
- Installable PWA with offline app-shell caching.

### Out of scope for v1

- **Auto-sync to a private GitHub Gist.** Deferred to v2; see §12. v1 relies on the manual JSON export/import path for off-device backup.
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
  └─ Manual JSON export/import → Files / iCloud Drive (durability)
```

Failure isolation: the app works fully offline. The network is needed only for the initial load of the static site and for service-worker updates; nothing in v1 makes outbound API calls at runtime.

## 4. Data model

A single JSON document represents the entire app state. The same shape is used for `localStorage` and JSON export files.

```js
{
  "version": 1,
  "updatedAt": "2026-05-16T10:23:00Z", // max of all child updatedAt values; reserved for v2 sync
  "settings": {
    "currency": "GBP",
    "defaultReminderDays": 2,
    "updatedAt": "2026-05-16T10:23:00Z"
  },
  "subscriptions": [
    {
      "id": "uuid-v4",
      "name": "Netflix",
      "amount": 12.99,
      "url": "https://example.com/account",  // optional — link to the merchant's account / management page
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
- **`url`** is optional. When present, it appears as a tappable "Open account" link on the Edit screen, as a small link icon on the List row, and as a `URL` property inside the generated `.ics` so Apple Calendar shows it on the event.
- **Root `updatedAt`** is recomputed by the store on every mutation as the maximum of `settings.updatedAt` and every `subscriptions[].updatedAt`. It is retained for v2's auto-sync (it tells a remote sync layer whether anything has changed) and is harmless in v1.

## 5. Screens / UX

Single-page app with hash-based routing. Four logical screens, mobile-first, single column:

### 5.1 List / Home (`#/`)

- Top bar: monthly total (e.g. "£42.86 /mo · £514.32 /yr") and a settings cog.
- Sorted list of subscriptions; each row shows name, amount + frequency, next payment date with relative time ("in 4 days"), a small category chip, and — when `url` is set — a small link icon that opens the merchant page in a new tab without entering Edit.
- Rows are tinted blue if a payment is within `reminderDaysBefore`, pink if today or overdue.
- Floating "+" button bottom-right opens `#/new`. Safe-area inset respected so it does not sit under the iOS home indicator.

### 5.2 Add / Edit (`#/new`, `#/edit/<id>`)

- Form covering every field in §4: name, amount, `url`, frequency (+ custom interval days when applicable), next payment date, category, payment method, notes, trial end date, reminder lead time.
- The `url` field is a single-line text input with `inputmode="url"` and basic validation (must be empty or start with `http://` / `https://`). When set, the Edit screen shows an "Open account" link below the field that opens the URL in a new tab.
- "Save" button; after save, returns to the list with a toast offering "Add to Calendar" (new) / "Update Calendar reminder" (edit). See §6.
- "Delete" button on edit screen with a confirm.

### 5.3 Settings (`#/settings`)

- Default currency (locked to GBP in v1; visible so the constraint is clear).
- Default reminder lead time (days).
- **Export JSON / Import JSON** (Files / iCloud Drive durability path).

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
- `URL` = subscription's `url` field (when set), so Apple Calendar shows a tappable link on the event.
- For subscriptions with `trialEndDate`, a second one-off `VEVENT` with no `RRULE` and `UID` = `trial-<subscription-id>`.

### 6.2 User flow

1. **Create:** save a subscription → toast "Saved. Add reminders to Calendar?" → tap → download `.ics` → iOS prompts to add to a chosen calendar.
2. **Edit:** the store bumps `icsSequence` on save. The toast offers "Update Calendar reminder?" → tap downloads an `.ics` with the same `UID` and the bumped `SEQUENCE`. Apple Calendar treats this as an update of the existing event.
3. **Delete:** toast offers "Remove Calendar reminder?" → downloads a `METHOD:CANCEL` `.ics`, which Apple Calendar treats as a cancellation.
4. **Re-export:** the Edit screen has a persistent "Re-export to Calendar" button for manual resync.

### 6.3 Caveats surfaced in UI

- `METHOD:REQUEST` updates and `METHOD:CANCEL` are reliable on Apple Calendar but not bulletproof in every case. The Settings screen and first-run onboarding include a note: "If a calendar event ever gets out of sync, delete it manually and re-add from the subscription."
- Onboarding recommends creating a dedicated "Subscriptions" calendar in Apple Calendar before first use so reminders are grouped and easy to remove en masse.

## 7. Off-device sync — deferred to v2

Auto-sync to a private GitHub Gist was originally scoped for v1 but is now deferred to v2 (see §12) to keep the first ship minimal. In v1 the only off-device durability path is the manual JSON export/import described in §8.

When v2 picks this up, the broad design intent is: a user-supplied fine-grained PAT with `gist` scope only, a private gist holding `subscription-tracker.json`, a 2-second debounced push on every change, last-write-wins conflict handling against `document.updatedAt`, and the same status indicator pattern (grey / green / amber / red) in the top bar. The detailed mechanics will be re-specified at the time, alongside whether to discover an existing gist on connect or always create a new one.

## 8. Manual export / import (durability path)

In v1 this is the only off-device backup path.

- **Export JSON:** downloads the full document as `subscriptions-YYYY-MM-DD.json`. iOS Safari hands this to the Files app; the user saves it to iCloud Drive, where it auto-syncs across the user's Apple devices.
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

- Pure-logic modules — `store`, `ics`, `totals`, `lib/date` — have no DOM dependencies and are unit-tested under Node using the built-in `node:test` runner. No test framework dependency.
- UI modules are deliberately kept thin (rendering and event wiring only). Anything with branching logic is pushed down into a testable pure module.
- v1 makes no outbound API calls at runtime, so there is nothing network-shaped to stub.
- On-device verification of the full flow (install to home screen, .ics import to Apple Calendar, notification firing) is documented as a manual test pass before each release.

## 12. v2 backlog

- **CSV import from bank statements (primary v2 feature).** User exports a CSV from their banking app and imports it via a new Settings action. The app groups transactions by merchant/amount, detects recurring patterns (same payee, same/similar amount, regular cadence), and presents a list of *candidate subscriptions* for the user to confirm before they are added. Stays no-backend; entirely client-side parsing.
  - Scope decisions to resolve in the v2 design: which UK bank CSV formats to support out of the box (e.g., Monzo, Starling, Barclays, HSBC), how strict the recurring-detection heuristic is, and how to handle matching against subscriptions already added manually (avoid duplicates).
- **Auto-sync to a private GitHub Gist.** Originally scoped for v1; deferred to keep the first ship minimal. Broad design intent in §7 — to be re-specified in detail before implementation, including whether to discover an existing gist on connect or always create a new one.
- Multi-currency support with FX conversion for the dashboard.
- Push notifications via Web Push (server cron + subscription) for users who don't want calendar reminders.
- Spend analytics: category breakdowns, month-over-month change.
- Multi-device real-time sync via a proper backend.

### Later (post-v2)

- **Bank account linking via Open Banking.** Would supersede CSV import with automatic continuous sync. Route: GoCardless Bank Account Data API (free in UK/EU for personal use) plus a Cloudflare Workers backend to hold OAuth tokens; 90-day re-consent UX. Deferred until v2 (CSV import) proves the recurring-detection heuristic is useful enough to be worth automating.

## 13. Open questions

None at time of approval. Any issues uncovered during planning will be reflected back into this document before implementation begins.
