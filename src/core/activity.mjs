const STATUSES = new Set(['idle', 'running', 'waiting', 'complete', 'error', 'cancelled']);
const HISTORY_LIMIT = 256;

function normalizedTask(value) {
  if (!value || typeof value !== 'object'
    || typeof value.id !== 'string' || !value.id.trim() || value.id.length > 1024
    || !STATUSES.has(value.status)) {
    return { id: null, status: 'idle' };
  }
  return { id: value.id, status: value.status };
}

function invoke(callback, value) {
  try {
    if (typeof callback === 'function') callback(value);
  } catch {
    // Presentation callbacks may fail without breaking the host activity stream.
  }
}

/**
 * Normalize host activity outside this module. A task ID must identify a run or
 * turn, not just a conversation. Keep the ID until its final reason arrives.
 * The initial state is available from getState(); callbacks observe changes.
 */
export function createActivityController({ onChange, onComplete } = {}) {
  let current = { id: null, status: 'idle' };
  let preferences = { windEnabled: true, windPaused: false, completionStampEnabled: true };
  let visible = true;
  let reducedMotion = false;
  let disposed = false;
  let eligibleRun = false;
  let taskRevision = 0;
  const history = new Map();

  const getState = () => ({
    taskId: current.id,
    status: current.status,
    busy: !disposed && current.status === 'running',
    windPlaying: !disposed && current.status === 'running'
      && preferences.windEnabled && !preferences.windPaused && visible && !reducedMotion,
    windEnabled: preferences.windEnabled,
    windPaused: preferences.windPaused,
    completionStampEnabled: preferences.completionStampEnabled,
    visible,
    reducedMotion,
    disposed,
  });

  let published = getState();
  function publish() {
    const next = getState();
    if (Object.keys(next).every((key) => next[key] === published[key])) return;
    published = next;
    invoke(onChange, { ...next });
  }

  function recordFor(id) {
    const record = history.get(id) ?? { finished: false, blocked: false };
    history.delete(id);
    history.set(id, record);
    if (history.size > HISTORY_LIMIT) history.delete(history.keys().next().value);
    return record;
  }

  return {
    getState,
    setTask(task) {
      if (disposed) return;
      const next = normalizedTask(task);
      const revision = ++taskRevision;
      if (next.id !== current.id) eligibleRun = false;
      const record = next.id === null ? null : recordFor(next.id);
      if (next.status === 'running' && !record?.finished && !record?.blocked) eligibleRun = true;

      const celebrate = next.status === 'complete'
        && current.id === next.id && eligibleRun && record !== null
        && !record.finished && !record.blocked && preferences.completionStampEnabled;

      if (next.status === 'complete' && record) {
        record.finished = true;
        eligibleRun = false;
      } else if ((next.status === 'error' || next.status === 'cancelled') && record) {
        record.finished = true;
        record.blocked = true;
        eligibleRun = false;
      } else if (next.id === null) {
        eligibleRun = false;
      }

      current = next;
      publish();
      if (celebrate && !disposed && taskRevision === revision && preferences.completionStampEnabled) {
        invoke(onComplete, next.id);
      }
    },
    setPreferences(patch) {
      if (disposed || !patch || typeof patch !== 'object') return;
      const next = { ...preferences };
      for (const key of Object.keys(next)) {
        if (Object.hasOwn(patch, key) && typeof patch[key] === 'boolean') next[key] = patch[key];
      }
      preferences = next;
      publish();
    },
    setVisibility(value) {
      if (disposed || typeof value !== 'boolean') return;
      visible = value;
      publish();
    },
    setReducedMotion(value) {
      if (disposed || typeof value !== 'boolean') return;
      reducedMotion = value;
      publish();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      taskRevision++;
      eligibleRun = false;
      current = { id: null, status: 'idle' };
      visible = false;
      history.clear();
      publish();
    },
  };
}
