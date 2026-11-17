import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PREFERENCES, normalizePreferences, createPreferencesStore } from '../src/core/preferences.mjs';
import { createActivityController } from '../src/core/activity.mjs';

function storageWith(value) {
  let saved = value;
  const writes = [];
  return {
    getItem() { return saved; },
    setItem(key, next) { writes.push({ key, value: next }); saved = next; },
    writes,
  };
}

test('static theater and three animated avatar choices migrate, whitelist IDs and retain independent motion and pause', () => {
  const storage = storageWith(JSON.stringify({version:1,preferences:{selectedWallpaper:'teatime',windPaused:true,wallpaperPaused:true}}));
  const store = createPreferencesStore({storage});
  assert.equal(store.get().selectedPortrait,'theater');
  assert.equal(store.get().portraitMotionEnabled,true);
  assert.equal(storage.writes.length,0);
  store.update({selectedPortrait:'peace',portraitMotionEnabled:false,portraitPaused:true});
  const restored = createPreferencesStore({storage});
  assert.equal(restored.get().selectedPortrait,'peace');
  assert.equal(restored.get().portraitMotionEnabled,false);
  assert.equal(restored.get().portraitPaused,true);
  assert.equal(restored.get().wallpaperPaused,true);
  assert.equal(restored.get().windPaused,true);
  assert.equal(normalizePreferences({selectedPortrait:'https://example.test/movie.mp4'}).selectedPortrait,'theater');
  restored.reset(); assert.equal(restored.get().selectedPortrait,'theater');
});

test('corrupt and future storage fall back without writing on startup', () => {
  for (const raw of ['{broken', 'null', '42', '[]', JSON.stringify({ version: 99, preferences: { windEnabled: false } })]) {
    const storage = storageWith(raw);
    const store = createPreferencesStore({ storage });
    assert.deepEqual(store.get(), DEFAULT_PREFERENCES);
    assert.equal(storage.writes.length, 0);
  }
});

test('a legacy preferences object is safely migrated on the next actual edit', () => {
  const storage = storageWith(JSON.stringify({ selectedWallpaper: 'teatime', windPaused: true, unrelatedToken: 'never-save' }));
  const store = createPreferencesStore({ storage });
  assert.equal(store.get().selectedWallpaper, 'teatime');
  assert.equal(store.get().windPaused, true);
  assert.equal(storage.writes.length, 0);
  store.update({ decorationsEnabled: false });
  assert.equal(storage.writes.length, 1);
  const saved = JSON.parse(storage.writes[0].value);
  assert.equal(saved.version, 1);
  assert.equal(saved.preferences.selectedWallpaper, 'teatime');
  assert.equal(saved.preferences.windPaused, true);
  assert.equal(Object.hasOwn(saved.preferences, 'unrelatedToken'), false);
});

test('untrusted preferences cannot add local paths, URLs or unbounded favorites', () => {
  const result = normalizePreferences({
    selectedWallpaper: 'file:///C:/private.jpg',
    favorites: ['portrait', 'https://example.test/art.png', 'portrait', 'teatime', '../private.jpg', 'gilded-stage', {}, 'teatime'],
    wallpaperOpacity: -10,
    readingMask: 200,
    windEnabled: 'false',
    windPaused: 1,
    path: 'C:\\private.jpg',
  });
  assert.equal(result.selectedWallpaper, 'gilded-stage');
  assert.deepEqual(result.favorites, ['portrait', 'teatime', 'gilded-stage']);
  assert.equal(result.wallpaperOpacity, 0.25);
  assert.equal(result.readingMask, 1);
  assert.equal(result.windEnabled, true);
  assert.equal(result.windPaused, false);
  assert.equal(Object.hasOwn(result, 'path'), false);
  assert.equal(normalizePreferences({ wallpaperOpacity: Infinity, readingMask: NaN }).wallpaperOpacity, 0.9);
  assert.equal(normalizePreferences({ wallpaperOpacity: Infinity, readingMask: NaN }).readingMask, 0.96);
});

