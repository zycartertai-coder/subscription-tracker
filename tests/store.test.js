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

test('replaceDocument overwrites the document without bumping anything (reserved for v2 sync)', () => {
  uuidCounter = 0;
  const clock = fixedClock('2026-05-16T10:00:00Z');
  const store = createStore({ storage: memoryStorage(), now: clock.now, uuid: deterministicUuid });
  const incoming = {
    version: 1,
    updatedAt: '2026-05-16T09:00:00Z',
    settings: { currency: 'GBP', defaultReminderDays: 5, updatedAt: '2026-05-16T09:00:00Z' },
    subscriptions: []
  };
  store.replaceDocument(incoming);
  assert.equal(store.getDocument().settings.defaultReminderDays, 5);
  assert.equal(store.getDocument().updatedAt, '2026-05-16T09:00:00Z');
});
