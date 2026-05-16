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
