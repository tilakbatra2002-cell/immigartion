export const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const endOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export function monthKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
export function lastNMonthKeys(n, from = new Date()) {
  const out = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  for (let i = n - 1; i >= 0; i -= 1) out.push(monthKey(new Date(cursor.getFullYear(), cursor.getMonth() - i, 1)));
  return out;
}
export function rangeFromQuery({ from, to, days } = {}) {
  const end = to ? endOfDay(new Date(to)) : endOfDay(new Date());
  const start = from ? startOfDay(new Date(from)) : startOfDay(addDays(end, -(Number(days || 30) - 1)));
  return { start, end };
}