test('interface motion preference migrates independently from wind and persists when disabled', () => {
  const storage = storageWith(JSON.stringify({version:1,preferences:{windEnabled:true,windPaused:true}}));
  const store = createPreferencesStore({storage});
  assert.equal(store.get().interfaceMotionEnabled,true);
  store.update({interfaceMotionEnabled:false});
  const reopened = createPreferencesStore({storage});
  assert.equal(reopened.get().interfaceMotionEnabled,false);
  assert.equal(reopened.get().windEnabled,true);
  assert.equal(reopened.get().windPaused,true);
  reopened.reset();
  assert.equal(reopened.get().interfaceMotionEnabled,true);
});

test('new video preferences preserve manual pause independently of wind and the selected gallery item',()=>{
 const storage=storageWith(JSON.stringify({version:1,preferences:{selectedWallpaper:'portrait',windPaused:true}}));
 const store=createPreferencesStore({storage});
 assert.equal(store.get().dynamicWallpaperEnabled,true); assert.equal(store.get().welcomeMotionEnabled,true);
 store.update({wallpaperPaused:true,welcomeMotionEnabled:false}); store.update({selectedWallpaper:'gilded-stage'});
 const reopened=createPreferencesStore({storage});
 assert.equal(reopened.get().wallpaperPaused,true); assert.equal(reopened.get().welcomeMotionEnabled,false);
 assert.equal(reopened.get().windPaused,true); assert.equal(reopened.get().selectedWallpaper,'gilded-stage');
});

test('environment motion migrates safely and persists independently of input, wind and wallpaper pause',()=>{
 const storage=storageWith(JSON.stringify({version:1,preferences:{interfaceMotionEnabled:false,wallpaperPaused:true,windPaused:true}}));
 const store=createPreferencesStore({storage});
 assert.equal(store.get().environmentMotionEnabled,true);
 assert.equal(storage.writes.length,0);
 store.update({environmentMotionEnabled:false});
 const restored=createPreferencesStore({storage});
 assert.equal(restored.get().environmentMotionEnabled,false);
 assert.equal(restored.get().interfaceMotionEnabled,false);
 assert.equal(restored.get().wallpaperPaused,true);
 assert.equal(restored.get().windPaused,true);
 restored.reset();assert.equal(restored.get().environmentMotionEnabled,true);
});

test('only own fields are accepted and even catalog overrides cannot allow resource URLs', () => {
  const inherited = Object.create({ selectedWallpaper: 'portrait', windEnabled: false });
  assert.deepEqual(normalizePreferences(inherited), DEFAULT_PREFERENCES);
  const custom = normalizePreferences({ selectedWallpaper: 'https://example.test/a.jpg', favorites: ['portrait', 'https://example.test/a.jpg'] }, ['portrait', 'https://example.test/a.jpg']);
  assert.equal(custom.selectedWallpaper, 'portrait');
  assert.deepEqual(custom.favorites, ['portrait']);
});

test('portrait toggle migrates without overwriting existing choices and persists independently', () => {
  const storage = storageWith(JSON.stringify({version:1,preferences:{selectedWallpaper:'teatime',decorationsEnabled:false,windPaused:true}}));
  const store = createPreferencesStore({storage});
  assert.equal(store.get().portraitEnabled,true);
  assert.equal(storage.writes.length,0);
  store.update({portraitEnabled:false});
  const restored = createPreferencesStore({storage});
  assert.equal(restored.get().portraitEnabled,false);
  assert.equal(restored.get().selectedWallpaper,'teatime');
  assert.equal(restored.get().decorationsEnabled,false);
  assert.equal(restored.get().windPaused,true);
  restored.reset();
  assert.equal(restored.get().portraitEnabled,true);
});

test('returned snapshots and subscribers cannot mutate saved preference state', () => {
  const store = createPreferencesStore({ storage: storageWith(null) });
  const first = store.get();
  first.favorites.push('portrait');
  first.windEnabled = false;
  assert.deepEqual(store.get().favorites, []);
  assert.equal(store.get().windEnabled, true);
  const seen = [];
  store.subscribe((snapshot) => { snapshot.favorites.push('teatime'); throw new Error('renderer failed'); });
  store.subscribe((snapshot) => seen.push(snapshot));
  store.update({ favorites: ['portrait'] });
  assert.deepEqual(seen[0].favorites, ['portrait']);
  assert.deepEqual(store.get().favorites, ['portrait']);
});

