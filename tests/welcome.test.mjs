import test from 'node:test';
import assert from 'node:assert/strict';
import { createWelcomeController } from '../src/core/welcome.mjs';
const key = 'aha-dsh-wallpaper.welcomes.v1';
function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('each new conversation draws independently from all three variants', () => {
  let draws = 0;
  const samples = [.05, .48, .93, .05];
  const controller = createWelcomeController({ storage: null, random: () => samples[draws++] });
  assert.deepEqual(['one','two','three','four'].map(id => controller.activateSession(id).variant), ['wink','heart','shy','wink']);
  assert.equal(draws, 4);
});

test('rerenders, repeated bindings and transient unbound states never redraw', () => {
  let draws = 0, notifications = 0;
  const controller = createWelcomeController({ storage: null, random: () => { draws++; return .4; } });
  controller.subscribe(() => notifications++);
  const first = controller.activateSession('one');
  for (let i = 0; i < 20; i++) {
    assert.equal(controller.activateSession('one'), first);
    assert.equal(controller.activateSession(null), first);
    assert.equal(controller.getSnapshot(), first);
  }
  assert.equal(draws, 1);
  assert.equal(notifications, 1);
  assert.equal(Object.isFrozen(first), true);
});

test('switching to an existing conversation and page refresh retain its choice', () => {
  const saved = storage();
  let sample = .05;
  const controller = createWelcomeController({ storage: saved, random: () => sample });
  const one = controller.activateSession('one').variant;
  sample = .8;
  assert.equal(controller.activateSession('two').variant, 'shy');
  assert.equal(controller.activateSession('one').variant, one);
  controller.dispose();
  const reloaded = createWelcomeController({ storage: saved, random: () => .8 });
  assert.equal(reloaded.activateSession('one').variant, one);
});

test('corrupt cache and unavailable storage fall back without blocking new sessions', () => {
  const malformed = createWelcomeController({ storage: { getItem: () => '{bad', setItem: () => { throw Error(); } }, random: () => .5 });
  assert.equal(malformed.activateSession('one').variant, 'heart');
  assert.equal(malformed.activateSession('two').variant, 'heart');
  const invalid = createWelcomeController({ storage: {getItem: () => JSON.stringify({version:1,choices:[['one','file:///x'],['two','shy']]})}, random: () => .01 });
  assert.equal(invalid.activateSession('one').variant, 'wink');
  assert.equal(invalid.activateSession('two').variant, 'shy');
});

test('cache is bounded and disposal stops notifications, draws and writes', () => {
  const saved = storage();
  let draws = 0, notifications = 0;
  const controller = createWelcomeController({ storage: saved, random: () => { draws++; return .6; } });
  const off = controller.subscribe(() => notifications++);
  for (let i = 0; i < 400; i++) controller.activateSession(`session-${i}`);
  assert.equal(JSON.parse(saved.getItem(key)).choices.length, 256);
  const before = saved.getItem(key), drawCount = draws, noticeCount = notifications;
  off(); controller.dispose(); controller.dispose();
  controller.activateSession('later');
  assert.equal(saved.getItem(key), before);
  assert.equal(draws, drawCount); assert.equal(notifications, noticeCount);
});
