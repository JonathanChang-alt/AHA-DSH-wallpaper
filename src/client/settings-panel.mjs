let panelSequence = 0;

/**
 * Create the AHA theme settings UI without changing its host's layout.
 * Defaults and persistence belong to the supplied store.
 * Call panel.dispose() before discarding the element.
 */
export function createSettingsPanel({ store, wallpapers, portraits = [], welcomeMotionAvailable = false, onRetryWallpaper, onClose } = {}) {
  if (!store || ['get', 'update', 'subscribe', 'reset'].some(
    (method) => typeof store[method] !== 'function',
  )) {
    throw new TypeError('createSettingsPanel requires a theme settings store.');
  }
  if (!Array.isArray(wallpapers)) {
    throw new TypeError('createSettingsPanel requires the built-in wallpaper list.');
  }

  const knownIds = new Set();
  const builtIns = wallpapers.map((wallpaper) => {
    if (!wallpaper || typeof wallpaper.id !== 'string' || !wallpaper.id
      || knownIds.has(wallpaper.id)) {
      throw new TypeError('Each built-in wallpaper must have a unique string id.');
    }
    knownIds.add(wallpaper.id);
    return { ...wallpaper };
  });

  const document = globalThis.document;
  const prefix = `aha-settings-${++panelSequence}`;
  const removers = [];
  let disposed = false;
  let onlyFavorites = false;
  let unsubscribe = () => {};

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  function listen(node, eventName, handler) {
    const guardedHandler = (event) => {
      if (!disposed) handler(event);
    };
    node.addEventListener(eventName, guardedHandler);
    removers.push(() => node.removeEventListener(eventName, guardedHandler));
  }

  function button(className, text) {
    const node = element('button', className, text);
    node.type = 'button';
    return node;
  }

  function group(title, className) {
    const fieldset = element('fieldset', `aha-settings-group ${className}`);
    fieldset.append(element('legend', 'aha-settings-legend', title));
    return fieldset;
  }

  const panel = element('aside', 'aha-settings-panel');
  const title = element('h2', 'aha-settings-title', '主题设置');
  title.id = `${prefix}-title`;
  panel.setAttribute('aria-labelledby', title.id);
  const header = element('header', 'aha-settings-header');
  header.append(title);
  if (typeof onClose === 'function') {
    const close = button('aha-settings-close', '关闭');
    close.setAttribute('aria-label', '关闭主题设置');
    listen(close, 'click', () => onClose());
    header.append(close);
  }
  panel.append(header);

  const body = element('div', 'aha-settings-body');
  panel.append(body);

  const wallpaperGroup = group('壁纸', 'aha-settings-wallpapers');
  const filterLabel = element('label', 'aha-settings-filter');
  const filter = element('input', 'aha-settings-filter-input');
  filter.type = 'checkbox';
  filter.id = `${prefix}-favorites-only`;
  filter.name = 'favoritesOnly';
  filter.setAttribute('data-aha-setting', 'favoritesOnly');
  filterLabel.htmlFor = filter.id;
  filterLabel.append(filter, element('span', 'aha-settings-filter-label', '只看收藏'));
  const gallery = element('div', 'aha-wallpaper-grid');
  const empty = element('p', 'aha-wallpaper-empty', '还没有收藏的壁纸。');
  empty.setAttribute('role', 'status');
  empty.hidden = true;
  wallpaperGroup.append(filterLabel, gallery, empty);
  body.append(wallpaperGroup);
  const motionGroup = group('动态壁纸', 'aha-settings-wallpaper-motion');
  motionGroup.hidden = true;
  const playbackNote = element('p', 'aha-settings-note');
  const retryPlayback = button('aha-settings-retry', '继续播放壁纸');
  retryPlayback.hidden = true;
  if (typeof onRetryWallpaper === 'function') listen(retryPlayback, 'click', onRetryWallpaper);
  body.append(motionGroup);
  let playbackState;

  const portraitGroup = group('头像', 'aha-settings-portraits');
  portraitGroup.hidden = portraits.length === 0;
  const portraitGallery = element('div', 'aha-portrait-grid');
  portraitGroup.append(portraitGallery);
  body.append(portraitGroup);
  const portraitControls = portraits.map((portrait, index) => {
    const choice = element('label', 'aha-portrait-choice');
    choice.dataset.ahaPortraitId = portrait.id;
    const radio = element('input');
    radio.type = 'radio'; radio.name = `${prefix}-portrait`; radio.value = portrait.id;
    radio.id = `${prefix}-portrait-${index}`;
    radio.dataset.ahaSetting = 'selectedPortrait';
    radio.setAttribute('aria-label', portrait.title);
    choice.htmlFor = radio.id;
    const image = element('img', 'aha-portrait-thumbnail');
    image.src = portrait.src; image.alt = ''; image.draggable = false;
    choice.append(image, radio, element('span', '', portrait.title), element('span', 'aha-portrait-motion-tag', portrait.motion?.src ? '动态' : '静态'));
    listen(radio, 'change', () => { if (radio.checked) store.update({selectedPortrait: portrait.id}); });
    portraitGallery.append(choice);
    return {portrait, choice, radio};
  });

  const wallpaperControls = builtIns.map((wallpaper, index) => {
    const card = element('div', 'aha-wallpaper-card');
    card.setAttribute('data-aha-wallpaper-id', wallpaper.id);
    const choice = element('label', 'aha-wallpaper-choice');
    const radio = element('input', 'aha-wallpaper-radio');
    radio.type = 'radio';
    radio.name = `${prefix}-wallpaper`;
    radio.id = `${prefix}-wallpaper-${index}`;
    radio.value = wallpaper.id;
    radio.setAttribute('data-aha-setting', 'selectedWallpaper');
    choice.htmlFor = radio.id;
    choice.append(radio);

    if (wallpaper.thumbnail) {
      const thumbnail = element('img', 'aha-wallpaper-thumbnail');
      thumbnail.src = String(wallpaper.thumbnail);
      thumbnail.alt = '';
      thumbnail.loading = 'lazy';
      thumbnail.draggable = false;
      if (wallpaper.mirrored) thumbnail.style.transform = 'scaleX(-1)';
      choice.append(thumbnail);
    }
    const name = element('span', 'aha-wallpaper-title', wallpaper.title ?? wallpaper.id);
    name.id = `${radio.id}-title`;
    radio.setAttribute('aria-labelledby', name.id);
    choice.append(name);
    if (wallpaper.description) {
      const description = element('span', 'aha-wallpaper-description', wallpaper.description);
      description.id = `${radio.id}-description`;
      radio.setAttribute('aria-describedby', description.id);
      choice.append(description);
    }

    const favorite = button('aha-wallpaper-favorite', '收藏');
    favorite.setAttribute('data-aha-favorite-id', wallpaper.id);
    listen(radio, 'change', () => {
      if (radio.checked) store.update({ selectedWallpaper: wallpaper.id });
    });
    listen(favorite, 'click', () => {
      const current = store.get();
      const favorites = new Set(Array.isArray(current.favorites) ? current.favorites : []);
      if (favorites.has(wallpaper.id)) favorites.delete(wallpaper.id);
      else favorites.add(wallpaper.id);
      store.update({ favorites: [...favorites] });
    });
    card.append(choice, favorite);
    if (wallpaper.motion?.src || wallpaper.kind === 'video') {
      const badge = element('span', 'aha-ui-media-badge', '动态');
      badge.setAttribute('aria-label', '支持动态壁纸');
      card.append(badge);
    }
    gallery.append(card);
    return { wallpaper, card, radio, favorite };
  });

  const readingGroup = group('阅读', 'aha-settings-reading');
  body.append(readingGroup);
  const ranges = [];

  function addRange(key, labelText, min, max) {
    const row = element('div', 'aha-settings-range-row');
    const input = element('input', 'aha-settings-range');
    input.type = 'range';
    input.id = `${prefix}-${key}`;
    input.name = key;
    input.min = String(min);
    input.max = String(max);
    input.step = '0.01';
    input.setAttribute('data-aha-setting', key);
    const label = element('label', 'aha-settings-label', labelText);
    label.htmlFor = input.id;
    const output = element('output', 'aha-settings-range-value');
    output.htmlFor = input.id;
    output.setAttribute('aria-label', `${labelText}数值`);
    listen(input, 'input', () => {
      const value = Number(input.value);
      if (Number.isFinite(value)) store.update({ [key]: value });
    });
    row.append(label, input, output);
    readingGroup.append(row);
    ranges.push({ key, input, output });
  }

  addRange('wallpaperOpacity', '显影', 0.25, 1);
  addRange('readingMask', '阅读遮罩', 0.86, 1);

  const decorationGroup = group('装饰', 'aha-settings-decorations');
  body.append(decorationGroup);
  const toggles = [];

  function addToggle(key, labelText, parent = decorationGroup) {
    const label = element('label', 'aha-settings-toggle');
    const input = element('input', 'aha-settings-toggle-input');
    input.type = 'checkbox';
    input.id = `${prefix}-${key}`;
    input.name = key;
    input.setAttribute('data-aha-setting', key);
    label.htmlFor = input.id;
    label.append(input, element('span', 'aha-settings-toggle-label', labelText));
    listen(input, 'change', () => store.update({ [key]: input.checked }));
    parent.append(label);
    toggles.push({ key, input });
    return input;
  }

  addToggle('decorationsEnabled', '装饰');
  addToggle('portraitEnabled', '右上角头像').title = '200 像素头像；空间不足时自动收起。';
  const portraitNote = element('p', 'aha-settings-note');
  if (portraits.length) {
    addToggle('portraitMotionEnabled', '头像动效', portraitGroup);
    addToggle('portraitPaused', '暂停头像', portraitGroup);
    portraitGroup.append(portraitNote);
  }
  addToggle('interfaceMotionEnabled', '输入与任务动效');
  addToggle('environmentMotionEnabled', '环境动效').title = '鎏金剧场的吊星与微光，随壁纸暂停。';
  if (welcomeMotionAvailable) addToggle('welcomeMotionEnabled', '欢迎贴纸动效');
  addToggle('dynamicWallpaperEnabled', '播放动态壁纸', motionGroup);
  addToggle('wallpaperPaused', '暂停壁纸', motionGroup);
  motionGroup.append(playbackNote, retryPlayback);
  addToggle('windEnabled', '风车');
  addToggle('windPaused', '暂停风车');
  addToggle('completionStampEnabled', '完成印章');

  const future = element('section', 'aha-settings-future');
  future.setAttribute('aria-labelledby', `${prefix}-future-title`);
  const futureTitle = element('h3', 'aha-settings-subtitle', '后续开放');
  futureTitle.id = `${prefix}-future-title`;
  future.append(futureTitle, element('p', 'aha-settings-note', '音乐：后续开放。'));
  body.append(future);

  const footer = element('footer', 'aha-settings-footer');
  const reset = button('aha-settings-reset', '恢复默认');
  listen(reset, 'click', () => store.reset());
  footer.append(reset);
  panel.append(footer);

  function syncState() {
    if (disposed) return;
    const state = store.get();
    const portraitHasMotion = Boolean(portraits.find(item => item.id === state.selectedPortrait)?.motion?.src);
    portraitNote.textContent = portraitHasMotion ? '静音循环；暂停保留当前画面，关闭动效显示静态头像。' : '当前为静态头像。其他三款支持动态播放。';
    for (const {portrait, choice, radio} of portraitControls) {
      radio.checked = state.selectedPortrait === portrait.id;
      choice.dataset.ahaSelected = String(radio.checked);
    }
    const wallpaper = builtIns.find(item => item.id === state.selectedWallpaper);
    motionGroup.hidden = !wallpaper?.motion?.src && wallpaper?.kind !== 'video';
    playbackNote.textContent = playbackState?.failed ? '当前动态素材暂时无法播放，已显示静态壁纸。'
      : playbackState?.blocked ? '播放已暂停，可使用壁纸播放按钮重试。' : '暂停保留当前画面。系统减少动态时自动暂停。';
    retryPlayback.hidden = !playbackState?.blocked || !state.dynamicWallpaperEnabled || typeof onRetryWallpaper !== 'function';
    const favorites = new Set(Array.isArray(state.favorites) ? state.favorites : []);
    let visibleCount = 0;
    for (const { wallpaper, card, radio, favorite } of wallpaperControls) {
      const isFavorite = favorites.has(wallpaper.id);
      const isSelected = state.selectedWallpaper === wallpaper.id;
      const willHide = onlyFavorites && !isFavorite;
      if (willHide && card.contains(document.activeElement)) filter.focus();
      card.hidden = willHide;
      card.setAttribute('data-aha-selected', String(isSelected));
      card.setAttribute('data-aha-favorite', String(isFavorite));
      radio.checked = isSelected;
      favorite.textContent = isFavorite ? '已收藏' : '收藏';
      favorite.setAttribute('aria-pressed', String(isFavorite));
      favorite.setAttribute('aria-label', `${isFavorite ? '取消收藏' : '收藏'}：${wallpaper.title ?? wallpaper.id}`);
      if (!willHide) visibleCount++;
    }
    empty.textContent = onlyFavorites ? '还没有收藏的壁纸。' : '暂无内置壁纸。';
    empty.hidden = visibleCount !== 0;
    for (const { key, input, output } of ranges) {
      const value = state[key];
      if (Number.isFinite(value)) {
        input.value = String(value);
        output.value = `${Math.round(value * 100)}%`;
        input.setAttribute('aria-valuetext', output.value);
      }
    }
    for (const { key, input } of toggles) {
      input.checked = Boolean(state[key]);
      if (key === 'wallpaperPaused') input.disabled = !state.dynamicWallpaperEnabled;
      if (key === 'portraitMotionEnabled') input.disabled = !portraitHasMotion;
      if (key === 'portraitPaused') input.disabled = !portraitHasMotion || !state.portraitMotionEnabled;
    }
  }

  listen(filter, 'change', () => {
    onlyFavorites = filter.checked;
    syncState();
  });

  panel.dispose = () => {
    if (disposed) return;
    disposed = true;
    unsubscribe();
    for (const remove of removers) remove();
    removers.length = 0;
  };
  panel.setWallpaperPlaybackState = next => { if (!disposed) { playbackState = next; syncState(); } };

  syncState();
  const cleanup = store.subscribe(syncState);
  if (typeof cleanup === 'function') unsubscribe = cleanup;
  return panel;
}
