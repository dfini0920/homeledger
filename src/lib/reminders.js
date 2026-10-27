// Pure planner: turns the app's data into a list of local notifications.
// No Capacitor imports here so it can be unit tested in Node.
import { parse, addDays, fmtDate } from './dates.js';

// iOS keeps at most 64 pending local notifications per app, so we schedule the soonest 60
// and re-plan whenever data changes or the app returns to the foreground.
export const MAX_PENDING = 60;

export const DEFAULTS = { notify: true, hour: 9, taskLead: 1, warrantyLead: 30, overdue: true };

// Stable positive 31-bit integer id for a reminder key (Android needs an int id).
export function hashId(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 2147483000) + 1;
}

const atHour = (dateStr, hour) => {
  const d = parse(dateStr);
  d.setHours(hour, 0, 0, 0);
  return d;
};

export function planReminders(state, settings, now = new Date()) {
  const s = { ...DEFAULTS, ...settings };
  if (!s.notify || !state || state.sample) return [];
  const out = [];
  const push = (key, when, title, body, route) => {
    if (when.getTime() > now.getTime() + 60000) out.push({ key, id: hashId(key), at: when, title, body, route });
  };
  const items = state.items || [];
  const nameOf = id => (items.find(i => i.id === id) || {}).name || 'Whole home';

  for (const t of state.tasks || []) {
    if (!t.nextDue) continue;
    const where = nameOf(t.itemId);
    const route = t.itemId ? '#appliance-' + t.itemId : '#maintenance';
    if (s.taskLead > 0) {
      push(
        `t:${t.id}:lead:${t.nextDue}`,
        atHour(addDays(t.nextDue, -s.taskLead), s.hour),
        `Coming up: ${t.title}`,
        `${where} · due ${s.taskLead === 1 ? 'tomorrow' : 'in ' + s.taskLead + ' days'}`,
        route
      );
    }
    push(`t:${t.id}:due:${t.nextDue}`, atHour(t.nextDue, s.hour), `Due today: ${t.title}`, where, route);
    if (s.overdue) {
      push(`t:${t.id}:late:${t.nextDue}`, atHour(addDays(t.nextDue, 3), s.hour), `Overdue: ${t.title}`, `${where} · 3 days past due`, route);
    }
  }

  for (const i of items) {
    if (!i.warrantyEnd) continue;
    const route = '#appliance-' + i.id;
    const leads = [...new Set([s.warrantyLead, 7].filter(n => n > 0 && n <= s.warrantyLead))].sort((a, b) => b - a);
    for (const n of leads) {
      push(
        `w:${i.id}:${n}:${i.warrantyEnd}`,
        atHour(addDays(i.warrantyEnd, -n), s.hour),
        `Warranty ends in ${n} days: ${i.name}`,
        `Expires ${fmtDate(i.warrantyEnd)}. Check for problems and file any claim before then.`,
        route
      );
    }
    push(`w:${i.id}:0:${i.warrantyEnd}`, atHour(i.warrantyEnd, s.hour), `Warranty ends today: ${i.name}`, 'Last day to file a claim.', route);
  }

  out.sort((a, b) => a.at - b.at || a.key.localeCompare(b.key));
  return out.slice(0, MAX_PENDING);
}
