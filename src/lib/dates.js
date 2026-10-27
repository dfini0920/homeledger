// Date and formatting helpers. Dates are 'YYYY-MM-DD' strings in local time.
export const iso = d => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
export const today = () => iso(new Date());
export const parse = s => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (s, n) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
export const addMonths = (s, n) => {
  const d = parse(s);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return iso(d);
};
export const diff = (a, b) => Math.round((parse(a) - parse(b)) / 864e5);
export const fmtDate = s =>
  s ? parse(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
export const money = n =>
  n == null || n === ''
    ? '—'
    : Number(n).toLocaleString(undefined, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: Number(n) % 1 ? 2 : 0,
        maximumFractionDigits: 2
      });
export const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
export const fmtSize = b =>
  b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
