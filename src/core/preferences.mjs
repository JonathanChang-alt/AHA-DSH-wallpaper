const BUILTIN_IDS = Object.freeze(['gilded-stage', 'portrait', 'teatime', 'scarlet-trick']);
const PORTRAIT_IDS = Object.freeze(['theater', 'smile', 'cheek-wink', 'peace']);
const PREFERENCE_KEYS = Object.freeze([
  'selectedWallpaper',
  'favorites',
  'wallpaperOpacity',
  'readingMask',
  'decorationsEnabled',
  'portraitEnabled',
  'selectedPortrait',
  'portraitMotionEnabled',
  'portraitPaused',
  'interfaceMotionEnabled',
  'environmentMotionEnabled',
  'welcomeMotionEnabled',
  'dynamicWallpaperEnabled',
  'wallpaperPaused',
  'windEnabled',
  'windPaused',
  'completionStampEnabled',
]);

export const DEFAULT_PREFERENCES = Object.freeze({
  selectedWallpaper: 'gilded-stage',
  favorites: Object.freeze([]),
  wallpaperOpacity: 0.9,
  readingMask: 0.96,
  decorationsEnabled: true,
  portraitEnabled: true,
  selectedPortrait: 'theater',
  portraitMotionEnabled: true,
  portraitPaused: false,
  interfaceMotionEnabled: true,
  environmentMotionEnabled: true,
  welcomeMotionEnabled: true,
  dynamicWallpaperEnabled: true,
  wallpaperPaused: false,
  windEnabled: true,
  windPaused: false,
  completionStampEnabled: true,
});

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => isRecord(value) && Object.hasOwn(value, key) ? value[key] : undefined;

function allowedIds(builtinIds) {
  if (!Array.isArray(builtinIds)) return [...BUILTIN_IDS];
  const ids = [...new Set(builtinIds.filter((id) =>
    typeof id === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(id),
  ))];
  return ids.length ? ids : [...BUILTIN_IDS];
}

function numberInRange(value, fallback, minimum, maximum) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

function booleanOr(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function clone(preferences) {
  return { ...preferences, favorites: [...preferences.favorites] };
}

/** Accept only built-in IDs and the documented presentation preferences. */
export function normalizePreferences(value, builtinIds = BUILTIN_IDS) {
  const ids = allowedIds(builtinIds);
  const selected = own(value, 'selectedWallpaper');
  const favorites = own(value, 'favorites');
  return {
    selectedWallpaper: ids.includes(selected)
      ? selected
      : ids.includes(DEFAULT_PREFERENCES.selectedWallpaper)
        ? DEFAULT_PREFERENCES.selectedWallpaper
        : ids[0],
    favorites: Array.isArray(favorites)
      ? [...new Set(favorites.filter((id) => typeof id === 'string' && ids.includes(id)))]
      : [],
    wallpaperOpacity: numberInRange(own(value, 'wallpaperOpacity'), 0.9, 0.25, 1),
    readingMask: numberInRange(own(value, 'readingMask'), 0.96, 0.86, 1),
    decorationsEnabled: booleanOr(own(value, 'decorationsEnabled'), true),
    portraitEnabled: booleanOr(own(value, 'portraitEnabled'), true),
    selectedPortrait: PORTRAIT_IDS.includes(own(value, 'selectedPortrait')) ? value.selectedPortrait : 'theater',
    portraitMotionEnabled: booleanOr(own(value, 'portraitMotionEnabled'), true),
    portraitPaused: booleanOr(own(value, 'portraitPaused'), false),
    interfaceMotionEnabled: booleanOr(own(value, 'interfaceMotionEnabled'), true),
    environmentMotionEnabled: booleanOr(own(value, 'environmentMotionEnabled'), true),
    welcomeMotionEnabled: booleanOr(own(value, 'welcomeMotionEnabled'), true),
    dynamicWallpaperEnabled: booleanOr(own(value, 'dynamicWallpaperEnabled'), true),
    wallpaperPaused: booleanOr(own(value, 'wallpaperPaused'), false),
    windEnabled: booleanOr(own(value, 'windEnabled'), true),
    windPaused: booleanOr(own(value, 'windPaused'), false),
    completionStampEnabled: booleanOr(own(value, 'completionStampEnabled'), true),
  };
}

function equal(a, b) {
  return PREFERENCE_KEYS.every((key) => key === 'favorites'
    ? a.favorites.length === b.favorites.length && a.favorites.every((id, index) => id === b.favorites[index])
    : a[key] === b[key]);
}

function defaultStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function read(storage, key, builtinIds) {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return normalizePreferences(undefined, builtinIds);
    const parsed = JSON.parse(raw);
    // A pre-versioned preferences object is the only supported legacy format.
    if (isRecord(parsed) && Object.hasOwn(parsed, 'version')) {
      return normalizePreferences(parsed.version === 1 ? parsed.preferences : undefined, builtinIds);
    }
    return normalizePreferences(parsed, builtinIds);
  } catch {
    return normalizePreferences(undefined, builtinIds);
  }
}

/**
 * Small synchronous preference store. Storage failure leaves an in-memory store
 * working. Initialization never overwrites malformed or newer saved data.
 * subscribe() observes later changes; call get() for the initial render.
 */
export function createPreferencesStore({
  storage = defaultStorage(),
  key = 'aha-dsh-wallpaper.preferences.v1',
  builtinIds = BUILTIN_IDS,
} = {}) {
  const ids = allowedIds(builtinIds);
  const subscriptions = new Set();
  const pendingSnapshots = [];
  let current = read(storage, key, ids);
  let disposed = false;
  let publishing = false;

  const get = () => clone(current);

  function commit(next) {
    if (disposed || equal(current, next)) return get();
    current = next;
    try {
      storage?.setItem(key, JSON.stringify({ version: 1, preferences: get() }));
    } catch {
      // Quota, blocked origins and disabled storage must not break the host UI.
    }
    pendingSnapshots.push(get());
    if (!publishing) {
      publishing = true;
      try {
        while (pendingSnapshots.length && !disposed) {
          const snapshot = pendingSnapshots.shift();
          for (const subscription of [...subscriptions]) {
            if (disposed) break;
            if (!subscriptions.has(subscription)) continue;
            try {
              subscription.listener(clone(snapshot));
            } catch {
              // One renderer must not prevent other subscribers receiving the update.
            }
          }
        }
      } finally {
        publishing = false;
      }
    }
    return get();
  }

  return {
    get,
    update(patch) {
      if (disposed || !isRecord(patch)) return get();
      const merged = get();
      for (const field of PREFERENCE_KEYS) {
        if (Object.hasOwn(patch, field)) merged[field] = patch[field];
      }
      return commit(normalizePreferences(merged, ids));
    },
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('Preference listener must be a function');
      if (disposed) return () => {};
      const subscription = { listener };
      subscriptions.add(subscription);
      return () => { subscriptions.delete(subscription); };
    },
    reset() {
      return commit(normalizePreferences(undefined, ids));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      subscriptions.clear();
      pendingSnapshots.length = 0;
    },
  };
}
