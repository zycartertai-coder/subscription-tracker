# Subscription Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement v1 of the subscription tracker exactly as defined in `docs/superpowers/specs/2026-05-16-subscription-tracker-design.md` — a personal PWA on iPhone that tracks recurring subscriptions, exports per-subscription `.ics` files for Apple Calendar reminders, persists data in `localStorage` with auto-sync to a private GitHub Gist, and offers a manual JSON export/import fallback.

**Architecture:** Static site served by GitHub Pages from the repository root. No bundler, no transpiler, no runtime npm dependencies. Pure ES modules in the browser. Pure-logic modules (`store`, `sync`, `ics`, `totals`, `lib/date`) are unit-tested under Node using the built-in `node:test` runner. UI modules are kept deliberately thin and verified on-device.

**Tech Stack:** Vanilla HTML / CSS / JavaScript (ES modules). Node ≥ 20 for tests. `sharp` as a devDependency for icon generation. GitHub Pages for hosting. GitHub Gists for off-device sync. Apple Calendar for reminders.

**Reference spec:** `docs/superpowers/specs/2026-05-16-subscription-tracker-design.md`. Whenever the plan references "the spec" without further qualification, that is the document.

---

## File Map

Files created or modified during this plan, with each file's single responsibility:

| Path | Created by task | Purpose |
| --- | --- | --- |
| `package.json` | 1 | Dev-only manifest. Declares `"type": "module"` so `.js` files are ES modules under Node. Declares `sharp` as a devDependency for icon generation. Test and icon scripts. |
| `.gitignore` | 1 | Ignore `node_modules`, OS junk, generated icon previews. |
| `src/lib/date.js` | 2 | Pure date helpers. ISO formatting, day arithmetic, relative-time strings. |
| `src/lib/dom.js` | 3 | A tiny `h(tag, props, ...children)` element factory and a `mount(root, view)` helper. No logic worth unit-testing. |
| `src/totals.js` | 4 | Pure math: monthly/yearly equivalent per subscription, summed totals. |
| `src/store.js` | 5 | Single source of truth for the data document. CRUD mutations, `localStorage` persistence, subscriber callbacks, JSON export/import, `icsSequence` bumping. |
| `src/ics.js` | 6 | Pure `.ics` text generation for create/update/cancel + trial events. |
| `src/sync.js` | 7 | Gist push/pull, 2-second push debounce, status (`grey | green | amber | red`), retry on `online`, conflict prompt callback. |
| `src/ui/components.js` | 8 | Small DOM building blocks: `toast()`, `statusDot()`, `chip()`, confirm dialog. |
| `src/ui/list.js` | 9 | List / Home view. |
| `src/ui/form.js` | 10 | Add / Edit view. |
| `src/ui/settings.js` | 11 | Settings view (sync, defaults, export/import). |
| `src/app.js` | 12 | Bootstrap: hash router, store/sync init, render dispatch. |
| `src/config.js` | 12 | One-line site base URL constant used in `.ics` deep links. |
| `index.html` | 13 | App shell: meta, manifest link, root mount node. |
| `styles/app.css` | 13 | Mobile-first stylesheet. |
| `manifest.webmanifest` | 14 | PWA manifest. |
| `sw.js` | 14 | Service worker — pre-cache app shell, network-first for data calls. |
| `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable-512.png`, `icons/apple-touch-icon.png` | 15 | Generated raster icons. |
| `tools/icon-source.svg` | 15 | Single source SVG for all icons. |
| `tools/make-icons.mjs` | 15 | Regenerates the four PNGs from the SVG using `sharp`. |
| `tests/lib/date.test.js` | 2 | |
| `tests/totals.test.js` | 4 | |
| `tests/store.test.js` | 5 | |
| `tests/ics.test.js` | 6 | |
| `tests/sync.test.js` | 7 | |
| `README.md` | 16 | Setup, deploy, on-device install instructions, manual smoke-test checklist. |
| `.github/workflows/test.yml` | 16 | Run `npm test` on push/PR. |

---

## Standing Conventions

These apply to every task. They're called out here so individual tasks don't repeat them.

- **ES modules everywhere.** All source files use `import`/`export`. `package.json` has `"type": "module"`.
- **No runtime npm dependencies.** Browser code must run without `node_modules`. Only `sharp` and the test runner (built into Node) are allowed as dev-time tools.
- **TDD (Red/Green).** For every testable module, write the failing test first, run it, see it fail, then implement, then see it pass, then commit. The user's `CLAUDE.md` mandates this.
- **Test runner.** `node --test tests/`. Tests use `node:test` and `node:assert/strict`. Tests must not perform network I/O; sync tests inject a stub `fetch`.
- **Commit cadence.** One commit per task, at the end of the task, with a conventional-commit-style message and the `Co-Authored-By` trailer.
- **Date in IDs and timestamps.** Code that needs the current time takes an injected clock (`now()` function) defaulting to `() => new Date()`, so tests are deterministic.
- **No `any`, no `eval`, no `with`.** Pure JS; keep types informally documented via JSDoc where it aids reading.

---

## Task 1: Project skeleton

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `src/`, `src/lib/`, `src/ui/`, `tests/`, `tests/lib/`, `tools/`, `icons/`, `styles/` (empty for now)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "subscription-tracker",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "description": "Personal PWA for tracking subscriptions and reminding before payments via Apple Calendar.",
  "scripts": {
    "test": "node --test tests/",
    "test:watch": "node --test --watch tests/",
    "icons": "node tools/make-icons.mjs"
  },
  "devDependencies": {
    "sharp": "^0.33.0"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
.DS_Store
*.log
icons/_preview/
```

- [ ] **Step 3: Create empty directory placeholders**

Run:

```bash
mkdir -p src/lib src/ui tests/lib tools icons styles
touch src/.gitkeep tests/.gitkeep
```

- [ ] **Step 4: Verify Node version**

Run: `node --version`
Expected: a v20 or newer release. If older, stop and upgrade Node (e.g., via `nvm install 20`).

- [ ] **Step 5: Verify the test runner is wired**

Run: `node --test tests/`
Expected: exit code 0 with output similar to `# tests 0 # pass 0`.

- [ ] **Step 6: Commit**

```bash
git add package.json .gitignore src tests tools icons styles
git commit -m "$(cat <<'EOF'
chore: project skeleton with node:test wiring

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Pure date helpers (`src/lib/date.js`)

**Files:**
- Create: `src/lib/date.js`
- Test: `tests/lib/date.test.js`

This module is small but used everywhere: List relative-time labels, ICS dates, sync timestamps.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/date.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatISODate,
  parseISODate,
  addDays,
  daysBetween,
  relativeFromNow
} from '../../src/lib/date.js';

test('formatISODate returns YYYY-MM-DD in UTC', () => {
  const d = new Date(Date.UTC(2026, 4, 16, 10, 30));
  assert.equal(formatISODate(d), '2026-05-16');
});

test('parseISODate accepts YYYY-MM-DD and returns a UTC Date at 00:00', () => {
  const d = parseISODate('2026-05-16');
  assert.equal(d.toISOString(), '2026-05-16T00:00:00.000Z');
});

test('parseISODate throws on a malformed string', () => {
  assert.throws(() => parseISODate('not a date'));
});

test('addDays returns a new Date n days later, leaving the original untouched', () => {
  const start = parseISODate('2026-05-16');
  const next = addDays(start, 5);
  assert.equal(formatISODate(next), '2026-05-21');
  assert.equal(formatISODate(start), '2026-05-16');
});

test('addDays accepts negative n', () => {
  const next = addDays(parseISODate('2026-05-16'), -2);
  assert.equal(formatISODate(next), '2026-05-14');
});

test('daysBetween returns a signed integer of whole days from a to b', () => {
  assert.equal(daysBetween(parseISODate('2026-05-16'), parseISODate('2026-05-20')), 4);
  assert.equal(daysBetween(parseISODate('2026-05-20'), parseISODate('2026-05-16')), -4);
  assert.equal(daysBetween(parseISODate('2026-05-16'), parseISODate('2026-05-16')), 0);
});

test('relativeFromNow returns "today" for same day', () => {
  const now = parseISODate('2026-05-16');
  assert.equal(relativeFromNow(parseISODate('2026-05-16'), now), 'today');
});

test('relativeFromNow returns "tomorrow" and "in N days" for future', () => {
  const now = parseISODate('2026-05-16');
  assert.equal(relativeFromNow(parseISODate('2026-05-17'), now), 'tomorrow');
  assert.equal(relativeFromNow(parseISODate('2026-05-20'), now), 'in 4 days');
});

test('relativeFromNow returns "yesterday" and "N days ago" for past', () => {
  const now = parseISODate('2026-05-16');
  assert.equal(relativeFromNow(parseISODate('2026-05-15'), now), 'yesterday');
  assert.equal(relativeFromNow(parseISODate('2026-05-13'), now), '3 days ago');
});
```

- [ ] **Step 2: Run tests, expect failures**

Run: `node --test tests/lib/date.test.js`
Expected: ten failing tests (module not found).

- [ ] **Step 3: Implement `src/lib/date.js`**

```js
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export function formatISODate(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseISODate(s) {
  const match = ISO_DATE_RE.exec(s);
  if (!match) throw new Error(`Not a YYYY-MM-DD date: ${s}`);
  const [, y, m, d] = match;
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
}

export function addDays(date, n) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + n);
  return next;
}

export function daysBetween(a, b) {
  const aMid = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const bMid = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((bMid - aMid) / MS_PER_DAY);
}

export function relativeFromNow(target, now = new Date()) {
  const delta = daysBetween(now, target);
  if (delta === 0) return 'today';
  if (delta === 1) return 'tomorrow';
  if (delta === -1) return 'yesterday';
  if (delta > 0) return `in ${delta} days`;
  return `${-delta} days ago`;
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `node --test tests/lib/date.test.js`
Expected: all ten tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/date.js tests/lib/date.test.js
git commit -m "$(cat <<'EOF'
feat: add pure date helpers (lib/date)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: DOM helper (`src/lib/dom.js`)

**Files:**
- Create: `src/lib/dom.js`

This file is thin and contains no branching logic worth unit-testing under Node (there is no DOM in Node). It is exercised manually through the UI views and through end-to-end on-device verification. Keep it minimal.

- [ ] **Step 1: Implement `src/lib/dom.js`**

```js
// Tiny element factory and mount helper. Intentionally minimal — UI views
// that need branching belong in their own modules with logic pushed down
// to pure modules (store/ics/totals).

export function h(tag, props = null, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function mount(root, view) {
  root.replaceChildren(view);
}

export function clear(root) {
  root.replaceChildren();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/dom.js
git commit -m "$(cat <<'EOF'
feat: add tiny DOM h() helper (lib/dom)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Totals math (`src/totals.js`)

**Files:**
- Create: `src/totals.js`
- Test: `tests/totals.test.js`

Per the spec §4: monthly equivalents are computed, not stored. Conversion rules: `monthly → amount`, `yearly → amount/12`, `weekly → amount × 52 / 12`, `custom-days → amount × 30 / customIntervalDays`.

- [ ] **Step 1: Write the failing tests**

Create `tests/totals.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthlyEquivalent, yearlyEquivalent, totalMonthly, totalYearly } from '../src/totals.js';

test('monthlyEquivalent: monthly passes through', () => {
  assert.equal(monthlyEquivalent({ amount: 12.99, frequency: 'monthly' }), 12.99);
});

test('monthlyEquivalent: yearly divides by 12', () => {
  assert.equal(monthlyEquivalent({ amount: 120, frequency: 'yearly' }), 10);
});

test('monthlyEquivalent: weekly multiplies by 52/12', () => {
  const v = monthlyEquivalent({ amount: 3, frequency: 'weekly' });
  assert.ok(Math.abs(v - 13) < 0.001, `expected ~13, got ${v}`);
});

test('monthlyEquivalent: custom-days uses customIntervalDays', () => {
  assert.equal(monthlyEquivalent({ amount: 30, frequency: 'custom-days', customIntervalDays: 30 }), 30);
  assert.equal(monthlyEquivalent({ amount: 30, frequency: 'custom-days', customIntervalDays: 60 }), 15);
});

test('monthlyEquivalent: custom-days without customIntervalDays throws', () => {
  assert.throws(() =>
    monthlyEquivalent({ amount: 30, frequency: 'custom-days', customIntervalDays: null })
  );
});

test('monthlyEquivalent: unknown frequency throws', () => {
  assert.throws(() => monthlyEquivalent({ amount: 10, frequency: 'fortnightly' }));
});

test('yearlyEquivalent: monthly × 12', () => {
  assert.equal(yearlyEquivalent({ amount: 10, frequency: 'monthly' }), 120);
});

test('totalMonthly sums monthly equivalents', () => {
  const subs = [
    { amount: 12.99, frequency: 'monthly' },
    { amount: 120, frequency: 'yearly' }
  ];
  assert.equal(totalMonthly(subs), 22.99);
});

test('totalYearly sums yearly equivalents', () => {
  const subs = [
    { amount: 10, frequency: 'monthly' },
    { amount: 30, frequency: 'yearly' }
  ];
  assert.equal(totalYearly(subs), 150);
});
```

- [ ] **Step 2: Run tests, expect failures**

Run: `node --test tests/totals.test.js`
Expected: all tests fail (module missing).

- [ ] **Step 3: Implement `src/totals.js`**

```js
export function monthlyEquivalent(sub) {
  switch (sub.frequency) {
    case 'monthly':
      return sub.amount;
    case 'yearly':
      return sub.amount / 12;
    case 'weekly':
      return (sub.amount * 52) / 12;
    case 'custom-days': {
      if (!sub.customIntervalDays || sub.customIntervalDays <= 0) {
        throw new Error('custom-days frequency requires positive customIntervalDays');
      }
      return (sub.amount * 30) / sub.customIntervalDays;
    }
    default:
      throw new Error(`Unknown frequency: ${sub.frequency}`);
  }
}

export function yearlyEquivalent(sub) {
  return monthlyEquivalent(sub) * 12;
}

export function totalMonthly(subs) {
  return subs.reduce((acc, s) => acc + monthlyEquivalent(s), 0);
}

export function totalYearly(subs) {
  return subs.reduce((acc, s) => acc + yearlyEquivalent(s), 0);
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `node --test tests/totals.test.js`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/totals.js tests/totals.test.js
git commit -m "$(cat <<'EOF'
feat: add totals (monthly/yearly equivalent math)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Store (`src/store.js`)

**Files:**
- Create: `src/store.js`
- Test: `tests/store.test.js`

The store owns the in-memory data document, every mutation, and persistence to `localStorage`. Mutations bump `updatedAt` on the affected entity, on `settings`, and on the root document. `updateSubscription` also bumps `icsSequence`. The store is constructed by a factory so tests can inject a storage stub, a clock, and a UUID generator.

The shape exactly matches the spec §4.

- [ ] **Step 1: Write the failing tests**

Create `tests/store.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, EMPTY_DOCUMENT } from '../src/store.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k)
  };
}

