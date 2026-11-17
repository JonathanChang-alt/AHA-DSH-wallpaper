import { createVideoPlayback } from './video-playback.mjs';

/** Own one selected, silent portrait; welcome and wind artwork stay distinct. */
export function createPortraitSurface(portraits) {
  let selected, controller, video, allowed = false, paused = false, disposed = false;
  const button = document.createElement('button');
  button.className = 'aha-portrait';
  button.type = 'button';
  button.hidden = true;
  button.setAttribute('aria-label', '阿哈肖像：打开主题设置');
  button.setAttribute('aria-haspopup', 'dialog');
  button.title = '阿哈肖像 · 主题设置';
  const piece = document.createElement('span');
  piece.className = 'aha-portrait-piece';
  const window = document.createElement('span');
  window.className = 'aha-portrait-window';
  const image = document.createElement('img');
  image.className = 'aha-portrait-image';
  image.alt = '';
  image.draggable = false;
  window.append(image);
  piece.append(window);
  for (const [className, text] of [['aha-portrait-curtain', ''], ['aha-portrait-star', '✦']]) {
    const decoration = document.createElement('span');
    decoration.className = className;
    decoration.textContent = text;
    decoration.setAttribute('aria-hidden', 'true');
    piece.append(decoration);
  }
  button.append(piece);
  function paint() {
    const state = controller?.getState();
    const showVideo = state?.ready && !state.failed && !state.blocked;
    image.hidden = Boolean(showVideo);
    if (video) video.hidden = !showVideo;
  }
  function release() {
    controller?.dispose(); controller = undefined;
    video?.remove(); video = undefined;
    image.hidden = false;
  }
  button.update = ({ selectedId, motionEnabled, paused: nextPaused }) => {
    if (disposed) return;
    const next = portraits.find(item => item.id === selectedId) ?? portraits[0];
    paused = Boolean(nextPaused);
    if (next !== selected) {
      release(); selected = next;
      image.src = selected.src;
      button.dataset.portrait = selected.id;
      button.title = `${selected.title} · 主题设置`;
    }
    if (!motionEnabled || !selected.motion?.src) release();
    else if (!controller) {
      video = document.createElement('video');
      video.className = 'aha-portrait-video';
      video.dataset.portrait = selected.id;
      video.setAttribute('aria-hidden', 'true');
      video.hidden = true;
      if (selected.motion.poster) video.poster = selected.motion.poster;
      window.append(video);
      controller = createVideoPlayback(video, { src: selected.motion.src, loop: true, onChange: paint });
    }
    controller?.setAllowed(allowed && !paused);
    paint();
  };
  button.setPlaybackAllowed = value => {
    allowed = Boolean(value);
    controller?.setAllowed(allowed && !paused);
  };
  button.dispose = () => { if (!disposed) { disposed = true; release(); image.removeAttribute('src'); } };
  return button;
}
