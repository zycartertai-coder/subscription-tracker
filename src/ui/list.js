import { h } from '../lib/dom.js';
import { totalMonthly, totalYearly } from '../totals.js';
import { parseISODate, daysBetween, relativeFromNow } from '../lib/date.js';
import { chip } from './components.js';

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

export function listView(doc, now = new Date()) {
  const subs = [...doc.subscriptions].sort(
    (a, b) => a.nextPaymentDate.localeCompare(b.nextPaymentDate)
  );
  const currency = doc.settings.currency;
  return h('div', { class: 'screen screen-list' },
    h('header', { class: 'topbar' },
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