function fixedClock(iso) {
  let cur = iso;
  return {
    now: () => new Date(cur),
    advance: (next) => { cur = next; }
  };
}

let uuidCounter = 0;
function deterministicUuid() {
  return `uuid-${++uuidCounter}`;
}

test('createStore loads EMPTY_DOCUMENT when storage is empty', () => {
  const store = createStore({ storage: memoryStorage(), now: () => new Date('2026-05-16T00:00:00Z'), uuid: deterministicUuid });
  assert.deepEqual(store.getDocument().subscriptions, []);
  assert.equal(store.getDocument().settings.currency, 'GBP');
  assert.equal(store.getDocument().version, 1);
});

test('addSubscription assigns id, timestamps, icsSequence=0, and persists', () => {
  uuidCounter = 0;
  const storage = memoryStorage();
  const clock = fixedClock('2026-05-16T10:00:00Z');
  const store = createStore({ storage, now: clock.now, uuid: deterministicUuid });

  store.addSubscription({
    name: 'Netflix', amount: 12.99, frequency: 'monthly',
    nextPaymentDate: '2026-06-01', category: 'Entertainment',
    paymentMethod: 'Visa •1234', notes: '', url: '',
    customIntervalDays: null, trialEndDate: null, reminderDaysBefore: 2
  });

  const doc = store.getDocument();
  assert.equal(doc.subscriptions.length, 1);
  const sub = doc.subscriptions[0];
  assert.equal(sub.id, 'uuid-1');
  assert.equal(sub.icsSequence, 0);
  assert.equal(sub.createdAt, '2026-05-16T10:00:00.000Z');
  assert.equal(sub.updatedAt, '2026-05-16T10:00:00.000Z');

  // Persisted to storage and reloadable
  const reload = createStore({ storage, now: clock.now, uuid: deterministicUuid });
  assert.equal(reload.getDocument().subscriptions.length, 1);
});

test('updateSubscription bumps icsSequence and updatedAt', () => {
  uuidCounter = 0;
  const clock = fixedClock('2026-05-16T10:00:00Z');
  const store = createStore({ storage: memoryStorage(), now: clock.now, uuid: deterministicUuid });
  store.addSubscription({
    name: 'Netflix', amount: 12.99, frequency: 'monthly',
    nextPaymentDate: '2026-06-01', category: '', paymentMethod: '',
    notes: '', url: '', customIntervalDays: null, trialEndDate: null,
    reminderDaysBefore: 2
  });
  clock.advance('2026-05-16T11:00:00Z');
  store.updateSubscription('uuid-1', { amount: 14.99 });

  const sub = store.getDocument().subscriptions[0];
  assert.equal(sub.amount, 14.99);
  assert.equal(sub.icsSequence, 1);
  assert.equal(sub.updatedAt, '2026-05-16T11:00:00.000Z');
  assert.equal(sub.createdAt, '2026-05-16T10:00:00.000Z'); // unchanged
});

test('updateSubscription on unknown id throws', () => {
  const store = createStore({ storage: memoryStorage(), now: () => new Date(), uuid: deterministicUuid });
  assert.throws(() => store.updateSubscription('nope', { amount: 1 }));
});

test('deleteSubscription removes by id and updates root updatedAt', () => {
  uuidCounter = 0;
  const clock = fixedClock('2026-05-16T10:00:00Z');
  const store = createStore({ storage: memoryStorage(), now: clock.now, uuid: deterministicUuid });
  store.addSubscription({ name: 'A', amount: 1, frequency: 'monthly', nextPaymentDate: '2026-06-01', category: '', paymentMethod: '', notes: '', url: '', customIntervalDays: null, trialEndDate: null, reminderDaysBefore: 2 });
  store.addSubscription({ name: 'B', amount: 2, frequency: 'monthly', nextPaymentDate: '2026-06-01', category: '', paymentMethod: '', notes: '', url: '', customIntervalDays: null, trialEndDate: null, reminderDaysBefore: 2 });

  clock.advance('2026-05-16T12:00:00Z');
  store.deleteSubscription('uuid-1');

  assert.equal(store.getDocument().subscriptions.length, 1);
  assert.equal(store.getDocument().subscriptions[0].id, 'uuid-2');
  assert.equal(store.getDocument().updatedAt, '2026-05-16T12:00:00.000Z');
});

test('updateSettings merges, timestamps, and persists', () => {
  const clock = fixedClock('2026-05-16T10:00:00Z');
  const store = createStore({ storage: memoryStorage(), now: clock.now, uuid: deterministicUuid });
  clock.advance('2026-05-16T13:00:00Z');
  store.updateSettings({ defaultReminderDays: 5 });
  assert.equal(store.getDocument().settings.defaultReminderDays, 5);
  assert.equal(store.getDocument().settings.updatedAt, '2026-05-16T13:00:00.000Z');
  assert.equal(store.getDocument().updatedAt, '2026-05-16T13:00:00.000Z');
});

test('subscribe receives the new document after each mutation', () => {
  const store = createStore({ storage: memoryStorage(), now: () => new Date('2026-05-16T10:00:00Z'), uuid: deterministicUuid });
  const seen = [];
  const unsubscribe = store.subscribe((doc) => seen.push(doc.subscriptions.length));

  store.addSubscription({ name: 'A', amount: 1, frequency: 'monthly', nextPaymentDate: '2026-06-01', category: '', paymentMethod: '', notes: '', url: '', customIntervalDays: null, trialEndDate: null, reminderDaysBefore: 2 });
  unsubscribe();
  store.addSubscription({ name: 'B', amount: 1, frequency: 'monthly', nextPaymentDate: '2026-06-01', category: '', paymentMethod: '', notes: '', url: '', customIntervalDays: null, trialEndDate: null, reminderDaysBefore: 2 });

  assert.deepEqual(seen, [1]); // unsubscribe took effect
});

test('exportJson returns a string of the current document', () => {
  uuidCounter = 0;
  const store = createStore({ storage: memoryStorage(), now: () => new Date('2026-05-16T10:00:00Z'), uuid: deterministicUuid });
  const json = store.exportJson();
  const parsed = JSON.parse(json);
  assert.equal(parsed.version, 1);
  assert.equal(parsed.settings.currency, 'GBP');
});

