import test from 'node:test';
import assert from 'node:assert/strict';
import { planReminders, hashId, MAX_PENDING } from '../src/lib/reminders.js';
import { addDays } from '../src/lib/dates.js';

const NOW = new Date(2026, 9, 27, 12, 0, 0); // Oct 27 2026, noon local
const D = n => addDays('2026-10-27', n);
const base = () => ({
  sample: false,
  items: [{ id: 'a1', name: 'Furnace', warrantyEnd: D(40) }, { id: 'a2', name: 'Fridge', warrantyEnd: D(-5) }, { id: 'a3', name: 'Washer', warrantyEnd: '' }],
  tasks: [
    { id: 't1', itemId: 'a1', title: 'Replace filter', nextDue: D(10) },
    { id: 't2', itemId: '', title: 'Clean gutters', nextDue: D(-10) }
  ]
});

test('plans lead, due-day and overdue reminders at the chosen hour', () => {
  const plan = planReminders(base(), { hour: 8, taskLead: 2, warrantyLead: 30, overdue: true }, NOW);
  const keys = plan.map(p => p.key);
  assert.ok(keys.includes(`t:t1:lead:${D(10)}`));
  assert.ok(keys.includes(`t:t1:due:${D(10)}`));
  assert.ok(keys.includes(`t:t1:late:${D(10)}`));
  const lead = plan.find(p => p.key.startsWith('t:t1:lead'));
  assert.equal(lead.at.getHours(), 8);
  assert.equal(lead.at.getDate(), new Date(2026, 9, 27 + 8).getDate());
  assert.equal(lead.route, '#appliance-a1');
});

test('skips reminders already in the past and past-expired warranties', () => {
  const plan = planReminders(base(), {}, NOW);
  assert.ok(plan.every(p => p.at > NOW));
  assert.ok(!plan.some(p => p.key.startsWith('w:a2')));
  assert.ok(!plan.some(p => p.key.includes('t2:due')));
  // overdue task t2: its nudge (due+3) is also in the past
  assert.ok(!plan.some(p => p.key.includes('t2:late')));
});

test('warranty reminders: 30 days, 7 days and the last day', () => {
  const plan = planReminders(base(), {}, NOW).filter(p => p.key.startsWith('w:a1'));
  assert.deepEqual(plan.map(p => p.key.split(':')[2]), ['30', '7', '0']);
});

test('settings can turn reminders or the overdue nudge off', () => {
  assert.equal(planReminders(base(), { notify: false }, NOW).length, 0);
  assert.ok(!planReminders(base(), { overdue: false }, NOW).some(p => p.key.includes(':late:')));
  assert.ok(!planReminders(base(), { taskLead: 0 }, NOW).some(p => p.key.includes(':lead:')));
});

test('no reminders for sample data', () => {
  assert.equal(planReminders({ ...base(), sample: true }, {}, NOW).length, 0);
});

test('caps at the iOS-safe limit, soonest first, with unique ids', () => {
  const tasks = Array.from({ length: 80 }, (_, i) => ({ id: 'x' + i, itemId: '', title: 'Task ' + i, nextDue: D(i + 2) }));
  const plan = planReminders({ sample: false, items: [], tasks }, {}, NOW);
  assert.equal(plan.length, MAX_PENDING);
  for (let i = 1; i < plan.length; i++) assert.ok(plan[i].at >= plan[i - 1].at);
  assert.equal(new Set(plan.map(p => p.id)).size, plan.length);
  assert.ok(plan.every(p => Number.isInteger(p.id) && p.id > 0 && p.id < 2 ** 31));
});

test('ids are stable', () => {
  assert.equal(hashId('t:t1:due:2026-11-06'), hashId('t:t1:due:2026-11-06'));
  assert.notEqual(hashId('a'), hashId('b'));
});