test('blocked storage stays usable and disposal stops persistence and notifications', () => {
  const storage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } };
  const store = createPreferencesStore({ storage });
  let count = 0;
  const unsubscribe = store.subscribe(() => count++);
  assert.doesNotThrow(() => store.update({ windPaused: true }));
  assert.equal(store.get().windPaused, true);
  assert.equal(count, 1);
  unsubscribe();
  unsubscribe();
  store.reset();
  assert.equal(store.get().windPaused, false);
  assert.equal(count, 1);
  store.dispose();
  store.dispose();
  store.update({ windPaused: true });
  store.reset();
  assert.equal(store.get().windPaused, false);
});

test('duplicate subscriptions have independent disposal and no-op updates do not write', () => {
  const storage = storageWith(null);
  const store = createPreferencesStore({ storage });
  let count = 0;
  const callback = () => count++;
  const unsubscribe = store.subscribe(callback);
  store.subscribe(callback);
  unsubscribe();
  store.update({ windEnabled: true });
  store.update({ unrelated: 'ignored' });
  assert.equal(count, 0);
  assert.equal(storage.writes.length, 0);
  store.update({ windEnabled: false });
  assert.equal(count, 1);
  assert.equal(storage.writes.length, 1);
});

test('subscriber disposal and derived updates preserve notification ordering', () => {
  const store = createPreferencesStore({ storage: storageWith(null) });
  const seen = [];
  let unsubscribeSecond;
  store.subscribe((snapshot) => {
    unsubscribeSecond();
    if (!snapshot.windEnabled && !snapshot.windPaused) store.update({ windPaused: true });
  });
  unsubscribeSecond = store.subscribe(() => { throw new Error('Unsubscribed listener was called'); });
  store.subscribe((snapshot) => seen.push([snapshot.windEnabled, snapshot.windPaused]));
  store.update({ windEnabled: false });
  assert.deepEqual(seen, [[false, false], [false, true]]);
  assert.equal(store.get().windPaused, true);
});

test('wind runs only during a live running task and manual pause survives task changes', () => {
  const controller = createActivityController();
  assert.equal(controller.getState().windPlaying, false);
  controller.setTask({ id: 'turn-a', status: 'running' });
  assert.equal(controller.getState().windPlaying, true);
  controller.setPreferences({ windPaused: true });
  assert.equal(controller.getState().busy, true);
  assert.equal(controller.getState().windPlaying, false);
  controller.setTask({ id: 'turn-a', status: 'complete' });
  controller.setTask({ id: 'turn-b', status: 'running' });
  assert.equal(controller.getState().windPaused, true);
  assert.equal(controller.getState().windPlaying, false);
  controller.setPreferences({ windPaused: false });
  assert.equal(controller.getState().windPlaying, true);
  controller.setTask({ id: 'turn-b', status: 'waiting' });
  assert.equal(controller.getState().busy, false);
  assert.equal(controller.getState().windPlaying, false);
  controller.setTask(null);
  assert.equal(controller.getState().status, 'idle');
});

test('visibility, reduced motion and the independent wind preference all gate playback', () => {
  const controller = createActivityController();
  controller.setTask({ id: 'turn-a', status: 'running' });
  controller.setVisibility(false);
  assert.equal(controller.getState().windPlaying, false);
  assert.equal(controller.getState().busy, true);
  controller.setVisibility(true);
  controller.setReducedMotion(true);
  assert.equal(controller.getState().windPlaying, false);
  controller.setReducedMotion(false);
  assert.equal(controller.getState().windPlaying, true);
  controller.setPreferences({ windEnabled: false });
  assert.equal(controller.getState().windPlaying, false);
  controller.setPreferences({ windEnabled: true, decorationsEnabled: false });
  assert.equal(controller.getState().windPlaying, true);
});