test('importJson replace mode overwrites the document', () => {
  uuidCounter = 0;
  const store = createStore({ storage: memoryStorage(), now: () => new Date('2026-05-16T10:00:00Z'), uuid: deterministicUuid });
  store.addSubscription({ name: 'A', amount: 1, frequency: 'monthly', nextPaymentDate: '2026-06-01', category: '', paymentMethod: '', notes: '', url: '', customIntervalDays: null, trialEndDate: null, reminderDaysBefore: 2 });
  const replacement = JSON.stringify({ ...EMPTY_DOCUMENT, subscriptions: [] });
  store.importJson(replacement, { mode: 'replace' });
  assert.equal(store.getDocument().subscriptions.length, 0);
});

test('importJson merge upserts by id', () => {
  uuidCounter = 0;
  const clock = fixedClock('2026-05-16T10:00:00Z');
  const store = createStore({ storage: memoryStorage(), now: clock.now, uuid: deterministicUuid });
  store.addSubscription({ name: 'A', amount: 1, frequency: 'monthly', nextPaymentDate: '2026-06-01', category: '', paymentMethod: '', notes: '', url: '', customIntervalDays: null, trialEndDate: null, reminderDaysBefore: 2 });

  const incoming = JSON.stringify({
    version: 1,
    updatedAt: '2026-05-16T10:30:00Z',
    settings: store.getDocument().settings,
    subscriptions: [
      { ...store.getDocument().subscriptions[0], name: 'A (updated)' },
      { id: 'imported-1', name: 'C', amount: 9.99, frequency: 'monthly', nextPaymentDate: '2026-06-01', category: '', paymentMethod: '', notes: '', url: '', customIntervalDays: null, trialEndDate: null, reminderDaysBefore: 2, icsSequence: 0, createdAt: '2026-05-16T10:30:00Z', updatedAt: '2026-05-16T10:30:00Z' }
    ]
  });
  store.importJson(incoming, { mode: 'merge' });
  const subs = store.getDocument().subscriptions;
  assert.equal(subs.length, 2);
  assert.equal(subs.find(s => s.id === 'uuid-1').name, 'A (updated)');
  assert.ok(subs.find(s => s.id === 'imported-1'));
});

test('replaceDocument used by sync.pull overwrites without bumping anything', () => {
  uuidCounter = 0;
  const clock = fixedClock('2026-05-16T10:00:00Z');
  const store = createStore({ storage: memoryStorage(), now: clock.now, uuid: deterministicUuid });
  const incoming = {
    version: 1,
    updatedAt: '2026-05-16T09:00:00Z',
    settings: { currency: 'GBP', defaultReminderDays: 2, gistId: 'g1', tokenHint: 'ghp_...abcd', sync: { lastPushedAt: null, lastFetchedRemoteUpdatedAt: null }, updatedAt: '2026-05-16T09:00:00Z' },
    subscriptions: []
  };
  store.replaceDocument(incoming);
  assert.equal(store.getDocument().settings.gistId, 'g1');
});
```

- [ ] **Step 2: Run tests, expect failures**

Run: `node --test tests/store.test.js`
Expected: all twelve tests fail (module missing).

- [ ] **Step 3: Implement `src/store.js`**

```js
const STORAGE_KEY = 'subtracker.document';

export const EMPTY_DOCUMENT = Object.freeze({
  version: 1,
  updatedAt: '1970-01-01T00:00:00.000Z',
  settings: Object.freeze({
    currency: 'GBP',
    defaultReminderDays: 2,
    gistId: null,
    tokenHint: null,
    sync: Object.freeze({ lastPushedAt: null, lastFetchedRemoteUpdatedAt: null }),
    updatedAt: '1970-01-01T00:00:00.000Z'
  }),
  subscriptions: []
});

function clone(doc) {
  return JSON.parse(JSON.stringify(doc));
}

function maxIso(...isos) {
  return isos.reduce((a, b) => (a > b ? a : b));
}

export function createStore({ storage, now, uuid }) {
  let doc = loadInitial();
  const subscribers = new Set();

  function loadInitial() {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return clone(EMPTY_DOCUMENT);
    try {
      const parsed = JSON.parse(raw);
      if (parsed.version !== 1) throw new Error(`Unsupported document version: ${parsed.version}`);
      return parsed;
    } catch (err) {
      console.error('store: failed to parse stored document, starting fresh', err);
      return clone(EMPTY_DOCUMENT);
    }
  }

  function persist() {
    storage.setItem(STORAGE_KEY, JSON.stringify(doc));
    for (const cb of subscribers) cb(doc);
  }

  function nowIso() {
    return now().toISOString();
  }

  function touchRoot() {
    doc.updatedAt = maxIso(doc.settings.updatedAt, ...doc.subscriptions.map((s) => s.updatedAt));
  }

  return {
    getDocument() {
      return doc;
    },

    subscribe(cb) {
      subscribers.add(cb);
      return () => subscribers.delete(cb);
    },

    addSubscription(input) {
      const ts = nowIso();
      const sub = {
        id: uuid(),
        name: input.name,
        amount: input.amount,
        url: input.url ?? '',
        frequency: input.frequency,
        customIntervalDays: input.customIntervalDays ?? null,
        nextPaymentDate: input.nextPaymentDate,
        category: input.category ?? '',
        paymentMethod: input.paymentMethod ?? '',
        notes: input.notes ?? '',
        trialEndDate: input.trialEndDate ?? null,
        reminderDaysBefore: input.reminderDaysBefore ?? doc.settings.defaultReminderDays,
        icsSequence: 0,
        createdAt: ts,
        updatedAt: ts
      };
      doc.subscriptions.push(sub);
      touchRoot();
      persist();
      return sub;
    },

    updateSubscription(id, patch) {
      const idx = doc.subscriptions.findIndex((s) => s.id === id);
      if (idx === -1) throw new Error(`Subscription not found: ${id}`);
      const ts = nowIso();
      const existing = doc.subscriptions[idx];
      doc.subscriptions[idx] = {
        ...existing,
        ...patch,
        id: existing.id,
        createdAt: existing.createdAt,
        icsSequence: existing.icsSequence + 1,
        updatedAt: ts
      };
      touchRoot();
      persist();
      return doc.subscriptions[idx];
    },

    deleteSubscription(id) {
      const before = doc.subscriptions.length;
      doc.subscriptions = doc.subscriptions.filter((s) => s.id !== id);
      if (doc.subscriptions.length === before) throw new Error(`Subscription not found: ${id}`);
      doc.updatedAt = nowIso();
      persist();
    },

    updateSettings(patch) {
      const ts = nowIso();
      doc.settings = { ...doc.settings, ...patch, updatedAt: ts };
      if (patch.sync) doc.settings.sync = { ...doc.settings.sync, ...patch.sync };
      doc.updatedAt = ts;
      persist();
    },

    replaceDocument(incoming) {
      doc = clone(incoming);
      persist();
    },

    exportJson() {
      return JSON.stringify(doc, null, 2);
    },

    importJson(jsonString, { mode }) {
      const incoming = JSON.parse(jsonString);
      if (incoming.version !== 1) throw new Error(`Unsupported document version: ${incoming.version}`);
      if (mode === 'replace') {
        doc = incoming;
      } else if (mode === 'merge') {
        const byId = new Map(doc.subscriptions.map((s) => [s.id, s]));
        for (const s of incoming.subscriptions ?? []) byId.set(s.id, s);
        doc.subscriptions = [...byId.values()];
        doc.settings = { ...doc.settings, ...incoming.settings, updatedAt: nowIso() };
        doc.updatedAt = nowIso();
      } else {
        throw new Error(`importJson: unknown mode "${mode}"`);
      }
      persist();
    }
  };
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `node --test tests/store.test.js`
Expected: all twelve tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/store.js tests/store.test.js
git commit -m "$(cat <<'EOF'
feat: add store with CRUD, persistence, export/import

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: ICS generation (`src/ics.js`)

**Files:**
- Create: `src/ics.js`
- Test: `tests/ics.test.js`

Per spec §6.1, generate a `VCALENDAR` with one recurring `VEVENT` (renewal) and, when `trialEndDate` is set, a second one-off `VEVENT` (trial end). The `UID` is the subscription's UUID; trial UIDs are prefixed `trial-`. `SEQUENCE` reads from `sub.icsSequence`. For deletes we emit `METHOD:CANCEL` with `STATUS:CANCELLED`.

- [ ] **Step 1: Write the failing tests**

Create `tests/ics.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIcs } from '../src/ics.js';

const baseSub = {
  id: 'sub-1',
  name: 'Netflix',
  amount: 12.99,
  url: 'https://example.com/account',
  frequency: 'monthly',
  customIntervalDays: null,
  nextPaymentDate: '2026-06-01',
  category: 'Entertainment',
  paymentMethod: 'Visa •1234',
  notes: 'Shared with partner',
  trialEndDate: null,
  reminderDaysBefore: 2,
  icsSequence: 0,
  createdAt: '2026-05-16T10:00:00.000Z',
  updatedAt: '2026-05-16T10:00:00.000Z'
};
const settings = { currency: 'GBP', defaultReminderDays: 2 };
const baseUrl = 'https://example.github.io/subscriptions';

test('produces a VCALENDAR with METHOD:REQUEST by default', () => {
  const ics = buildIcs(baseSub, settings, { baseUrl });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR'));
  assert.ok(ics.includes('METHOD:REQUEST'));
  assert.ok(ics.trimEnd().endsWith('END:VCALENDAR'));
});

test('uses the subscription id as UID and writes the icsSequence as SEQUENCE', () => {
  const ics = buildIcs({ ...baseSub, icsSequence: 3 }, settings, { baseUrl });
  assert.ok(ics.includes('UID:sub-1'));
  assert.ok(ics.includes('SEQUENCE:3'));
});

test('embeds an RRULE matching the frequency', () => {
  assert.ok(buildIcs({ ...baseSub, frequency: 'monthly' }, settings, { baseUrl }).includes('RRULE:FREQ=MONTHLY'));
  assert.ok(buildIcs({ ...baseSub, frequency: 'yearly' }, settings, { baseUrl }).includes('RRULE:FREQ=YEARLY'));
  assert.ok(buildIcs({ ...baseSub, frequency: 'weekly' }, settings, { baseUrl }).includes('RRULE:FREQ=WEEKLY'));
});

test('custom-days uses FREQ=DAILY;INTERVAL=N', () => {
  const ics = buildIcs({ ...baseSub, frequency: 'custom-days', customIntervalDays: 90 }, settings, { baseUrl });
  assert.ok(ics.includes('RRULE:FREQ=DAILY;INTERVAL=90'));
});

test('VALARM uses TRIGGER offset of reminderDaysBefore days', () => {
  const ics = buildIcs({ ...baseSub, reminderDaysBefore: 7 }, settings, { baseUrl });
  assert.ok(ics.includes('BEGIN:VALARM'));
  assert.ok(ics.includes('TRIGGER:-P7D'));
});

test('SUMMARY includes name and formatted amount', () => {
  const ics = buildIcs(baseSub, settings, { baseUrl });
  assert.ok(ics.includes('SUMMARY:Netflix – £12.99'));
});

test('DESCRIPTION includes notes and a deep link back to the PWA edit screen', () => {
  const ics = buildIcs(baseSub, settings, { baseUrl });
  assert.ok(ics.includes('DESCRIPTION:'));
  assert.ok(ics.includes('Shared with partner'));
  assert.ok(ics.includes(`${baseUrl}/#/edit/sub-1`));
});

