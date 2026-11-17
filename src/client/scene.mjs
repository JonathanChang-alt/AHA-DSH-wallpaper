import { createSettingsPanel } from './settings-panel.mjs';
import { createWallpaperSurface } from './wallpaper-surface.mjs';
import { createAmbientSurface } from './ambient-surface.mjs';
import { createPortraitSurface } from './portrait-surface.mjs';
import { ART_WALLPAPERS, WELCOME_MOTION, GOLD_CORNER_DATA, STAGE_FRAME_DATA, WIND_VIDEO_DATA, WIND_POSTER_DATA, WIND_ASPECT_RATIO, WIND_VISIBLE_BOUNDS, PORTRAITS } from './assets.generated.mjs';

function el(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Own only presentation nodes. Never retain, activate or mutate host sessions. */
export function mountScene(root, { store, activity, events, stage, wallpapers = ART_WALLPAPERS, portraits = PORTRAITS, welcomeMotionAvailable = Object.keys(WELCOME_MOTION).length > 0 }) {
  let disposed = false;
  let background, wallpaperSurface, center, frame;
  let panel, backdrop, returnFocus;
  let timer, layoutFrame;
  let canFloat = false;
  let offActivity, offComplete;
  let observedConversation, observedScroll;
  const sizeTargets = new Set();
  const ownedClasses = [];
  const removers = [];
  const listen = (target, name, handler, options) => {
    target.addEventListener(name, handler, options);
    removers.push(() => target.removeEventListener(name, handler, options));
  };
  root.classList.add('aha-scene');
  const ambient = createAmbientSurface();
  let ambientSpace = false;
  const curtain = el('div', 'aha-curtain');
  curtain.setAttribute('aria-hidden', 'true');
  const stageFrame = el('div', 'aha-stage-frame');
  stageFrame.setAttribute('aria-hidden', 'true');
  stageFrame.style.borderImageSource = `url("${STAGE_FRAME_DATA}")`;
  const mangaFrame = el('div', 'aha-manga-frame');
  mangaFrame.setAttribute('aria-hidden', 'true');
  for (const corner of ['tl', 'tr', 'br', 'bl']) {
    const mark = el('span', 'aha-manga-corner'); mark.dataset.corner = corner;
    mangaFrame.append(mark);
  }
  mangaFrame.append(el('span', 'aha-manga-card', 'A'));
  const lights = el('div', 'aha-festoon');
  lights.textContent = '✦　·　✧　·　✦　·　✧　·　✦　·　✧　·　✦';
  curtain.append(lights);
  for (const position of ['tl', 'tr', 'bl', 'br']) {
    const corner = el('img', `aha-corner aha-corner-${position}`);
    corner.src = GOLD_CORNER_DATA;
    corner.alt = '';
    corner.draggable = false;
    curtain.append(corner);
  }
  const wind = el('button', 'aha-wind');
  wind.type = 'button';
  wind.hidden = true;
  const video = el('video', 'aha-wind-video');
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'metadata';
  video.poster = WIND_POSTER_DATA;
  video.src = WIND_VIDEO_DATA;
  video.style.aspectRatio = String(WIND_ASPECT_RATIO);
  video.setAttribute('aria-hidden', 'true');
  wind.append(video);
  const stamp = el('div', 'aha-completion-stamp');
  stamp.hidden = true;
  stamp.setAttribute('role', 'status');
  stamp.setAttribute('aria-live', 'polite');
  stamp.append(el('small', '', '本 场 演 出'), el('strong', '', '圆满谢幕'), el('span', '', '✦ 好戏，下回见 ✦'));
  const wallpaperControl = el('button', 'aha-wallpaper-control');
  wallpaperControl.type = 'button'; wallpaperControl.hidden = true;
  const portrait = createPortraitSurface(portraits);
  root.append(curtain, wind, stamp, wallpaperControl, portrait);

  function syncWallpaperControl() {
    const state = wallpaperSurface?.getState();
    const paused = store.get().wallpaperPaused;
    const label = paused || state?.blocked ? '继续播放壁纸' : '暂停壁纸';
    wallpaperControl.textContent = paused || state?.blocked ? '▶' : 'Ⅱ';
    wallpaperControl.setAttribute('aria-label', label);
    wallpaperControl.setAttribute('aria-pressed', String(paused || state?.blocked || false));
    wallpaperControl.title = label;
    panel?.setWallpaperPlaybackState(state);
  }
  function syncWallpaperPlayback(state = activity.getState()) {
    wallpaperSurface?.setPlaybackAllowed(state.visible && !state.reducedMotion && Boolean(center?.querySelector('[data-conversation-content]')));
  }
  function syncPortraitPlayback(state = activity.getState()) {
    const preferences = store.get();
    portrait.setPlaybackAllowed(state.visible && !state.reducedMotion && !portrait.hidden
      && preferences.portraitEnabled && preferences.decorationsEnabled);
  }
  function syncAmbient() {
    const preferences = store.get();
    const wallpaper = wallpapers.find(item => item.id === preferences.selectedWallpaper) ?? wallpapers[0];
    ambient.update({ preferences, activity: activity.getState(), available: ambientSpace && wallpaper?.layout === 'stage' && Boolean(center?.querySelector('[data-conversation-content]')) });
  }

  function syncActivity(state = activity.getState()) {
    if (disposed) return;
    wind.dataset.enabled = String(state.windEnabled);
    wind.setAttribute('aria-pressed', String(state.windPaused));
    wind.setAttribute('aria-label', state.windPaused ? '恢复风车（仅任务期间转动）' : '暂停风车');
    wind.title = state.reducedMotion ? '系统已启用减少动态效果，风车保持静止' : '仅模型回复或执行任务时转动；点击暂停或恢复';
    updatePlayback(state);
    syncWallpaperPlayback(state);
    syncPortraitPlayback(state);
    syncAmbient();
    scheduleLayout();
  }
  function updatePlayback(state = activity.getState()) {
    if (state.windPlaying && !wind.hidden) {
      if (video.paused) video.play()?.catch(() => { /* Preserve the poster on a blocked play. */ });
    } else video.pause();
  }

  function syncPreferences() {
    if (disposed) return;
    const preferences = store.get();
    portrait.update({ selectedId: preferences.selectedPortrait, motionEnabled: preferences.portraitMotionEnabled, paused: preferences.portraitPaused });
    syncPortraitPlayback();
    root.dataset.decorations = String(preferences.decorationsEnabled);
    if (background) {
      const wallpaper = wallpapers.find((item) => item.id === preferences.selectedWallpaper) ?? wallpapers[0];
      wallpaperSurface.update({ wallpaper, opacity: preferences.wallpaperOpacity, motionEnabled: preferences.dynamicWallpaperEnabled, paused: preferences.wallpaperPaused });
      root.dataset.frame = wallpaper.frame ?? 'curtain';
      background.dataset.decorations = String(preferences.decorationsEnabled);
    }
    syncWallpaperPlayback();
    syncWallpaperControl();
    syncAmbient();
    if (!preferences.completionStampEnabled) {
      clearTimeout(timer);
      stamp.hidden = true;
    }
    scheduleLayout();
  }

  function layout() {
    layoutFrame = undefined;
    if (disposed || !center?.isConnected) return;
    const bounds = center.getBoundingClientRect();
    ambientSpace = bounds.width >= 850 && bounds.height >= 600;
    syncAmbient();
    const shell = root.getBoundingClientRect();
    curtain.style.left = `${bounds.left - shell.left}px`;
    curtain.style.top = `${bounds.top - shell.top}px`;
    curtain.style.width = `${bounds.width}px`;
    curtain.style.height = `${bounds.height}px`;
    const card = center.querySelector('[data-composer-card]');
    const reading = center.querySelector('[data-chat-flow]');
    // Keep the approved 200px portrait at a fixed logical size. If native
    // reading/composer space reaches this corner, give that space to the host.
    const portraitBox = { left: bounds.right - 300, right: bounds.right - 100, top: bounds.top + 124, bottom: bounds.top + 324 };
    const portraitObstacles = center.querySelectorAll('[data-composer-card], [data-chat-flow]:not([data-chat-flow] [data-chat-flow]), .aha-welcome-art, .aha-welcome-copy, [data-conversation-header-leading], [data-conversation-header-trailing], [data-conversation-tabs]');
    const portraitIntersects = [...portraitObstacles].some(node => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.right + 12 > portraitBox.left && rect.left - 12 < portraitBox.right
        && rect.bottom + 12 > portraitBox.top && rect.top - 12 < portraitBox.bottom;
    });
    const preferences = store.get();
    portrait.hidden = !preferences.portraitEnabled || !preferences.decorationsEnabled || !card
      || !center.querySelector('[data-conversation-content]') || bounds.width < 850 || bounds.height < 600 || portraitIntersects;
    portrait.style.left = `${portraitBox.left - shell.left}px`;
    portrait.style.top = `${portraitBox.top - shell.top}px`;
    syncPortraitPlayback();
    syncWallpaperPlayback();
    const playback = wallpaperSurface.getState();
    const controlBox = { left: bounds.right - 66, right: bounds.right - 34, top: bounds.top + 116, bottom: bounds.top + 148 };
    const controlIntersects = node => {
      if (!node) return false;
      const r = node.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.right > controlBox.left - 8 && r.left < controlBox.right + 8 && r.bottom > controlBox.top - 8 && r.top < controlBox.bottom + 8;
    };
    wallpaperControl.hidden = !playback.hasMotion || !playback.enabled || playback.failed || activity.getState().reducedMotion
      || !card || bounds.width < 850 || controlIntersects(card) || controlIntersects(reading)
      || [...center.querySelectorAll('[data-conversation-header-leading], [data-conversation-header-trailing]')].some(controlIntersects);
    wallpaperControl.style.left = `${controlBox.left - shell.left}px`;
    wallpaperControl.style.top = `${controlBox.top - shell.top}px`;
    const size = (bounds.width >= 1550 ? 186 : 154) * 2;
    const canvasLeft = bounds.right - 28 - size;
    const frameInset = root.dataset.frame === 'stage-gold' ? 26 : root.dataset.frame === 'manga' ? 12 : 10;
    const baseline = bounds.bottom - frameInset;
    const windHeight = size / WIND_ASPECT_RATIO;
    // Anchor the whole loop's visible lower edge, including transparent padding.
    // Keep one fixed position rather than moving the container frame by frame.
    const canvasTop = baseline - windHeight * WIND_VISIBLE_BOUNDS.bottom;
    // Give the button only the visible union's footprint. The complete video
    // still renders unchanged; transparent left padding cannot block a composer.
    const left = canvasLeft + size * WIND_VISIBLE_BOUNDS.left;
    const right = canvasLeft + size * WIND_VISIBLE_BOUNDS.right;
    const top = canvasTop + windHeight * WIND_VISIBLE_BOUNDS.top;
    const bottom = baseline;
    const intersects = (node) => {
      if (!node) return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.right + 18 > left && rect.left < right
        && rect.bottom + 12 > top && rect.top < bottom;
    };
    // A smaller window may have no safe wallpaper space. Controls remain in settings.
    canFloat = Boolean(card) && bounds.width >= 850 && top >= bounds.top + 110
      && !intersects(card) && !intersects(reading)
      && ![...center.querySelectorAll('.aha-welcome-art, .aha-welcome-copy, [data-conversation-header-leading], [data-conversation-header-trailing]'), portrait].some(intersects);
    wind.hidden = !activity.getState().windEnabled || !canFloat;
    wind.style.left = `${left - shell.left}px`;
    wind.style.top = `${top - shell.top}px`;
    wind.style.width = `${right - left}px`;
    wind.style.height = `${bottom - top}px`;
    video.style.left = `${-size * WIND_VISIBLE_BOUNDS.left}px`;
    video.style.top = `${-windHeight * WIND_VISIBLE_BOUNDS.top}px`;
    video.style.width = `${size}px`;
    video.style.height = `${windHeight}px`;
    stamp.style.right = `${Math.max(26, shell.right - bounds.right + 30)}px`;
    stamp.style.bottom = `${Math.max(120, shell.bottom - top + 18)}px`;
    updatePlayback();
  }
  function scheduleLayout() {
    if (!disposed && layoutFrame === undefined) layoutFrame = requestAnimationFrame(layout);
  }

  const observer = new ResizeObserver(scheduleLayout);
  function attach() {
    const overlay = root.closest('[data-shell-overlay]');
    const nextFrame = overlay?.parentElement;
    // This column is the native AppFrame's center, before its rightbar.
    const nextCenter = nextFrame?.querySelector('[data-rightbar-col]')?.previousElementSibling;
    if (!nextCenter || nextCenter === center) return;
    center = nextCenter;
    frame = nextFrame;
    wallpaperSurface?.dispose();
    background?.remove();
    background = el('div', 'aha-wallpaper');
    background.setAttribute('aria-hidden', 'true');
    wallpaperSurface = createWallpaperSurface(background, { onChange: () => { syncWallpaperControl(); scheduleLayout(); } });
    // The responsive frame sits above the artwork and below native controls.
    background.append(stageFrame, mangaFrame, ambient.element);
    center.prepend(background);
    stage?.attach(center);
    for (const [node, name] of [[center, 'aha-host-center'], [frame, 'aha-host-frame']]) {
      if (!node.classList.contains(name)) {
        node.classList.add(name);
        ownedClasses.push([node, name]);
      }
    }
    observer.observe(center);
    syncPreferences();
  }
  // Observe only shell child replacement, never the streaming message subtree.
  const shellObserver = new MutationObserver(() => { attach(); scheduleLayout(); });
  const overlayParent = root.closest('[data-shell-overlay]')?.parentElement;
  if (overlayParent) shellObserver.observe(overlayParent, { childList: true });
  // Conversation phase and composer size can change independently of the shell.
  function watchContent() {
    const conversation = center?.querySelector('[data-phase]:has([data-conversation-content])');
    const scroll = center?.querySelector('[data-conversation-scroll]');
    if (conversation !== observedConversation || scroll !== observedScroll) {
      contentObserver.disconnect();
      observedConversation = conversation;
      observedScroll = scroll;
      if (conversation) contentObserver.observe(conversation, { attributes: true, attributeFilter: ['data-phase'] });
      if (scroll) contentObserver.observe(scroll, { childList: true });
      if (center) contentObserver.observe(center, { childList: true });
    }
    const nextTargets = new Set(center?.querySelectorAll('[data-composer-card], [data-composer-seat], [data-chat-flow]:not([data-chat-flow] [data-chat-flow]), .aha-welcome-art, .aha-welcome-copy, [data-conversation-header-leading], [data-conversation-header-trailing]') ?? []);
    for (const node of sizeTargets) {
      if (!nextTargets.has(node)) { observer.unobserve(node); sizeTargets.delete(node); }
    }
    for (const node of nextTargets) {
      if (!sizeTargets.has(node)) { observer.observe(node); sizeTargets.add(node); }
    }
    scheduleLayout();
  }
  const contentObserver = new MutationObserver(watchContent);
  attach();
  watchContent();
  // Native conversation replaces its root on navigation; use the slot registry signal
  // plus a bounded attribute observer, avoiding a full-body streaming observer.
  listen(window, 'resize', scheduleLayout);
  listen(document, 'scroll', scheduleLayout, true);
  listen(wind, 'click', () => store.update({ windPaused: !store.get().windPaused }));
  listen(portrait, 'click', () => events.emit('settings'));
  listen(wallpaperControl, 'click', () => {
    if (wallpaperSurface.getState().blocked) { store.update({ wallpaperPaused: false }); wallpaperSurface.retryPlayback(); }
    else store.update({ wallpaperPaused: !store.get().wallpaperPaused });
  });

  function closeSettings() {
    if (!panel) return;
    panel.dispose();
    panel.remove();
    backdrop.remove();
    panel = backdrop = undefined;
    if (returnFocus?.isConnected && returnFocus.getClientRects().length) returnFocus.focus();
    else document.querySelector('.aha-open-settings')?.focus();
  }
  function openSettings() {
    if (disposed || panel) return;
    returnFocus = document.activeElement;
    backdrop = el('div', 'aha-settings-backdrop');
    panel = createSettingsPanel({ store, wallpapers, portraits, welcomeMotionAvailable, onClose: closeSettings,
      onRetryWallpaper: () => { store.update({ wallpaperPaused: false }); wallpaperSurface.retryPlayback(); } });
    syncWallpaperControl();
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    backdrop.append(panel);
    root.append(backdrop);
    panel.querySelector('button')?.focus();
  }
  listen(root, 'keydown', (event) => {
    if (!panel || !panel.contains(event.target)) return;
    if (event.key === 'Escape') { event.stopPropagation(); closeSettings(); }
    if (event.key !== 'Tab') return;
    const focusable = [...panel.querySelectorAll('button,input,[tabindex="0"]')]
      .filter((node) => !node.disabled && node.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  const offOpen = events.on('settings', openSettings);
  offActivity = events.on('activity', syncActivity);
  offComplete = events.on('complete', () => {
    if (disposed || !store.get().completionStampEnabled || document.hidden || !canFloat) return;
    stamp.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => { stamp.hidden = true; }, 2200);
  });
  const offPreferences = store.subscribe(syncPreferences);
  syncPreferences();
  syncActivity();

  return () => {
    if (disposed) return;
    disposed = true;
    closeSettings();
    offPreferences(); offActivity(); offComplete(); offOpen();
    clearTimeout(timer);
    if (layoutFrame !== undefined) cancelAnimationFrame(layoutFrame);
    shellObserver.disconnect(); contentObserver.disconnect(); observer.disconnect();
    for (const remove of removers) remove();
    video.pause();
    video.removeAttribute('src');
    video.load();
    wallpaperSurface?.dispose();
    portrait.dispose();
    ambient.dispose();
    stage?.attach(null);
    background?.remove();
    for (const [node, name] of ownedClasses) node.classList.remove(name);
    root.replaceChildren();
    root.classList.remove('aha-scene');
  };
}
