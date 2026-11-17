import { createVideoPlayback } from './video-playback.mjs';

/** Add optional animation without owning the welcome choice or its poster. */
export function mountWelcomeSurface(container, { motion, store, activity, events, intervalMs = 6000 }) {
  let disposed = false, player, video, sessionId = null;
  let preferences = store.get(), activityState = activity.getState();
  const poster = container.querySelector('img');
  const previousVisibility = poster.style.visibility;
  function release() {
    player?.dispose(); player = undefined;
    video?.remove(); video = undefined;
    poster.style.visibility = previousVisibility;
    delete container.dataset.ahaWelcomeMotion;
  }
  function sync() {
    if (disposed) return;
    if (!motion?.src || !preferences.welcomeMotionEnabled) { release(); return; }
    if (!player) {
      video = document.createElement('video');
      video.className = 'aha-welcome-video';
      video.setAttribute('aria-hidden', 'true');
      video.hidden = true;
      if (motion.poster) video.poster = motion.poster;
      container.append(video);
      const currentVideo = video;
      player = createVideoPlayback(video, { src: motion.src, intervalMs, onChange(state) {
        if (disposed || currentVideo !== video) return;
        const show = state.ready && !state.failed && !state.blocked;
        currentVideo.hidden = !show;
        poster.style.visibility = show ? 'hidden' : previousVisibility;
        container.dataset.ahaWelcomeMotion = state.failed || state.blocked ? 'fallback' : show ? 'active' : 'loading';
      } });
    }
    player.setAllowed(activityState.visible && !activityState.reducedMotion);
  }
  const offPreferences = store.subscribe(next => { preferences = next; sync(); });
  const offActivity = events.on('activity', next => { activityState = next; sync(); });
  sync();
  return {
    activateSession(next) {
      if (disposed || !next || next === sessionId) return;
      // Initial native binding claims the already displayed welcome.
      const restart = sessionId !== null;
      sessionId = next;
      if (restart) { release(); sync(); }
    },
    getState: () => player?.getState() ?? null,
    dispose() { if (disposed) return; disposed = true; offPreferences(); offActivity(); release(); },
  };
}
