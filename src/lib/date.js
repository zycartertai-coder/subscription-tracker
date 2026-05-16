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