test('URL property is included when url is non-empty', () => {
  assert.ok(buildIcs(baseSub, settings, { baseUrl }).includes('URL:https://example.com/account'));
});

test('URL property is omitted when url is empty', () => {
  const ics = buildIcs({ ...baseSub, url: '' }, settings, { baseUrl });
  assert.ok(!ics.includes('URL:'));
});

test('trialEndDate produces a second one-off VEVENT with trial- UID', () => {
  const ics = buildIcs({ ...baseSub, trialEndDate: '2026-05-20' }, settings, { baseUrl });
  const occurrences = ics.match(/BEGIN:VEVENT/g) ?? [];
  assert.equal(occurrences.length, 2);
  assert.ok(ics.includes('UID:trial-sub-1'));
  // Trial event must NOT contain an RRULE
  const trialBlock = ics.split('UID:trial-sub-1')[1];
  assert.ok(!trialBlock.includes('RRULE:'));
});

test('cancel mode emits METHOD:CANCEL with STATUS:CANCELLED and no VALARM', () => {
  const ics = buildIcs(baseSub, settings, { baseUrl, method: 'CANCEL' });
  assert.ok(ics.includes('METHOD:CANCEL'));
  assert.ok(ics.includes('STATUS:CANCELLED'));
  assert.ok(!ics.includes('BEGIN:VALARM'));
});
```

- [ ] **Step 2: Run tests, expect failures**

Run: `node --test tests/ics.test.js`
Expected: all tests fail (module missing).

- [ ] **Step 3: Implement `src/ics.js`**

```js
import { parseISODate, addDays, formatISODate } from './lib/date.js';

const CRLF = '\r\n';

const CURRENCY_SYMBOL = { GBP: '£', USD: '$', EUR: '€' };

function fmtAmount(amount, currency) {
  const symbol = CURRENCY_SYMBOL[currency] ?? '';
  return `${symbol}${amount.toFixed(2)}`;
}

function fmtAllDay(isoDate) {
  return isoDate.replaceAll('-', '');
}

function escapeText(s) {
  return String(s ?? '')
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replaceAll(/\r?\n/g, '\\n');
}

function rrule(sub) {
  switch (sub.frequency) {
    case 'monthly': return 'RRULE:FREQ=MONTHLY';
    case 'yearly': return 'RRULE:FREQ=YEARLY';
    case 'weekly': return 'RRULE:FREQ=WEEKLY';
    case 'custom-days': return `RRULE:FREQ=DAILY;INTERVAL=${sub.customIntervalDays}`;
    default: throw new Error(`Unknown frequency: ${sub.frequency}`);
  }
}

function renewalEvent(sub, settings, baseUrl, isCancel) {
  const dtstart = fmtAllDay(sub.nextPaymentDate);
  const dtend = fmtAllDay(formatISODate(addDays(parseISODate(sub.nextPaymentDate), 1)));
  const lines = [
    'BEGIN:VEVENT',
    `UID:${sub.id}`,
    `SEQUENCE:${sub.icsSequence}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}`,
    `DTSTART;VALUE=DATE:${dtstart}`,
    `DTEND;VALUE=DATE:${dtend}`,
    rrule(sub),
    `SUMMARY:${escapeText(`${sub.name} – ${fmtAmount(sub.amount, settings.currency)}`)}`,
    `DESCRIPTION:${escapeText(
      [sub.notes, `Manage: ${baseUrl}/#/edit/${sub.id}`].filter(Boolean).join('\\n')
    )}`
  ];
  if (sub.url) lines.push(`URL:${sub.url}`);
  if (isCancel) lines.push('STATUS:CANCELLED');
  if (!isCancel) {
    lines.push(
      'BEGIN:VALARM',
      `TRIGGER:-P${sub.reminderDaysBefore}D`,
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(`Upcoming: ${sub.name}`)}`,
      'END:VALARM'
    );
  }
  lines.push('END:VEVENT');
  return lines;
}