test('celebration follows a real successful run exactly once, after wind stops', () => {
  const events = [];
  const controller = createActivityController({
    onChange: (state) => events.push(['change', state.status, state.windPlaying]),
    onComplete: (id) => events.push(['complete', id]),
  });
  controller.setTask({ id: 'turn-a', status: 'running' });
  controller.setTask({ id: 'turn-a', status: 'waiting' });
  controller.setTask({ id: 'turn-a', status: 'running' });
  controller.setTask({ id: 'turn-a', status: 'complete' });
  controller.setTask({ id: 'turn-a', status: 'complete' });
  assert.deepEqual(events.slice(-2), [['change', 'complete', false], ['complete', 'turn-a']]);
  assert.equal(events.filter((event) => event[0] === 'complete').length, 1);
});

test('old completion snapshots and switching conversations never create a false celebration', () => {
  const completed = [];
  const controller = createActivityController({ onComplete: (id) => completed.push(id) });
  controller.setTask({ id: 'old-turn', status: 'complete' });
  controller.setTask({ id: 'turn-a', status: 'running' });
  controller.setTask({ id: 'turn-b', status: 'running' });
  controller.setTask({ id: 'turn-a', status: 'complete' });
  assert.deepEqual(completed, []);
  controller.setTask({ id: 'turn-b', status: 'running' });
  controller.setTask({ id: 'turn-b', status: 'complete' });
  assert.deepEqual(completed, ['turn-b']);
  controller.setTask(null);
  controller.setTask({ id: 'turn-b', status: 'complete' });
  assert.deepEqual(completed, ['turn-b']);
});

test('failed, cancelled and disabled completions stay terminal without retroactive stamps', () => {
  const completed = [];
  const controller = createActivityController({ onComplete: (id) => completed.push(id) });
  for (const ending of ['error', 'cancelled']) {
    controller.setTask({ id: ending, status: 'running' });
    controller.setTask({ id: ending, status: ending });
    controller.setTask({ id: ending, status: 'complete' });
  }
  controller.setTask({ id: 'disabled', status: 'running' });
  controller.setPreferences({ completionStampEnabled: false });
  controller.setTask({ id: 'disabled', status: 'complete' });
  controller.setPreferences({ completionStampEnabled: true });
  controller.setTask({ id: 'disabled', status: 'complete' });
  assert.deepEqual(completed, []);
});

test('a newer task started by a state subscriber suppresses a stale completion callback', () => {
  const completed = [];
  let controller;
  controller = createActivityController({
    onChange: (state) => {
      if (state.status === 'complete') controller.setTask({ id: 'new-turn', status: 'running' });
    },
    onComplete: (id) => completed.push(id),
  });
  controller.setTask({ id: 'old-turn', status: 'running' });
  controller.setTask({ id: 'old-turn', status: 'complete' });
  assert.equal(controller.getState().taskId, 'new-turn');
  assert.deepEqual(completed, []);
});

test('bad input, callback errors and disposal cannot leak active wind state', () => {
  const completed = [];
  const states = [];
  const controller = createActivityController({
    onChange: (state) => { states.push(state); throw new Error('view removed'); },
    onComplete: (id) => { completed.push(id); throw new Error('view removed'); },
  });
  controller.setTask({ id: 'turn-a', status: 'running' });
  controller.setTask({ id: 'turn-a', status: 'complete' });
  assert.deepEqual(completed, ['turn-a']);
  controller.setTask({ id: 'turn-b', status: 'running' });
  controller.setTask({ id: 'turn-b', status: 'unrecognized-host-status' });
  assert.equal(controller.getState().status, 'idle');
  controller.setTask({ id: 'turn-c', status: 'running' });
  controller.dispose();
  controller.dispose();
  controller.setTask({ id: 'turn-c', status: 'complete' });
  controller.setPreferences({ windPaused: false });
  controller.setVisibility(true);
  assert.equal(controller.getState().disposed, true);
  assert.equal(controller.getState().windPlaying, false);
  assert.equal(states.at(-1).windPlaying, false);
  assert.deepEqual(completed, ['turn-a']);
});

test('long activity histories do not make revisiting an old completion look new', () => {
  let completed = 0;
  const controller = createActivityController({ onComplete: () => completed++ });
  for (let index = 0; index < 1000; index++) {
    controller.setTask({ id: `turn-${index}`, status: 'running' });
    controller.setTask({ id: `turn-${index}`, status: 'complete' });
  }
  assert.equal(completed, 1000);
  controller.setTask({ id: 'turn-0', status: 'complete' });
  assert.equal(completed, 1000);
});
