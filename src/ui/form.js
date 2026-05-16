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

export function formView({ doc, store, navigate, subId = null }) {
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
    editing && h('button', { type: 'button', class: 'btn-secondary', onClick: onReexport }, 'Re-export to Calendar'),
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
    const ics = buildIcs(saved, doc.settings, { baseUrl: BASE_URL, method: 'REQUEST' });
    navigate('#/');
    toast(editing ? 'Saved. Update Calendar reminder?' : 'Saved. Add reminders to Calendar?', {
      label: editing ? 'Update' : 'Add',
      onClick: () => downloadIcs(`${saved.name}.ics`, ics)
    });
  }

  function onReexport() {
    const ics = buildIcs(existing, doc.settings, { baseUrl: BASE_URL, method: 'REQUEST' });
    downloadIcs(`${existing.name}.ics`, ics);
    toast('Re-exported calendar reminder.');
  }

  async function onDelete() {
    const ok = await confirmDialog(`Delete "${existing.name}"? This cannot be undone.`);
    if (!ok) return;
    const cancelIcs = buildIcs(existing, doc.settings, { baseUrl: BASE_URL, method: 'CANCEL' });
    store.deleteSubscription(existing.id);
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
