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
