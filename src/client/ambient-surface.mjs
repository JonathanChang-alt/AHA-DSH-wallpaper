const SVG_NS = 'http://www.w3.org/2000/svg';

function pendant(kind) {
  const node = document.createElement('span');
  node.className = `aha-ambient-pendant aha-ambient-pendant-${kind}`;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 28 100');
  svg.setAttribute('focusable', 'false');
  const chain = document.createElementNS(SVG_NS, 'path');
  chain.setAttribute('d', 'M14 0 V68');
  chain.setAttribute('class', 'aha-ambient-chain');
  const star = document.createElementNS(SVG_NS, 'path');
  star.setAttribute('class', 'aha-ambient-star');
  star.setAttribute('d', kind === 'left'
    ? 'M14 65 L17 77 L26 81 L17 85 L14 98 L11 85 L2 81 L11 77 Z'
    : 'M14 66 L18 76 L28 77 L20 84 L23 95 L14 89 L5 95 L8 84 L0 77 L10 76 Z');
  svg.append(chain, star); node.append(svg);
  return node;
}

/** Small code-drawn stage ornaments. CSS owns motion; no timers or frame loop. */
export function createAmbientSurface() {
  const element = document.createElement('div');
  element.className = 'aha-ambient';
  element.setAttribute('aria-hidden', 'true');
  element.inert = true;
  element.hidden = true;
  element.dataset.playing = 'false';
  element.append(pendant('left'), pendant('right'));
  for (const name of ['left', 'right']) {
    const light = document.createElement('span');
    light.className = `aha-ambient-light aha-ambient-light-${name}`;
    element.append(light);
  }
  const glint = document.createElement('span');
  glint.className = 'aha-ambient-glint'; element.append(glint);
  let disposed = false;
  return {
    element,
    update({ preferences, activity, available }) {
      if (disposed) return;
      const show = Boolean(available && preferences.decorationsEnabled && preferences.environmentMotionEnabled);
      element.hidden = !show;
      element.dataset.playing = String(show && activity.visible && !activity.reducedMotion && !preferences.wallpaperPaused);
    },
    dispose() { if (disposed) return; disposed = true; element.dataset.playing = 'false'; element.remove(); },
  };
}
