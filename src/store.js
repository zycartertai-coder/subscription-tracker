const STORAGE_KEY = 'subtracker.document';

export const EMPTY_DOCUMENT = Object.freeze({
  version: 1,
  updatedAt: '1970-01-01T00:00:00.000Z',
  settings: Object.freeze({
    currency: 'GBP',
    defaultReminderDays: 2,
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
