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
