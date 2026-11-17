const BODY_ATTRIBUTES = ['data-aha-motion', 'data-aha-task', 'data-aha-launch'];
const TOOL_KINDS = new Set(['read', 'readImage', 'search', 'edit', 'write', 'commands', 'code', 'webSearch', 'webFetch', 'subagents', 'plan', 'tools']);
const LABELS = { idle: '准备就绪', thinking: '思考中', tools: '工具执行中', replying: '回复中', waiting: '等待确认', complete: '本轮完成', cancelled: '已停止', error: '任务未完成' };

/** Presentation only: borrow host DOM anchors and never submit or alter a task. */
export function createStagePresentation({ store, activity, events }) {
  let state = activity.getState();
  let preferences = store.get();
  let center, liveGroup, liveGroupPrevious, frame, launchTimer;
  let disposed = false;
  const subscribers = new Set();
  const liveRows = new Map();
  const previous = BODY_ATTRIBUTES.map(name => [name, document.body.getAttribute(name)]);
  let snapshot = Object.freeze({ phase: 'idle', label: LABELS.idle });

  function releaseGroup() {
    if (!liveGroup) return;
    if (liveGroupPrevious === null) liveGroup.removeAttribute('data-aha-process-live');
    else liveGroup.setAttribute('data-aha-process-live', liveGroupPrevious);
    liveGroup = undefined;
  }
  function refresh() {
    if (disposed) return;
    // A live shimmer identifies an open native group; completed groups in this
    // turn and all history must stay static. Turn matching prevents stale cards
    // animating while a newly submitted turn has not rendered yet.
    const turn = /:(\d+)$/.exec(state.taskId ?? '')?.[1];
    const candidates = turn && (state.status === 'running' || state.status === 'waiting')
      ? [...(center?.querySelectorAll('[data-step-process][data-chat-turn]') ?? [])]
        .filter(node => node.dataset.chatTurn === turn && node.querySelector('[data-process-activity] [data-shimmer]')) : [];
    const nextGroup = candidates.at(-1);
    const currentRows = new Set(turn && ['running', 'waiting'].includes(state.status)
      ? [...(center?.querySelectorAll('[data-chat-turn]') ?? [])].filter(node => node.dataset.chatTurn === turn) : []);
    for (const [node, value] of liveRows) {
      if (currentRows.has(node)) continue;
      if (value === null) node.removeAttribute('data-aha-turn-live');
      else node.setAttribute('data-aha-turn-live', value);
      liveRows.delete(node);
    }
    for (const node of currentRows) {
      if (!liveRows.has(node)) liveRows.set(node, node.getAttribute('data-aha-turn-live'));
      node.setAttribute('data-aha-turn-live', state.status);
    }
    if (nextGroup !== liveGroup) {
      releaseGroup();
      liveGroup = nextGroup;
      liveGroupPrevious = liveGroup?.getAttribute('data-aha-process-live') ?? null;
    }
    if (liveGroup) liveGroup.setAttribute('data-aha-process-live', state.status);
    const inlineThinking = [...currentRows].some(node => node.querySelector('[data-variant="think"][data-state="running"]'));
    const inlineTool = [...currentRows].some(node => node.matches('[data-chat-flow-kind="tool-call"]') && node.querySelector('[data-state="running"]'));
    const kind = liveGroup?.querySelector('[data-process-activity]')?.dataset.processActivity ?? (inlineThinking ? 'thinking' : inlineTool ? 'tools' : undefined);
    const phase = state.status === 'running'
      ? kind === 'thinking' ? 'thinking' : TOOL_KINDS.has(kind) ? 'tools' : kind === 'questions' ? 'waiting' : 'replying'
      : state.status;
    document.body.dataset.ahaTask = phase;
    const motionAllowed = preferences.interfaceMotionEnabled && state.visible && !state.reducedMotion;
    document.body.dataset.ahaMotion = motionAllowed ? 'on' : 'off';
    if (!motionAllowed) { clearTimeout(launchTimer); document.body.removeAttribute('data-aha-launch'); }
    if (snapshot.phase !== phase) {
      snapshot = Object.freeze({ phase, label: LABELS[phase] ?? LABELS.idle });
      for (const subscriber of [...subscribers]) subscriber();
    }
  }
  function schedule() {
    if (!disposed && frame === undefined) frame = requestAnimationFrame(() => { frame = undefined; refresh(); });
  }
  const structure = '[data-step-process], [data-conversation-content], [data-composer-card], [data-chat-flow-key][data-chat-turn], [data-variant="think"]';
  const observer = new MutationObserver(records => {
    if (records.some(record => record.type === 'attributes' || [...record.addedNodes, ...record.removedNodes]
      .some(node => node.nodeType === 1 && (node.matches(structure) || node.querySelector(structure))))) schedule();
  });
  const offActivity = events.on('activity', next => {
    const starts = next.status === 'running' && next.taskId !== null
      && (next.taskId !== state.taskId || !['running', 'waiting'].includes(state.status));
    state = next;
    if (starts && preferences.interfaceMotionEnabled && state.visible && !state.reducedMotion) {
      clearTimeout(launchTimer);
      document.body.dataset.ahaLaunch = 'true';
      launchTimer = setTimeout(() => { document.body.removeAttribute('data-aha-launch'); }, 850);
    }
    refresh();
  });
  const offPreferences = store.subscribe(next => { preferences = next; refresh(); });
  refresh();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) { subscribers.add(listener); return () => subscribers.delete(listener); },
    attach(node) {
      if (disposed || node === center) return;
      observer.disconnect();
      releaseGroup();
      center = node;
      if (center) observer.observe(center, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-process-activity', 'data-shimmer', 'data-chat-turn', 'data-state'] });
      refresh();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      offActivity(); offPreferences(); observer.disconnect();
      if (frame !== undefined) cancelAnimationFrame(frame);
      clearTimeout(launchTimer);
      releaseGroup(); subscribers.clear();
      for (const [node, value] of liveRows) {
        if (value === null) node.removeAttribute('data-aha-turn-live');
        else node.setAttribute('data-aha-turn-live', value);
      }
      liveRows.clear();
      for (const [name, value] of previous) {
        if (value === null) document.body.removeAttribute(name);
        else document.body.setAttribute(name, value);
      }
    },
  };
}
