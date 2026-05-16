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
  const v = totalMonthly(subs);
  assert.ok(Math.abs(v - 22.99) < 0.001, `expected ~22.99, got ${v}`);
});

test('totalYearly sums yearly equivalents', () => {
  const subs = [
    { amount: 10, frequency: 'monthly' },
    { amount: 30, frequency: 'yearly' }
  ];
  assert.equal(totalYearly(subs), 150);
});
