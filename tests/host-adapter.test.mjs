import test from 'node:test';
import assert from 'node:assert/strict';
import { observeHostActivity } from '../src/client/host-adapter.mjs';
import { createActivityController } from '../src/core/activity.mjs';

function source(value) {
  const listeners = new Set();
  return {
    getSnapshot: () => value,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    set(next) { value = next; for (const fn of [...listeners]) fn(); },
    listeners,
  };
}
function fixture() {
  const list = source({ byId: {} });
  const sessionStatus = source(new Map());
  const bindings = new Map();
  let sequence = 0;
  function add(id, entries = []) {
    const session = source({ running: false, openState: 'ready' });
    session.eventSource = source({ entries, change: { kind: 'replace' } });
    bindings.set(id, { session });
    return session;
  }
  function select(id) { list.set({ byId: id ? { [id]: { id, retainedBy: { mainView: 1 } } } : {} }); }
  function append(id, events) {
    const session = bindings.get(id).session;
    const entries = events.map(([type, turn, reason]) => ({ event: { type, seq: ++sequence, data: { turn, reason: { kind: reason } } } }));
    session.eventSource.set({ entries: [...session.eventSource.getSnapshot().entries, ...entries], change: { kind: 'append', entries } });
  }
  const completed = [], states = [];
  const controller = createActivityController({ onComplete: id => completed.push(id), onChange: state => states.push(state) });
  const dispose = observeHostActivity({ sessions: { list, binding: id => bindings.get(id) }, uiSession: { sessionStatus } }, { onTask: task => controller.setTask(task) });
  return { list, sessionStatus, bindings, add, select, append, completed, states, controller, dispose };
}

test('new starts and completed ends in one append still produce one real completion', () => {
  const f = fixture(); f.add('s'); f.select('s');
  f.append('s', [['turn/start', 1], ['turn/end', 1, 'completed']]);
  assert.deepEqual(f.completed, ['s:1']);
  assert.equal(f.states.some(state => state.windPlaying), true);
  assert.equal(f.controller.getState().windPlaying, false);
  f.dispose();
});

test('permission waits pause wind without breaking the same task completion', () => {
  const f = fixture(); f.add('s'); f.select('s');
  f.append('s', [['turn/start', 1]]);
  f.sessionStatus.set(new Map([['s', { running: true, pendingInteraction: { key: 'permission' } }]]));
  assert.equal(f.controller.getState().status, 'waiting');
  assert.equal(f.controller.getState().windPlaying, false);
  f.sessionStatus.set(new Map([['s', { running: true }]]));
  assert.equal(f.controller.getState().windPlaying, true);
  f.append('s', [['turn/end', 1, 'completed']]);
  assert.deepEqual(f.completed, ['s:1']);
  f.dispose();
});

test('aborted, interrupted and failed turns never receive a completion stamp', () => {
  const f = fixture(); f.add('s'); f.select('s');
  for (const [i, reason] of ['aborted', 'interrupted', 'failed'].entries()) {
    f.append('s', [['turn/start', i], ['turn/end', i, reason]]);
    assert.equal(f.controller.getState().windPlaying, false);
  }
  assert.deepEqual(f.completed, []); f.dispose();
});

test('historical baselines and duplicate end delivery do not celebrate', () => {
  const f = fixture();
  const old = { event: { type: 'turn/end', seq: 99, data: { turn: 7, reason: { kind: 'completed' } } } };
  const s = f.add('s', [old]); f.select('s');
  s.eventSource.set({ entries: [old], change: { kind: 'append', entries: [old] } });
  assert.deepEqual(f.completed, []);
  f.append('s', [['turn/start', 8], ['turn/end', 8, 'completed']]);
  assert.deepEqual(f.completed, ['s:8']);
  const snapshot = s.eventSource.getSnapshot(); s.eventSource.set(snapshot);
  assert.deepEqual(f.completed, ['s:8']); f.dispose();
});

test('reconnect history cannot finish a previously observed running task', () => {
  const f = fixture(); const s = f.add('s'); f.select('s');
  f.append('s', [['turn/start', 1]]);
  const entries = [...s.eventSource.getSnapshot().entries, { event: { type: 'turn/end', seq: 90, data: { turn: 1, reason: { kind: 'completed' } } } }];
  s.eventSource.set({ entries, change: { kind: 'replace' } });
  s.eventSource.set({ entries, change: { kind: 'append', entries: entries.slice(-1) } });
  assert.deepEqual(f.completed, []); f.dispose();
});

test('switching sessions detaches old event sources; disposal releases all subscriptions', () => {
  const f = fixture(); const a = f.add('a'), b = f.add('b');
  f.select('a'); f.append('a', [['turn/start', 1]]); f.select('b');
  f.append('a', [['turn/end', 1, 'completed']]);
  assert.deepEqual(f.completed, []);
  assert.equal(a.listeners.size + a.eventSource.listeners.size, 0);
  f.dispose(); f.dispose();
  assert.equal(f.list.listeners.size + f.sessionStatus.listeners.size + b.listeners.size + b.eventSource.listeners.size, 0);
});
