import { createVideoPlayback } from './video-playback.mjs';

/** Static compositor plus optional bundled motion; gallery identity stays fixed. */
export function createWallpaperSurface(container, { onChange = () => {} } = {}) {
  let disposed = false, current, player, video, videoSource;
  let motionEnabled = true, paused = false, playbackAllowed = false;
  let videoState = { ready: false, failed: false, blocked: false, playing: false };
  let published = '';
  const media = document.createElement('div'); media.className = 'aha-wallpaper-media';
  const bleed = document.createElement('div'); bleed.className = 'aha-wallpaper-bleed'; bleed.hidden = true;
  const art = document.createElement('div'); art.className = 'aha-wallpaper-art';
  const image = document.createElement('img'); image.className = 'aha-wallpaper-image'; image.alt = ''; image.draggable = false;
  const original = document.createElement('img'); original.className = 'aha-wallpaper-original'; original.alt = ''; original.draggable = false; original.hidden = true;
  art.append(image, original); media.append(bleed, art); container.append(media);
  const sourceFor = wallpaper => wallpaper?.motion?.src ?? (wallpaper?.kind === 'video' ? wallpaper.src : undefined);
  const getState = () => ({ hasMotion: Boolean(sourceFor(current)), enabled: motionEnabled, paused, ...videoState });
  function publish() {
    if (disposed) return;
    const next = getState(), key = JSON.stringify(next);
    if (key === published) return;
    published = key; onChange(next);
  }
  function paint() {
    const showVideo = Boolean(video && videoState.ready && !videoState.failed && !videoState.blocked);
    if (video) video.hidden = !showVideo;
    image.hidden = showVideo || !image.getAttribute('src');
    original.hidden = showVideo || !current?.originalSrc;
    container.dataset.ahaWallpaperMotion = showVideo ? 'active' : 'static';
    fitArtwork(); publish();
  }
  function fitArtwork() {
    if (disposed || container.dataset.layout !== 'stage') return;
    const ratio = video && videoState.ready && !videoState.failed && !videoState.blocked && video.videoWidth && video.videoHeight
      ? video.videoWidth / video.videoHeight
      : original.naturalWidth && original.naturalHeight ? original.naturalWidth / original.naturalHeight : 2030 / 1570;
    const width = Math.min(Math.max(0, container.clientWidth - 20), Math.max(0, container.clientHeight - 20) * ratio);
    art.style.width = `${width}px`; art.style.height = `${width / ratio}px`;
  }
  function releaseVideo() {
    player?.dispose(); player = undefined;
    video?.remove(); video = undefined; videoSource = undefined;
    videoState = { ready: false, failed: false, blocked: false, playing: false };
  }
  function syncVideo() {
    const source = motionEnabled ? sourceFor(current) : undefined;
    if (!source || source !== videoSource) releaseVideo();
    if (source && !player) {
      videoSource = source;
      video = document.createElement('video'); video.className = 'aha-wallpaper-video'; video.hidden = true;
      video.setAttribute('aria-hidden', 'true');
      if (current.motion?.poster ?? current.poster) video.poster = current.motion?.poster ?? current.poster;
      video.style.objectPosition = current.position ?? 'center';
      art.append(video);
      const ownedVideo = video;
      player = createVideoPlayback(video, { src: source, loop: true, onChange(state) {
        if (disposed || ownedVideo !== video) return;
        videoState = state; paint();
      } });
    }
    player?.setAllowed(playbackAllowed && !paused);
    paint();
  }
  const onError = () => { image.hidden = true; };
  const onLoad = () => { paint(); };
  image.addEventListener('error', onError); image.addEventListener('load', onLoad);
  original.addEventListener('load', fitArtwork);
  const observer = new ResizeObserver(fitArtwork); observer.observe(container);
  return {
    getState,
    update({ wallpaper, opacity, motionEnabled: enabled = true, paused: nextPaused = false }) {
      if (disposed || !wallpaper) return;
      if (current !== wallpaper) {
        releaseVideo(); current = wallpaper;
        const source = wallpaper.kind === 'video' ? wallpaper.poster : wallpaper.src;
        if (source) image.src = source; else image.removeAttribute('src');
        image.dataset.wallpaper = wallpaper.id;
        if (wallpaper.originalSrc) original.src = wallpaper.originalSrc; else original.removeAttribute('src');
        const backdrop = wallpaper.backdropSrc ?? wallpaper.motion?.poster ?? source;
        // A new video must not introduce a blurred copy under the manga's white
        // letterbox or a second figure behind a full scene. Only stage layouts
        // and explicit backdrop/original composites need this background layer.
        bleed.hidden = !wallpaper.backdropSrc && !wallpaper.originalSrc
          && !(wallpaper.layout === 'stage' && sourceFor(wallpaper));
        if (backdrop) bleed.style.backgroundImage = `url("${backdrop}")`; else bleed.style.removeProperty('background-image');
      }
      motionEnabled = enabled; paused = nextPaused;
      container.dataset.layout = wallpaper.layout;
      // Mirror the entire artwork stack, including video, poster and fallback;
      // frames, reading surfaces and controls belong to separate UI layers.
      container.dataset.mirrored = String(wallpaper.mirrored === true);
      if (wallpaper.layout !== 'stage') { art.style.removeProperty('width'); art.style.removeProperty('height'); }
      container.style.setProperty('--aha-art-opacity', opacity);
      image.style.objectPosition = wallpaper.position ?? 'right center';
      original.style.objectPosition = wallpaper.position ?? 'right center';
      syncVideo();
    },
    setPlaybackAllowed(value) { playbackAllowed = Boolean(value); player?.setAllowed(playbackAllowed && !paused); },
    retryPlayback() { player?.retry(); },
    dispose() {
      if (disposed) return;
      disposed = true; releaseVideo(); observer.disconnect();
      image.removeEventListener('error', onError); image.removeEventListener('load', onLoad); original.removeEventListener('load', fitArtwork);
      image.removeAttribute('src'); original.removeAttribute('src'); bleed.style.removeProperty('background-image');
      media.remove(); delete container.dataset.ahaWallpaperMotion;
    },
  };
}