function trialEvent(sub, settings, baseUrl) {
  const dtstart = fmtAllDay(sub.trialEndDate);
  const dtend = fmtAllDay(formatISODate(addDays(parseISODate(sub.trialEndDate), 1)));
  return [
    'BEGIN:VEVENT',
    `UID:trial-${sub.id}`,
    `SEQUENCE:${sub.icsSequence}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}`,
    `DTSTART;VALUE=DATE:${dtstart}`,
    `DTEND;VALUE=DATE:${dtend}`,
    `SUMMARY:${escapeText(`${sub.name} – free trial ends`)}`,
    `DESCRIPTION:${escapeText(`You will start being charged for ${sub.name}. Manage: ${baseUrl}/#/edit/${sub.id}`)}`,
    'BEGIN:VALARM',
    `TRIGGER:-P${sub.reminderDaysBefore}D`,
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(`Trial ending: ${sub.name}`)}`,
    'END:VALARM',
    'END:VEVENT'
  ];
}

export function buildIcs(sub, settings, { baseUrl, method = 'REQUEST' } = {}) {
  const isCancel = method === 'CANCEL';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//subscription-tracker//EN',
    `METHOD:${method}`,
    ...renewalEvent(sub, settings, baseUrl, isCancel)
  ];
  if (!isCancel && sub.trialEndDate) lines.push(...trialEvent(sub, settings, baseUrl));
  lines.push('END:VCALENDAR');
  return lines.join(CRLF) + CRLF;
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `node --test tests/ics.test.js`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/ics.js tests/ics.test.js
git commit -m "$(cat <<'EOF'
feat: add .ics generator (create/update/cancel + trial event)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Sync (`src/sync.js`)

**Files:**
- Create: `src/sync.js`
- Test: `tests/sync.test.js`

Per spec §7. Sync is a stateful module: it owns the debounce timer, the current status, and the pending push promise. It does not read/write `localStorage` itself; it operates on `store` via injected `getDocument()` / `replaceDocument()` callbacks and reports status changes via a callback. All HTTP is via an injected `fetch` so tests can stub it.

GitHub Gist API contracts used:
- `GET https://api.github.com/gists/{gist_id}` — read file contents.
- `PATCH https://api.github.com/gists/{gist_id}` with `files: { 'subscription-tracker.json': { content: '...' } }`.
- `POST https://api.github.com/gists` with `public: false, files: { 'subscription-tracker.json': { content: '...' } }` — create initial gist.
- All requests use header `Authorization: Bearer <token>`.

- [ ] **Step 1: Write the failing tests**

Create `tests/sync.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSync } from '../src/sync.js';

function stubFetch(handler) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  fn.calls = calls;
  return fn;
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
  };
}

function makeFakeStore(initialDoc) {
  let doc = JSON.parse(JSON.stringify(initialDoc));
  return {
    getDocument: () => doc,
    replaceDocument: (incoming) => { doc = JSON.parse(JSON.stringify(incoming)); },
    updateSettings: (patch) => { doc.settings = { ...doc.settings, ...patch, sync: { ...doc.settings.sync, ...(patch.sync ?? {}) } }; }
  };
}

const baseDoc = {
  version: 1,
  updatedAt: '2026-05-16T10:00:00.000Z',
  settings: {
    currency: 'GBP', defaultReminderDays: 2, gistId: null, tokenHint: null,
    sync: { lastPushedAt: null, lastFetchedRemoteUpdatedAt: null },
    updatedAt: '2026-05-16T10:00:00.000Z'
  },
  subscriptions: []
};

test('createGist creates a private gist, stores gistId and tokenHint, returns gistId', async () => {
  const store = makeFakeStore(baseDoc);
  const fetch = stubFetch((url, init) => {
    assert.equal(url, 'https://api.github.com/gists');
    assert.equal(init.method, 'POST');
    const body = JSON.parse(init.body);
    assert.equal(body.public, false);
    assert.ok(body.files['subscription-tracker.json']);
    return jsonResponse({ id: 'gist-abc' }, 201);
  });

  const sync = createSync({ store, fetch, token: 'ghp_secret_token', onStatusChange: () => {} });
  const gistId = await sync.createGist();

  assert.equal(gistId, 'gist-abc');
  assert.equal(store.getDocument().settings.gistId, 'gist-abc');
  assert.equal(store.getDocument().settings.tokenHint, 'ghp_…oken');
});

test('push PATCHes the configured gist and updates sync.lastPushedAt', async () => {
  const store = makeFakeStore({
    ...baseDoc,
    settings: { ...baseDoc.settings, gistId: 'gist-abc' }
  });
  const fetch = stubFetch((url, init) => {
    assert.equal(url, 'https://api.github.com/gists/gist-abc');
    assert.equal(init.method, 'PATCH');
    return jsonResponse({ id: 'gist-abc' });
  });
  const statuses = [];
  const sync = createSync({ store, fetch, token: 'ghp_token', onStatusChange: (s) => statuses.push(s) });

  await sync.push();
  assert.ok(store.getDocument().settings.sync.lastPushedAt);
  assert.deepEqual(statuses[statuses.length - 1], { state: 'green', message: 'Synced' });
});

test('pull replaces the local document when remote updatedAt is newer', async () => {
  const store = makeFakeStore({ ...baseDoc, settings: { ...baseDoc.settings, gistId: 'gist-abc' } });
  const remote = { ...baseDoc, updatedAt: '2026-05-17T10:00:00.000Z' };
  const fetch = stubFetch(() =>
    jsonResponse({ files: { 'subscription-tracker.json': { content: JSON.stringify(remote) } } })
  );

  const sync = createSync({ store, fetch, token: 'ghp_token', onStatusChange: () => {} });
  const result = await sync.pull();

  assert.equal(result.outcome, 'replaced');
  assert.equal(store.getDocument().updatedAt, '2026-05-17T10:00:00.000Z');
});

test('pull keeps local when remote is older', async () => {
  const store = makeFakeStore({ ...baseDoc, settings: { ...baseDoc.settings, gistId: 'gist-abc' } });
  const remote = { ...baseDoc, updatedAt: '2026-05-15T00:00:00.000Z' };
  const fetch = stubFetch(() =>
    jsonResponse({ files: { 'subscription-tracker.json': { content: JSON.stringify(remote) } } })
  );

  const sync = createSync({ store, fetch, token: 'ghp_token', onStatusChange: () => {} });
  const result = await sync.pull();
  assert.equal(result.outcome, 'kept-local');
});

test('pull surfaces a conflict when remote moved AND local is dirty', async () => {
  const dirtyDoc = {
    ...baseDoc,
    updatedAt: '2026-05-18T10:00:00.000Z',
    settings: {
      ...baseDoc.settings, gistId: 'gist-abc',
      sync: { lastPushedAt: '2026-05-17T08:00:00.000Z', lastFetchedRemoteUpdatedAt: '2026-05-17T08:00:00.000Z' }
    }
  };
  const store = makeFakeStore(dirtyDoc);
  const remote = { ...baseDoc, updatedAt: '2026-05-18T09:00:00.000Z' };
  const fetch = stubFetch(() =>
    jsonResponse({ files: { 'subscription-tracker.json': { content: JSON.stringify(remote) } } })
  );

  const sync = createSync({ store, fetch, token: 'ghp_token', onStatusChange: () => {} });
  const result = await sync.pull();
  assert.equal(result.outcome, 'conflict');
  assert.equal(result.remote.updatedAt, '2026-05-18T09:00:00.000Z');
});

test('push on a 401 sets status red and rethrows', async () => {
  const store = makeFakeStore({ ...baseDoc, settings: { ...baseDoc.settings, gistId: 'gist-abc' } });
  const fetch = stubFetch(() => jsonResponse({ message: 'Bad credentials' }, 401));
  const statuses = [];
  const sync = createSync({ store, fetch, token: 'bad', onStatusChange: (s) => statuses.push(s) });

  await assert.rejects(() => sync.push());
  assert.equal(statuses[statuses.length - 1].state, 'red');
});

test('schedulePush debounces multiple calls into a single push', async () => {
  const store = makeFakeStore({ ...baseDoc, settings: { ...baseDoc.settings, gistId: 'gist-abc' } });
  const fetch = stubFetch(() => jsonResponse({ id: 'gist-abc' }));
  const sync = createSync({ store, fetch, token: 't', onStatusChange: () => {}, debounceMs: 10 });

  sync.schedulePush();
  sync.schedulePush();
  sync.schedulePush();

  await new Promise((r) => setTimeout(r, 50));
  assert.equal(fetch.calls.length, 1);
});
```

- [ ] **Step 2: Run tests, expect failures**

Run: `node --test tests/sync.test.js`
Expected: all tests fail (module missing).

- [ ] **Step 3: Implement `src/sync.js`**

```js
const API = 'https://api.github.com';
const FILENAME = 'subscription-tracker.json';

function tokenHint(token) {
  if (!token || token.length < 8) return null;
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };
}

export function createSync({ store, fetch, token, onStatusChange, debounceMs = 2000 }) {
  let pushTimer = null;
  let pushing = false;

  function setStatus(state, message) {
    onStatusChange({ state, message });
  }

  async function createGist() {
    setStatus('amber', 'Creating gist…');
    const doc = store.getDocument();
    const res = await fetch(`${API}/gists`, {
      method: 'POST',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Subscription Tracker data',
        public: false,
        files: { [FILENAME]: { content: JSON.stringify(doc, null, 2) } }
      })
    });
    if (!res.ok) {
      setStatus('red', `Gist creation failed: ${res.status}`);
      throw new Error(`Gist creation failed: ${res.status}`);
    }
    const body = await res.json();
    store.updateSettings({
      gistId: body.id,
      tokenHint: tokenHint(token),
      sync: { lastPushedAt: new Date().toISOString(), lastFetchedRemoteUpdatedAt: doc.updatedAt }
    });
    setStatus('green', 'Synced');
    return body.id;
  }

  async function push() {
    const doc = store.getDocument();
    const gistId = doc.settings.gistId;
    if (!gistId) throw new Error('No gistId configured');
    pushing = true;
    setStatus('amber', 'Pushing…');
    try {
      const res = await fetch(`${API}/gists/${gistId}`, {
        method: 'PATCH',
        headers: { ...authHeader(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: { [FILENAME]: { content: JSON.stringify(doc, null, 2) } } })
      });
      if (!res.ok) {
        setStatus('red', `Push failed: ${res.status}`);
        throw new Error(`Push failed: ${res.status}`);
      }
      store.updateSettings({
        sync: { lastPushedAt: new Date().toISOString(), lastFetchedRemoteUpdatedAt: doc.updatedAt }
      });
      setStatus('green', 'Synced');
    } finally {
      pushing = false;
    }
  }

  async function pull() {
    const doc = store.getDocument();
    const gistId = doc.settings.gistId;
    if (!gistId) throw new Error('No gistId configured');
    setStatus('amber', 'Pulling…');
    const res = await fetch(`${API}/gists/${gistId}`, { headers: authHeader(token) });
    if (!res.ok) {
      setStatus('red', `Pull failed: ${res.status}`);
      throw new Error(`Pull failed: ${res.status}`);
    }
    const body = await res.json();
    const content = body.files?.[FILENAME]?.content;
    if (!content) throw new Error(`Gist missing file: ${FILENAME}`);
    const remote = JSON.parse(content);

    const localDirty = isDirty(doc);
    const remoteMoved = remote.updatedAt > doc.settings.sync.lastFetchedRemoteUpdatedAt;
    if (remoteMoved && localDirty) {
      setStatus('amber', 'Conflict');
      return { outcome: 'conflict', remote };
    }
    if (remote.updatedAt > doc.updatedAt) {
      store.replaceDocument(remote);
      store.updateSettings({
        sync: { lastPushedAt: doc.settings.sync.lastPushedAt, lastFetchedRemoteUpdatedAt: remote.updatedAt }
      });
      setStatus('green', 'Synced');
      return { outcome: 'replaced', remote };
    }
    setStatus('green', 'Synced');
    return { outcome: 'kept-local', remote };
  }

  function isDirty(doc) {
    const last = doc.settings.sync.lastPushedAt;
    return last == null || doc.updatedAt > last;
  }

  function schedulePush() {
    setStatus('amber', 'Pending push');
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushTimer = null;
      push().catch((err) => console.error('sync: push failed', err));
    }, debounceMs);
  }

  function flushNow() {
    if (pushTimer) {
      clearTimeout(pushTimer);
      pushTimer = null;
    }
    return push();
  }

  return { createGist, push, pull, schedulePush, flushNow, isDirty: () => isDirty(store.getDocument()) };
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `node --test tests/sync.test.js`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/sync.js tests/sync.test.js
git commit -m "$(cat <<'EOF'
feat: add gist sync with debounced push, pull, and conflict surface

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: UI primitives (`src/ui/components.js`)

**Files:**
- Create: `src/ui/components.js`

Reusable DOM building blocks. No branching logic worth unit-testing under Node; exercised by views.

- [ ] **Step 1: Implement `src/ui/components.js`**

```js
import { h } from '../lib/dom.js';

let toastTimer = null;

export function toast(message, action = null) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  if (toastTimer) clearTimeout(toastTimer);
  const node = h('div', { class: 'toast' },
    h('span', { class: 'toast-msg' }, message),
    action && h('button', { class: 'toast-action', onClick: () => { action.onClick(); root.replaceChildren(); } }, action.label)
  );
  root.replaceChildren(node);
  toastTimer = setTimeout(() => root.replaceChildren(), 6000);
}

export function statusDot(state, message) {
  return h('span', { class: `status-dot status-${state}`, title: message, 'aria-label': message });
}

export function chip(text) {
  return h('span', { class: 'chip' }, text);
}

export function confirmDialog(message) {
  return new Promise((resolve) => {
    const overlay = h('div', { class: 'modal-overlay' },
      h('div', { class: 'modal' },
        h('p', null, message),
        h('div', { class: 'modal-actions' },
          h('button', { class: 'btn-secondary', onClick: () => { overlay.remove(); resolve(false); } }, 'Cancel'),
          h('button', { class: 'btn-danger', onClick: () => { overlay.remove(); resolve(true); } }, 'Confirm')
        )
      )
    );
    document.body.appendChild(overlay);
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/components.js
git commit -m "$(cat <<'EOF'
feat: add UI primitives (toast, status dot, chip, confirm)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: List / Home view (`src/ui/list.js`)

**Files:**
- Create: `src/ui/list.js`

This view renders the home screen per spec §5.1: monthly/yearly total in the top bar, settings cog, sorted subscription rows with relative time, category chip, and (when `url` is set) a small link icon. Rows are tinted by next-payment urgency. Bottom-right floating "+" button routes to `#/new`.

The view is a pure function of `(doc, now)` returning a DOM tree. State changes come from re-rendering via the store subscription in Task 12.

- [ ] **Step 1: Implement `src/ui/list.js`**

```js
import { h } from '../lib/dom.js';
import { totalMonthly, totalYearly } from '../totals.js';
import { parseISODate, daysBetween, relativeFromNow } from '../lib/date.js';
import { chip, statusDot } from './components.js';

const CURRENCY_SYMBOL = { GBP: '£', USD: '$', EUR: '€' };

function fmtAmount(amount, currency) {
  return `${CURRENCY_SYMBOL[currency] ?? ''}${amount.toFixed(2)}`;
}

function urgencyClass(sub, now) {
  const delta = daysBetween(now, parseISODate(sub.nextPaymentDate));
  if (delta <= 0) return 'row-overdue';
  if (delta <= sub.reminderDaysBefore) return 'row-upcoming';
  return '';
}

function freqLabel(sub) {
  switch (sub.frequency) {
    case 'monthly': return '/mo';
    case 'yearly': return '/yr';
    case 'weekly': return '/wk';
    case 'custom-days': return `/${sub.customIntervalDays}d`;
    default: return '';
  }
}

export function listView(doc, syncStatus, now = new Date()) {
  const subs = [...doc.subscriptions].sort(
    (a, b) => a.nextPaymentDate.localeCompare(b.nextPaymentDate)
  );
  const currency = doc.settings.currency;
  return h('div', { class: 'screen screen-list' },
    h('header', { class: 'topbar' },
      statusDot(syncStatus.state, syncStatus.message),
      h('div', { class: 'totals' },
        h('span', { class: 'total-mo' }, `${fmtAmount(totalMonthly(subs), currency)} /mo`),
        h('span', { class: 'total-yr' }, `${fmtAmount(totalYearly(subs), currency)} /yr`)
      ),
      h('a', { class: 'cog', href: '#/settings', 'aria-label': 'Settings' }, '⚙')
    ),
    subs.length === 0
      ? h('div', { class: 'empty' }, 'No subscriptions yet. Tap + to add one.')
      : h('ul', { class: 'sub-list' },
          ...subs.map((sub) =>
            h('li', { class: `sub-row ${urgencyClass(sub, now)}` },
              h('a', { class: 'sub-link', href: `#/edit/${sub.id}` },
                h('span', { class: 'sub-name' }, sub.name),
                h('span', { class: 'sub-amount' }, `${fmtAmount(sub.amount, currency)}${freqLabel(sub)}`),
                h('span', { class: 'sub-when' }, relativeFromNow(parseISODate(sub.nextPaymentDate), now)),
                sub.category && chip(sub.category)
              ),
              sub.url && h('a', { class: 'sub-extlink', href: sub.url, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `Open ${sub.name}` }, '↗')
            )
          )
        ),
    h('a', { class: 'fab', href: '#/new', 'aria-label': 'Add subscription' }, '+')
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/list.js
git commit -m "$(cat <<'EOF'
feat: add list/home view

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Add / Edit view (`src/ui/form.js`)

