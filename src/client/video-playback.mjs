/** Own one muted video for its entire lifetime. Never reuse it across sources. */
export function createVideoPlayback(video, { src, loop = false, intervalMs = 6000, onChange = () => {} } = {}) {
  let disposed = false, allowed = false, ready = false, failed = false, blocked = false, playing = false;
  let revision = 0, pending = false, timer, gapStarted = 0, gapRemaining = null;
  let published = '';
  const removers = [];
  const state = () => ({ ready, failed, blocked, playing, waiting: gapRemaining !== null });
  const publish = () => {
    if (disposed) return;
    const next = state(), key = JSON.stringify(next);
    if (key === published) return;
    published = key;
    onChange(next);
  };
  const listen = (event, fn) => { video.addEventListener(event, fn); removers.push(() => video.removeEventListener(event, fn)); };
  function stopGap() {
    if (timer === undefined) return;
    clearTimeout(timer); timer = undefined;
    gapRemaining = Math.max(0, gapRemaining - (Date.now() - gapStarted));
  }
  function pause() { video.pause(); playing = false; }
  function play() {
    if (disposed || !allowed || failed || blocked || pending || gapRemaining !== null) return;
    const attempt = revision;
    pending = true;
    let result;
    try { result = video.play(); } catch (error) { result = Promise.reject(error); }
    Promise.resolve(result).then(() => {
      if (disposed || !allowed || failed) { video.pause(); return; }
      if (attempt !== revision) return;
      playing = !video.paused;
      publish();
    }, error => {
      if (disposed || attempt !== revision || error?.name === 'AbortError') return;
      blocked = true; playing = false;
      publish();
    }).finally(() => {
      pending = false;
      // A pause/resume may have happened while the older play request settled.
      if (!disposed && attempt !== revision && allowed) reconcile();
    });
  }
  function reconcile() {
    if (disposed) return;
    if (!allowed || failed) { stopGap(); pause(); publish(); return; }
    if (gapRemaining !== null) {
      if (timer === undefined) {
        gapStarted = Date.now();
        timer = setTimeout(() => {
          timer = undefined; gapRemaining = null;
          if (disposed || !allowed) return;
          video.currentTime = 0;
          publish(); play();
        }, gapRemaining);
      }
      publish(); return;
    }
    play();
  }
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.loop = loop;
  video.preload = 'auto';
  listen('loadeddata', () => { ready = true; publish(); reconcile(); });
  listen('playing', () => {
    if (disposed || !allowed) { pause(); return; }
    ready = true; playing = true; blocked = false; publish();
  });
  listen('pause', () => { playing = false; publish(); });
  listen('ended', () => {
    if (disposed || loop || failed) return;
    playing = false;
    gapRemaining = intervalMs;
    reconcile();
  });
  listen('error', () => { failed = true; blocked = false; ++revision; stopGap(); pause(); publish(); });
  video.src = src;
  publish();
  return {
    getState: state,
    setAllowed(value) {
      value = Boolean(value);
      if (disposed || value === allowed) return;
      allowed = value; ++revision;
      reconcile();
    },
    retry() { if (disposed || failed) return; blocked = false; ++revision; reconcile(); },
    dispose() {
      if (disposed) return;
      disposed = true; allowed = false; ++revision;
      stopGap();
      for (const remove of removers) remove();
      pause(); video.removeAttribute('src'); video.load();
    },
  };
}
