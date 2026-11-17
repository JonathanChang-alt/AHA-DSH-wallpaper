export const WELCOME_VARIANT_IDS = Object.freeze(['wink', 'heart', 'shy']);
const LIMIT = 256;
const KEY = 'aha-dsh-wallpaper.welcomes.v1';
const validId = id => typeof id === 'string' && id.trim().length > 0 && id.length <= 1024;

function defaultStorage() {
  try { return globalThis.localStorage; } catch { return undefined; }
}

/** Choose independently for each new session; renders and preferences never draw. */
export function createWelcomeController({ storage = defaultStorage(), random = Math.random } = {}) {
  const choices = new Map();
  try {
    const saved = JSON.parse(storage?.getItem(KEY) ?? 'null');
    if (saved?.version === 1 && Array.isArray(saved.choices)) {
      for (const entry of saved.choices.slice(-LIMIT)) {
        if (Array.isArray(entry) && validId(entry[0]) && WELCOME_VARIANT_IDS.includes(entry[1])) choices.set(entry[0], entry[1]);
      }
    }
  } catch { /* An unavailable or malformed cache must not prevent a welcome. */ }
  const draw = () => {
    let sample;
    try { sample = random(); } catch { sample = 0; }
    if (typeof sample !== 'number' || !Number.isFinite(sample)) sample = 0;
    const index = Math.min(WELCOME_VARIANT_IDS.length - 1, Math.max(0, Math.floor(sample * WELCOME_VARIANT_IDS.length)));
    return WELCOME_VARIANT_IDS[index];
  };
  let snapshot = Object.freeze({ sessionId: null, variant: draw() });
  let disposed = false;
  const listeners = new Set();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      if (disposed) return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    activateSession(sessionId) {
      if (disposed || !validId(sessionId) || snapshot.sessionId === sessionId) return snapshot;
      let variant = choices.get(sessionId);
      if (!variant) {
        // Claim the already visible initial welcome when the first binding arrives.
        variant = snapshot.sessionId === null ? snapshot.variant : draw();
        choices.set(sessionId, variant);
        if (choices.size > LIMIT) choices.delete(choices.keys().next().value);
        try { storage?.setItem(KEY, JSON.stringify({ version: 1, choices: [...choices] })); } catch { /* In-memory choice still works. */ }
      }
      snapshot = Object.freeze({ sessionId, variant });
      for (const listener of [...listeners]) {
        try { listener(); } catch { /* Isolate presentation subscribers. */ }
      }
      return snapshot;
    },
    dispose() { disposed = true; listeners.clear(); },
  };
}