**Files:**
- Create: `src/ui/form.js`

Per spec §5.2 + §6 (calendar export). The form covers every field. On save:
1. `store.addSubscription` or `store.updateSubscription` is called.
2. `sync.schedulePush()` fires.
3. A toast offers "Add to Calendar" / "Update Calendar reminder" — tapping it triggers an `.ics` download using `buildIcs`.

For deletes we confirm, then call `store.deleteSubscription` and offer "Remove Calendar reminder?" toast that downloads a `METHOD:CANCEL` `.ics`.

Download mechanism: blob URL + temporary anchor element with `download=…`.

- [ ] **Step 1: Implement `src/ui/form.js`**

```js
import { h } from '../lib/dom.js';
import { toast, confirmDialog } from './components.js';
import { buildIcs } from '../ics.js';
import { BASE_URL } from '../config.js';

function downloadIcs(filename, content) {
  const blob = new Blob([content], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function readForm(form) {
  const fd = new FormData(form);
  const get = (k) => (fd.get(k)?.toString() ?? '').trim();
  const num = (k) => Number(get(k));
  const intOrNull = (k) => {
    const v = get(k);
    return v === '' ? null : Number.parseInt(v, 10);
  };
  return {
    name: get('name'),
    amount: num('amount'),
    url: get('url'),
    frequency: get('frequency'),
    customIntervalDays: intOrNull('customIntervalDays'),
    nextPaymentDate: get('nextPaymentDate'),
    category: get('category'),
    paymentMethod: get('paymentMethod'),
    notes: get('notes'),
    trialEndDate: get('trialEndDate') || null,
    reminderDaysBefore: intOrNull('reminderDaysBefore')
  };
}

function validate(values) {
  const errors = [];
  if (!values.name) errors.push('Name is required.');
  if (!Number.isFinite(values.amount) || values.amount <= 0) errors.push('Amount must be positive.');
  if (!['monthly', 'yearly', 'weekly', 'custom-days'].includes(values.frequency)) errors.push('Pick a frequency.');
  if (values.frequency === 'custom-days' && (!values.customIntervalDays || values.customIntervalDays <= 0)) {
    errors.push('Custom interval days must be positive.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.nextPaymentDate)) errors.push('Next payment date must be YYYY-MM-DD.');
  if (values.url && !/^https?:\/\//i.test(values.url)) errors.push('URL must start with http:// or https://.');
  return errors;
}

export function formView({ doc, store, sync, navigate, subId = null }) {
  const editing = subId !== null;
  const existing = editing ? doc.subscriptions.find((s) => s.id === subId) : null;
  if (editing && !existing) {
    return h('div', { class: 'screen screen-form' },
      h('p', null, `Subscription not found.`),
      h('a', { href: '#/' }, 'Back to list')
    );
  }

  const v = existing ?? {
    name: '', amount: '', url: '', frequency: 'monthly',
    customIntervalDays: '', nextPaymentDate: '', category: '',
    paymentMethod: '', notes: '', trialEndDate: '',
    reminderDaysBefore: doc.settings.defaultReminderDays
  };

  const form = h('form', { class: 'sub-form', onSubmit: onSubmit },
    h('label', null, 'Name', h('input', { name: 'name', value: v.name, required: true })),
    h('label', null, 'Amount', h('input', { name: 'amount', type: 'number', step: '0.01', inputmode: 'decimal', value: v.amount, required: true })),
    h('label', null, 'URL (optional)', h('input', { name: 'url', type: 'url', inputmode: 'url', value: v.url, placeholder: 'https://...' })),
    h('label', null, 'Frequency',
      h('select', { name: 'frequency' },
        h('option', { value: 'monthly', selected: v.frequency === 'monthly' }, 'Monthly'),
        h('option', { value: 'yearly', selected: v.frequency === 'yearly' }, 'Yearly'),
        h('option', { value: 'weekly', selected: v.frequency === 'weekly' }, 'Weekly'),
        h('option', { value: 'custom-days', selected: v.frequency === 'custom-days' }, 'Custom (days)')
      )
    ),
    h('label', null, 'Custom interval days', h('input', { name: 'customIntervalDays', type: 'number', inputmode: 'numeric', value: v.customIntervalDays ?? '' })),
    h('label', null, 'Next payment date', h('input', { name: 'nextPaymentDate', type: 'date', value: v.nextPaymentDate, required: true })),
    h('label', null, 'Category', h('input', { name: 'category', list: 'cat-options', value: v.category })),
    h('datalist', { id: 'cat-options' },
      ...uniq(doc.subscriptions.map((s) => s.category).filter(Boolean)).map((c) => h('option', { value: c }))
    ),
    h('label', null, 'Payment method', h('input', { name: 'paymentMethod', list: 'pm-options', value: v.paymentMethod })),
    h('datalist', { id: 'pm-options' },
      ...uniq(doc.subscriptions.map((s) => s.paymentMethod).filter(Boolean)).map((p) => h('option', { value: p }))
    ),
    h('label', null, 'Notes', h('textarea', { name: 'notes' }, v.notes)),
    h('label', null, 'Trial end date (optional)', h('input', { name: 'trialEndDate', type: 'date', value: v.trialEndDate ?? '' })),
    h('label', null, 'Reminder days before', h('input', { name: 'reminderDaysBefore', type: 'number', inputmode: 'numeric', value: v.reminderDaysBefore })),
    h('div', { class: 'form-actions' },
      h('button', { type: 'submit', class: 'btn-primary' }, editing ? 'Save changes' : 'Add subscription'),
      h('a', { href: '#/', class: 'btn-secondary' }, 'Cancel')
    ),
    editing && h('button', { type: 'button', class: 'btn-danger', onClick: onDelete }, 'Delete subscription'),
    editing && existing.url && h('a', { href: existing.url, target: '_blank', rel: 'noopener noreferrer', class: 'link-open-account' }, 'Open account')
  );

  return h('div', { class: 'screen screen-form' },
    h('header', { class: 'topbar' },
      h('a', { href: '#/', class: 'back' }, '← Back'),
      h('h1', null, editing ? 'Edit subscription' : 'Add subscription')
    ),
    form
  );

  function onSubmit(ev) {
    ev.preventDefault();
    const values = readForm(form);
    const errors = validate(values);
    if (errors.length > 0) {
      toast(errors[0]);
      return;
    }
    let saved;
    if (editing) {
      saved = store.updateSubscription(existing.id, values);
    } else {
      saved = store.addSubscription(values);
    }
    sync.schedulePush?.();
    const ics = buildIcs(saved, doc.settings, { baseUrl: BASE_URL, method: 'REQUEST' });
    navigate('#/');
    toast(editing ? 'Saved. Update Calendar reminder?' : 'Saved. Add reminders to Calendar?', {
      label: editing ? 'Update' : 'Add',
      onClick: () => downloadIcs(`${saved.name}.ics`, ics)
    });
  }

  async function onDelete() {
    const ok = await confirmDialog(`Delete "${existing.name}"? This cannot be undone.`);
    if (!ok) return;
    const cancelIcs = buildIcs(existing, doc.settings, { baseUrl: BASE_URL, method: 'CANCEL' });
    store.deleteSubscription(existing.id);
    sync.schedulePush?.();
    navigate('#/');
    toast('Deleted. Remove Calendar reminder?', {
      label: 'Remove',
      onClick: () => downloadIcs(`${existing.name}-cancel.ics`, cancelIcs)
    });
  }
}

function uniq(arr) {
  return [...new Set(arr)];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/form.js
git commit -m "$(cat <<'EOF'
feat: add subscription add/edit form with calendar export toasts

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Settings view (`src/ui/settings.js`)

**Files:**
- Create: `src/ui/settings.js`

Per spec §5.3 and §7.1. The view exposes:
- Default currency (read-only "GBP" with a tooltip "Locked to GBP in v1").
- Default reminder days (number input).
- Gist sync: paste-token flow (when not connected), status row, "Sync now", "Disconnect" (when connected).
- Export JSON / Import JSON.

The token itself is held in a closure inside `app.js`, not in the document. The settings view receives `connectGist`, `syncNow`, `disconnect` callbacks.

- [ ] **Step 1: Implement `src/ui/settings.js`**

```js
import { h } from '../lib/dom.js';
import { toast, confirmDialog } from './components.js';

