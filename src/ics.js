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
