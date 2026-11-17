/**
 * Read-only adapter for the DSH 0.2.1 Session services.
 * It borrows the current main-view binding without retaining or activating a session.
 */
export function observeHostActivity(ctx, { onTask }) {
  if (typeof onTask !== 'function') throw new TypeError('onTask must be a function');
  let disposed = false;
  let currentSessionId = null;
  let currentBinding;
  let currentTurn = null;
  let terminal = null;
  let lastEmission;
  let bindingDisposers = [];
  const rootDisposers = [];
  const seenEnds = new Set();

  const emit = (status) => {
    if (disposed) return;
    const task = {
      id: currentSessionId === null ? null : `${currentSessionId}:${currentTurn ?? 'pending'}`,
      status,
      sessionId: currentSessionId,
    };
    const signature = JSON.stringify(task);
    if (signature === lastEmission) return;
    lastEmission = signature;
    onTask(task);
  };
  const taskStatus = () => ctx.uiSession?.sessionStatus?.getSnapshot?.()?.get(currentSessionId);
  const sessionSnapshot = () => currentBinding?.session?.getSnapshot?.();
  const syncStatus = () => {
    if (disposed) return;
    if (currentSessionId === null) return emit('idle');
    const status = taskStatus();
    const session = sessionSnapshot();
    if (status?.pendingInteraction) return emit('waiting');
    if (terminal) return emit(terminal);
    if (session?.openState === 'error' || session?.removed) return emit('error');
    if (status?.running === true || session?.running === true) return emit('running');
    return emit('idle');
  };
  const adoptBaseline = () => {
    const entries = currentBinding?.session?.eventSource?.getSnapshot?.()?.entries ?? [];
    const lastStart = entries.findLast((entry) => entry.event?.type === 'turn/start');
    currentTurn = lastStart?.event?.data?.turn ?? null;
    terminal = null;
    for (const entry of entries) {
      if (entry.event?.type === 'turn/end') rememberEnd(entry.event);
    }
  };
  const rememberEnd = (event) => {
    const key = `${currentSessionId}:${event.seq}`;
    const alreadySeen = seenEnds.has(key);
    seenEnds.add(key);
    if (seenEnds.size > 512) seenEnds.delete(seenEnds.values().next().value);
    return alreadySeen;
  };
  const onEvents = () => {
    if (disposed) return;
    const source = currentBinding?.session?.eventSource;
    const snapshot = source?.getSnapshot?.();
    const change = snapshot?.change;
    if (change?.kind !== 'append') {
      // Initial/reconnect baselines and older pages are not new task completions.
      if (change?.kind === 'replace') {
        // Break completion eligibility across a reconnect/history replacement.
        onTask({ id: null, status: 'idle', sessionId: currentSessionId });
        lastEmission = undefined;
        adoptBaseline();
      }
      syncStatus();
      return;
    }
    for (const entry of change.entries ?? []) {
      const event = entry.event;
      if (!event) continue;
      if (event.type === 'turn/start') {
        currentTurn = event.data?.turn ?? null;
        terminal = null;
        // A genuinely new start and end may arrive in one append batch.
        emit(taskStatus()?.pendingInteraction ? 'waiting' : 'running');
      }
      if (event.type !== 'turn/end') continue;
      if (rememberEnd(event)) continue;
      currentTurn = event.data?.turn ?? currentTurn;
      const reason = event.data?.reason?.kind;
      terminal = reason === 'completed' ? 'complete'
        : reason === 'aborted' || reason === 'interrupted' ? 'cancelled'
          : 'error';
    }
    syncStatus();
  };
  const clearBinding = () => {
    for (const dispose of bindingDisposers.splice(0)) dispose();
    currentBinding = undefined;
    terminal = null;
    currentTurn = null;
  };
  const reconcile = () => {
    if (disposed) return;
    const list = ctx.sessions?.list?.getSnapshot?.();
    const nextId = Object.values(list?.byId ?? {}).find((row) => (row.retainedBy?.mainView ?? 0) > 0)?.id ?? null;
    const nextBinding = nextId === null ? undefined : ctx.sessions?.binding?.(nextId);
    if (nextId !== currentSessionId || nextBinding !== currentBinding) {
      clearBinding();
      currentSessionId = nextId;
      currentBinding = nextBinding;
      adoptBaseline();
      const session = currentBinding?.session;
      if (session?.subscribe) bindingDisposers.push(session.subscribe(syncStatus));
      if (session?.eventSource?.subscribe) bindingDisposers.push(session.eventSource.subscribe(onEvents));
    }
    syncStatus();
  };

  try {
    if (ctx.sessions?.list?.subscribe) rootDisposers.push(ctx.sessions.list.subscribe(reconcile));
    if (ctx.uiSession?.sessionStatus?.subscribe) rootDisposers.push(ctx.uiSession.sessionStatus.subscribe(reconcile));
    reconcile();
  } catch (error) {
    disposed = true;
    clearBinding();
    for (const dispose of rootDisposers.splice(0)) dispose();
    throw error;
  }
  return () => {
    if (disposed) return;
    disposed = true;
    clearBinding();
    for (const dispose of rootDisposers.splice(0)) dispose();
  };
}