export function settingsView({ doc, store, callbacks }) {
  const connected = Boolean(doc.settings.gistId && doc.settings.tokenHint);

  const tokenInput = h('input', {
    type: 'password', autocomplete: 'off', placeholder: 'ghp_...', name: 'token', class: 'token-input'
  });

  return h('div', { class: 'screen screen-settings' },
    h('header', { class: 'topbar' },
      h('a', { href: '#/', class: 'back' }, '← Back'),
      h('h1', null, 'Settings')
    ),

    h('section', null,
      h('h2', null, 'Defaults'),
      h('label', null, 'Currency',
        h('input', { value: 'GBP', readonly: true, title: 'Locked to GBP in v1' })
      ),
      h('label', null, 'Default reminder lead time (days)',
        h('input', {
          type: 'number', inputmode: 'numeric', value: doc.settings.defaultReminderDays,
          min: '0', max: '60',
          onChange: (e) => {
            const n = Number.parseInt(e.target.value, 10);
            if (Number.isFinite(n) && n >= 0) store.updateSettings({ defaultReminderDays: n });
          }
        })
      )
    ),

    h('section', null,
      h('h2', null, 'GitHub Gist sync'),
      connected
        ? h('div', null,
            h('p', null, `Connected. Token ${doc.settings.tokenHint}. Last push: ${doc.settings.sync.lastPushedAt ?? 'never'}.`),
            h('button', { class: 'btn-primary', onClick: () => callbacks.syncNow().then(() => toast('Synced.')).catch((e) => toast('Sync failed: ' + e.message)) }, 'Sync now'),
            h('button', { class: 'btn-secondary', onClick: async () => {
              if (await confirmDialog('Disconnect from GitHub Gist? Your local data stays.')) {
                callbacks.disconnect();
                toast('Disconnected.');
              }
            } }, 'Disconnect')
          )
        : h('div', null,
            h('p', null, 'Paste a fine-grained personal access token with gist scope only.'),
            tokenInput,
            h('button', { class: 'btn-primary', onClick: async () => {
              const token = tokenInput.value.trim();
              if (!token) { toast('Paste a token first.'); return; }
              try {
                await callbacks.connectGist(token);
                toast('Connected.');
              } catch (e) {
                toast('Connection failed: ' + e.message);
              }
            } }, 'Connect')
          )
    ),

    h('section', null,
      h('h2', null, 'Backup'),
      h('button', { class: 'btn-secondary', onClick: () => {
        const blob = new Blob([store.exportJson()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `subscriptions-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } }, 'Export JSON'),
      h('label', { class: 'import-label' }, 'Import JSON',
        h('input', { type: 'file', accept: 'application/json', onChange: async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const text = await file.text();
          const mode = (await confirmDialog('Replace all data with the imported file? Tap Cancel to merge instead.')) ? 'replace' : 'merge';
          try {
            store.importJson(text, { mode });
            toast(`Imported (${mode}).`);
          } catch (err) {
            toast('Import failed: ' + err.message);
          }
        } })
      )
    )
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/settings.js
git commit -m "$(cat <<'EOF'
feat: add settings view (defaults, gist sync, JSON export/import)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: App entry, router, and config (`src/app.js`, `src/config.js`)

**Files:**
- Create: `src/config.js`
- Create: `src/app.js`

`app.js` wires everything together: hash-based router, store and sync init, status callback, re-render on store changes, online/offline retry.

The PAT is stored in `localStorage` under `subtracker.gistToken` (not in the document — spec §4 notes). On boot we read it; the sync client is created only when a token exists.

- [ ] **Step 1: Implement `src/config.js`**

```js
// Set this to the deployed site URL (no trailing slash) before going live.
// It is embedded into .ics DESCRIPTION fields so events deep-link back here.
export const BASE_URL = window.location.origin + window.location.pathname.replace(/\/$/, '');
```

- [ ] **Step 2: Implement `src/app.js`**

```js
import { createStore } from './store.js';
import { createSync } from './sync.js';
import { listView } from './ui/list.js';
import { formView } from './ui/form.js';
import { settingsView } from './ui/settings.js';
import { mount } from './lib/dom.js';

const TOKEN_KEY = 'subtracker.gistToken';
const rootEl = document.getElementById('app-root');
let syncStatus = { state: 'grey', message: 'Not connected' };
let sync = null;
let token = localStorage.getItem(TOKEN_KEY);

const store = createStore({
  storage: localStorage,
  now: () => new Date(),
  uuid: () => crypto.randomUUID()
});

function buildSync(t) {
  return createSync({
    store,
    fetch: (...args) => fetch(...args),
    token: t,
    onStatusChange: (s) => { syncStatus = s; render(); }
  });
}

if (token) {
  sync = buildSync(token);
  if (store.getDocument().settings.gistId) {
    sync.pull().catch((err) => console.error('Initial pull failed', err));
  }
}

store.subscribe(() => {
  if (sync) sync.schedulePush();
  render();
});

window.addEventListener('online', () => {
  if (sync && sync.isDirty()) sync.push().catch((err) => console.error('Online push failed', err));
});

function navigate(hash) {
  window.location.hash = hash;
}

function render() {
  const doc = store.getDocument();
  const hash = window.location.hash || '#/';
  let view;
  if (hash === '#/' || hash === '') {
    view = listView(doc, syncStatus, new Date());
  } else if (hash === '#/new') {
    view = formView({ doc, store, sync: sync ?? { schedulePush: () => {} }, navigate });
  } else if (hash.startsWith('#/edit/')) {
    const id = hash.slice('#/edit/'.length);
    view = formView({ doc, store, sync: sync ?? { schedulePush: () => {} }, navigate, subId: id });
  } else if (hash === '#/settings') {
    view = settingsView({
      doc,
      store,
      callbacks: {
        connectGist: async (t) => {
          localStorage.setItem(TOKEN_KEY, t);
          token = t;
          sync = buildSync(t);
          await sync.createGist();
        },
        syncNow: async () => {
          if (!sync) throw new Error('Not connected');
          await sync.pull();
          if (sync.isDirty()) await sync.flushNow();
        },
        disconnect: () => {
          localStorage.removeItem(TOKEN_KEY);
          token = null;
          sync = null;
          store.updateSettings({ gistId: null, tokenHint: null });
          syncStatus = { state: 'grey', message: 'Not connected' };
        }
      }
    });
  } else {
    navigate('#/');
    return;
  }
  mount(rootEl, view);
}

window.addEventListener('hashchange', render);
render();
```

- [ ] **Step 3: Commit**

```bash
git add src/app.js src/config.js
git commit -m "$(cat <<'EOF'
feat: wire app entry, hash router, and config base URL

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: HTML shell and stylesheet (`index.html`, `styles/app.css`)

**Files:**
- Create: `index.html`
- Create: `styles/app.css`

- [ ] **Step 1: Create `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  <meta name="theme-color" content="#0b1b3a" />
  <title>Subscriptions</title>
  <link rel="manifest" href="manifest.webmanifest" />
  <link rel="apple-touch-icon" href="icons/apple-touch-icon.png" />
  <link rel="stylesheet" href="styles/app.css" />
</head>
<body>
  <div id="app-root"></div>
  <div id="toast-root"></div>
  <script type="module" src="src/app.js"></script>
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
    }
  </script>
</body>
</html>
```

- [ ] **Step 2: Create `styles/app.css`**

```css
:root {
  --bg: #f6f7fb;
  --fg: #0b1b3a;
  --muted: #5b6478;
  --accent: #2c5dff;
  --upcoming-bg: #e0ebff;
  --overdue-bg: #ffe1ec;
  --danger: #c1264a;
  --card: #ffffff;
  --border: #e1e4ec;
  --safe-top: env(safe-area-inset-top, 0);
  --safe-bottom: env(safe-area-inset-bottom, 0);
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font: 16px/1.4 -apple-system, BlinkMacSystemFont, sans-serif;
  background: var(--bg); color: var(--fg);
  min-height: 100vh;
}

.screen { padding: calc(12px + var(--safe-top)) 16px calc(96px + var(--safe-bottom)); max-width: 640px; margin: 0 auto; }
.topbar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.topbar .totals { flex: 1; display: flex; gap: 12px; }
.total-mo { font-weight: 700; }
.total-yr { color: var(--muted); }
.cog { text-decoration: none; font-size: 22px; color: var(--fg); }
.back { text-decoration: none; color: var(--accent); }

.status-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.status-grey { background: #b5bbcc; }
.status-green { background: #2ecc71; }
.status-amber { background: #f5a623; }
.status-red { background: #d0021b; }

.empty { color: var(--muted); padding: 32px 0; text-align: center; }

.sub-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
.sub-row { background: var(--card); border: 1px solid var(--border); border-radius: 12px; display: flex; align-items: center; }
.sub-row.row-upcoming { background: var(--upcoming-bg); }
.sub-row.row-overdue { background: var(--overdue-bg); }
.sub-link { flex: 1; padding: 12px 14px; text-decoration: none; color: inherit; display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; align-items: center; }
.sub-name { font-weight: 600; }
.sub-amount { color: var(--muted); text-align: right; font-variant-numeric: tabular-nums; }
.sub-when { grid-column: 1 / 2; color: var(--muted); font-size: 14px; }
.chip { grid-column: 2 / 3; justify-self: end; font-size: 12px; padding: 2px 8px; border-radius: 999px; background: #eef1f8; color: var(--muted); }
.sub-extlink { padding: 12px 14px; text-decoration: none; color: var(--accent); }

.fab {
  position: fixed; right: 20px; bottom: calc(20px + var(--safe-bottom));
  width: 56px; height: 56px; border-radius: 50%; background: var(--accent); color: white;
  font-size: 32px; text-decoration: none; display: grid; place-items: center;
  box-shadow: 0 6px 16px rgba(44, 93, 255, 0.35);
}

.sub-form { display: grid; gap: 12px; }
.sub-form label { display: grid; gap: 4px; font-size: 14px; color: var(--muted); }
.sub-form input, .sub-form select, .sub-form textarea {
  font: inherit; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: white; color: var(--fg);
}
.sub-form textarea { min-height: 80px; resize: vertical; }
.form-actions { display: flex; gap: 8px; margin-top: 12px; }
.btn-primary { background: var(--accent); color: white; border: 0; padding: 10px 16px; border-radius: 10px; font-weight: 600; }
.btn-secondary { background: white; color: var(--accent); border: 1px solid var(--accent); padding: 10px 16px; border-radius: 10px; text-decoration: none; }
.btn-danger { background: white; color: var(--danger); border: 1px solid var(--danger); padding: 10px 16px; border-radius: 10px; margin-top: 16px; }
.link-open-account { display: inline-block; margin-top: 12px; color: var(--accent); }

.screen-settings section { margin: 16px 0; padding: 12px; background: var(--card); border: 1px solid var(--border); border-radius: 12px; }
.screen-settings h2 { margin: 0 0 8px; font-size: 16px; }
.token-input { width: 100%; margin: 8px 0; }
.import-label { display: inline-flex; align-items: center; gap: 8px; margin-top: 8px; }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: grid; place-items: center; z-index: 10; }
.modal { background: white; padding: 20px; border-radius: 12px; max-width: 320px; }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }

.toast { position: fixed; left: 16px; right: 16px; bottom: calc(90px + var(--safe-bottom)); background: var(--fg); color: white; padding: 12px 16px; border-radius: 12px; display: flex; gap: 12px; align-items: center; z-index: 20; }
.toast-action { background: var(--accent); color: white; border: 0; padding: 6px 12px; border-radius: 8px; font-weight: 600; }
```

- [ ] **Step 3: Sanity check by serving locally**

Run Python's built-in static server (no extra deps needed) from the repo root:

```bash
uv run --no-project python -m http.server 8000
```

In your browser open `http://localhost:8000/`. You should see an empty list with the "+" button. Add a subscription via the form; the row should appear with the right relative-time label.

(Stop the server with Ctrl-C when done.)

- [ ] **Step 4: Commit**

```bash
git add index.html styles/app.css
git commit -m "$(cat <<'EOF'
feat: add app HTML shell and stylesheet

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: PWA manifest and service worker (`manifest.webmanifest`, `sw.js`)

**Files:**
- Create: `manifest.webmanifest`
- Create: `sw.js`

- [ ] **Step 1: Create `manifest.webmanifest`**

```json
{
  "name": "Subscriptions",
  "short_name": "Subs",
  "start_url": ".",
  "scope": ".",
  "display": "standalone",
  "background_color": "#f6f7fb",
  "theme_color": "#0b1b3a",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 2: Create `sw.js`**

```js
const CACHE_NAME = 'subtracker-shell-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './styles/app.css',
  './src/app.js',
  './src/store.js',
  './src/sync.js',
  './src/ics.js',
  './src/totals.js',
  './src/config.js',
  './src/lib/date.js',
  './src/lib/dom.js',
  './src/ui/components.js',
  './src/ui/list.js',
  './src/ui/form.js',
  './src/ui/settings.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin === 'https://api.github.com') return; // never cache API calls
  event.respondWith(
    caches.match(event.request).then((cached) => cached ?? fetch(event.request))
  );
});
```

- [ ] **Step 3: Bump CACHE_NAME convention**

Anyone making a code change later must bump `CACHE_NAME` (e.g., `subtracker-shell-v2`) so the service worker picks up the new shell. Note this in the README in Task 16.

- [ ] **Step 4: Commit**

```bash
git add manifest.webmanifest sw.js
git commit -m "$(cat <<'EOF'
feat: add PWA manifest and offline-shell service worker

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Icons (`tools/`, `icons/`)

**Files:**
- Create: `tools/icon-source.svg`
- Create: `tools/make-icons.mjs`
- Create: `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable-512.png`, `icons/apple-touch-icon.png`

- [ ] **Step 1: Create `tools/icon-source.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0b1b3a"/>
  <rect x="96" y="128" width="320" height="288" rx="32" fill="#f6f7fb"/>
  <rect x="96" y="128" width="320" height="64" rx="32" fill="#2c5dff"/>
  <circle cx="176" cy="128" r="20" fill="#2c5dff"/>
  <circle cx="336" cy="128" r="20" fill="#2c5dff"/>
  <rect x="144" y="240" width="48" height="48" rx="6" fill="#2c5dff"/>
  <rect x="232" y="240" width="48" height="48" rx="6" fill="#cfd6e8"/>
  <rect x="320" y="240" width="48" height="48" rx="6" fill="#cfd6e8"/>
  <rect x="144" y="312" width="48" height="48" rx="6" fill="#cfd6e8"/>
  <rect x="232" y="312" width="48" height="48" rx="6" fill="#cfd6e8"/>
  <circle cx="384" cy="384" r="56" fill="#2c5dff"/>
  <path d="M384 360 v32 l24 16" stroke="#f6f7fb" stroke-width="10" stroke-linecap="round" fill="none"/>
</svg>
```

- [ ] **Step 2: Create `tools/make-icons.mjs`**

```js
import sharp from 'sharp';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const svgPath = resolve(here, 'icon-source.svg');
const outDir = resolve(repoRoot, 'icons');

const targets = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-maskable-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 }
];

await mkdir(outDir, { recursive: true });
const svg = await readFile(svgPath);
for (const t of targets) {
  const out = resolve(outDir, t.name);
  await sharp(svg).resize(t.size, t.size).png().toFile(out);
  console.log('wrote', t.name);
}
```

- [ ] **Step 3: Install `sharp` and generate the icons**

Run:

```bash
npm install
npm run icons
```

Expected: four PNG files appear in `icons/`. List them: `ls -lh icons/`.

- [ ] **Step 4: Commit**

```bash
git add tools/ icons/ package.json package-lock.json
git commit -m "$(cat <<'EOF'
feat: add icon source SVG, generator, and rendered PWA icons

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: GitHub Actions, README, and on-device verification checklist

**Files:**
- Create: `.github/workflows/test.yml`
- Create: `README.md`

- [ ] **Step 1: Add test workflow**

Create `.github/workflows/test.yml`:

```yaml
name: test
on:
  push:
    branches: [main]
  pull_request:

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm test
```

- [ ] **Step 2: Add README**

Create `README.md`:

```markdown
# Subscription Tracker

Personal PWA for tracking recurring subscriptions on iPhone. Calendar reminders via per-subscription `.ics` exports. Data in `localStorage` with auto-sync to a private GitHub Gist.

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

## Connect Gist sync

1. On GitHub, create a fine-grained personal access token at `https://github.com/settings/personal-access-tokens/new`:
   - Resource owner: yourself.
   - Repository access: *None* (gists are user-scoped).
   - Permissions → **Gists: Read and write** (no other scopes).
   - Expiration: as long as you're comfortable with (e.g., 1 year).
2. Copy the token (shown once).
3. In the app: Settings → paste token → Connect.

## Manual smoke test (run after every deploy)

- [ ] Open the site in Safari. List view loads with totals (£0 /mo if empty).
- [ ] Tap "+". Form opens. Fill all fields, including a URL. Save.
- [ ] Row appears with the correct relative time and a "↗" link icon.
- [ ] Tap the toast "Add". An `.ics` file downloads and prompts you to add to a Calendar; pick the "Subscriptions" calendar.
- [ ] In Calendar, the event appears on the next payment date with an alarm at the right offset.
- [ ] Edit the subscription, change the amount, Save → "Update" toast → re-download `.ics`. The existing Calendar event updates (same UID).
- [ ] Delete the subscription → "Remove" toast → import the CANCEL `.ics`. Calendar event is removed.
- [ ] Settings → Connect → paste token → confirms gist created. Edit a sub → wait 3s → status dot stays green.
- [ ] Force-quit Safari, clear site data, reopen → empty state. Reconnect with the same token → data restored from gist.
- [ ] Settings → Export JSON. File saves to Files / iCloud Drive. Import the file back with "merge" → no duplicates.
- [ ] Toggle airplane mode → app still works → status dot goes amber on save → comes back green on reconnect.
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/test.yml README.md
git commit -m "$(cat <<'EOF'
ci: add unit-test workflow and README with smoke-test checklist

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Run the full test suite end-to-end**

Run: `npm test`
Expected: every test passes. If anything fails, fix it before proceeding to deployment.

---

## Task 17: Deploy and on-device verification

This task is not code — it's the deploy + manual verification gate before declaring v1 shipped. Treat each item as required.

- [ ] **Step 1: Push `main` and verify the test workflow goes green**

```bash
git push origin main
```

Then open the Actions tab on GitHub and confirm the `test` workflow passes.

- [ ] **Step 2: Enable GitHub Pages**

Settings → Pages → Source: "Deploy from a branch", Branch: `main`, Folder: `/ (root)`. Save.

Wait for the deploy to finish and copy the URL.

- [ ] **Step 3: Run the README's "Manual smoke test" on your iPhone**

Tick off each item. Capture any defect as a follow-up issue rather than patching during the smoke run.

- [ ] **Step 4: Confirm reminders fire**

After adding a real subscription with `nextPaymentDate` set to tomorrow and `reminderDaysBefore: 0`, leave the phone overnight and confirm Apple Calendar fires the notification at the expected time.

- [ ] **Step 5: Declare v1 shipped**

Open a brief `RELEASE.md` note or a GitHub Release tagged `v1.0.0` summarizing what's in, what's deferred to v2 (CSV import + others per spec §12), and the URL.

---

## Self-Review Notes

I checked each spec requirement against the plan tasks. Coverage:

- §2 v1 scope:
  - Add/edit/delete → Tasks 5, 10
  - List view with totals → Tasks 4, 9
  - Per-subscription Calendar reminders → Tasks 6, 10
  - Auto-sync to private gist → Tasks 7, 11, 12
  - Manual JSON export/import → Tasks 5, 11
  - Installable PWA + offline shell → Tasks 13, 14, 15
- §4 data model → Task 5 (and consumed everywhere)
- §5 screens → Tasks 9 (list), 10 (form), 11 (settings), 12 (router)
- §6 calendar flow incl. `URL` and trial event → Task 6 + Task 10
- §7 sync incl. last-write-wins, dirty flag, failure modes → Task 7 + Task 12
- §8 export/import → Task 5 + Task 11
- §9 PWA specifics → Tasks 13, 14, 15
- §10 code structure → File Map at the top of this plan
- §11 testing → TDD in every code task; `node:test` runner declared in Task 1; CI in Task 16
- §12 v2 backlog → not implemented, intentionally
- §13 open questions → none

The "Later (post-v2)" Open Banking item is intentionally out of scope.

Type / name consistency check:
- `store.addSubscription / updateSubscription / deleteSubscription / updateSettings / replaceDocument / exportJson / importJson / subscribe / getDocument` — used consistently across Tasks 5, 7, 10, 11, 12.
- `sync.createGist / push / pull / schedulePush / flushNow / isDirty` — used consistently across Tasks 7, 11, 12.
- `buildIcs(sub, settings, { baseUrl, method })` — same signature in Tasks 6 and 10.
- `BASE_URL` exported from `src/config.js` (Task 12), imported by `src/ui/form.js` (Task 10).
- Subscription fields used in `list.js`, `form.js`, `ics.js` all appear in the shape produced by `store.addSubscription`.

No placeholders remain.

### Known gap worth flagging before execution

The spec's §7.1 says "connect" always **creates a new gist**. That matches the plan as written. But during brainstorming you also said: *"After a cache wipe, paste the token again and the app pulls everything back."* That doesn't quite work with always-create — a cache-wipe means the local document is empty, so creating a new gist would push an empty document and leave the original backup gist orphaned. Two ways to close the gap (decide before starting Task 12):

1. **Discover-or-create on connect.** On "Connect", `GET /gists` and look for one containing `subscription-tracker.json`. If found, use it and `pull`. Otherwise `createGist`. Small extra request, makes cache-wipe recovery automatic.
2. **Stay strict to spec.** After a cache wipe, the user restores via the manual JSON export/import path instead. No code change needed.

If you want option 1, ask me to patch the spec §7.1 and Task 7 / Task 12 before starting execution. If you want option 2, we keep the plan as-is.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-16-subscription-tracker.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
