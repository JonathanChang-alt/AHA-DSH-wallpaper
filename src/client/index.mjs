import React from 'react';
import css from './theme.css';
import uiRefinements from './ui-refinements.css';
import reading from './reading.css';
import ambientCss from './ambient.css';
import portraitCss from './portrait.css';
import { createPreferencesStore } from '../core/preferences.mjs';
import { createActivityController } from '../core/activity.mjs';
import { observeHostActivity } from './host-adapter.mjs';
import { mountScene } from './scene.mjs';
import { WORDMARK_DATA, ART_WALLPAPERS } from './assets.generated.mjs';
import { THEME_TOKENS } from './palette.mjs';
import { createWelcomeController } from '../core/welcome.mjs';
import { createWelcomeHero, observeWelcomeSession } from './welcome-hero.mjs';
import { createStagePresentation } from './stage-presentation.mjs';
import { ComposerStage, createStageBadge } from './stage-components.mjs';

export const inject = ['slots', 'theme', 'sessions', 'uiSession'];
const LIFECYCLE_KEY = Symbol.for('aha-dsh-wallpaper.lifecycle.v1');

function createEvents() {
  const listeners = new Map();
  return {
    on(name, listener) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(listener);
      return () => listeners.get(name)?.delete(listener);
    },
    emit(name, value) { for (const listener of [...(listeners.get(name) ?? [])]) listener(value); },
    dispose() { listeners.clear(); },
  };
}

export function apply(ctx) {
  ctx.effect(() => {
    // Development rebuilds can overlap module generations. Dispose our previous
    // generation before capturing host values for this one.
    globalThis[LIFECYCLE_KEY]?.();
    const disposers = [];
    let disposed = false;
    const cleanup = () => {
      if (disposed) return;
      disposed = true;
      for (const dispose of disposers.reverse()) {
        try { dispose(); } catch { /* Continue restoring the other owned resources. */ }
      }
      if (globalThis[LIFECYCLE_KEY] === cleanup) delete globalThis[LIFECYCLE_KEY];
    };
    globalThis[LIFECYCLE_KEY] = cleanup;
    try {
      const store = createPreferencesStore({ builtinIds: ART_WALLPAPERS.map(({ id }) => id) });
      disposers.push(() => store.dispose());
      const events = createEvents();
      disposers.push(() => events.dispose());
      const activity = createActivityController({
        onChange: (state) => events.emit('activity', state),
        onComplete: (id) => events.emit('complete', id),
      });
      disposers.push(() => activity.dispose());
      const previous = document.body.getAttribute('data-aha-dsh');
      const style = document.createElement('style');
      style.dataset.ahaOwned = 'theme';
      style.textContent = `${css}\n${uiRefinements}\n${reading}\n${ambientCss}\n${portraitCss}`;
      document.head.append(style);
      document.body.setAttribute('data-aha-dsh', 'light-v1');
      disposers.push(() => {
        style.remove();
        if (document.body.getAttribute('data-aha-dsh') === 'light-v1') {
          if (previous === null) document.body.removeAttribute('data-aha-dsh');
          else document.body.setAttribute('data-aha-dsh', previous);
        }
      });
      const vars = ['--aha-reading-mask'];
      const previousVars = vars.map((key) => [key, document.body.style.getPropertyValue(key), document.body.style.getPropertyPriority(key)]);
      const sync = () => {
        const preferences = store.get();
        activity.setPreferences(preferences);
        document.body.style.setProperty('--aha-reading-mask', String(preferences.readingMask));
      };
      sync();
      const offPreferences = store.subscribe(sync);
      disposers.push(() => {
        offPreferences();
        for (const [key, value, priority] of previousVars) {
          if (value) document.body.style.setProperty(key, value, priority);
          else document.body.style.removeProperty(key);
        }
      });
      disposers.push(ctx.theme.overrideTokens('aha-dsh-wallpaper.light-v1', THEME_TOKENS));
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      const updateVisibility = () => activity.setVisibility(!document.hidden);
      const updateMotion = () => activity.setReducedMotion(media.matches);
      document.addEventListener('visibilitychange', updateVisibility);
      media.addEventListener('change', updateMotion);
      updateVisibility(); updateMotion();
      disposers.push(() => {
        document.removeEventListener('visibilitychange', updateVisibility);
        media.removeEventListener('change', updateMotion);
      });
      disposers.push(observeHostActivity(ctx, { onTask: (task) => activity.setTask(task) }));
      const stage = createStagePresentation({ store, activity, events });
      disposers.push(() => stage.dispose());
      const StageBadge = createStageBadge(stage);
      const welcome = createWelcomeController();
      disposers.push(() => welcome.dispose());
      disposers.push(observeWelcomeSession(ctx, welcome));
      const WelcomeHero = createWelcomeHero(welcome, { store, activity, events });

      function Scene() {
        const ref = React.useRef(null);
        React.useEffect(() => mountScene(ref.current, { store, activity, events, stage }), []);
        return React.createElement('div', { ref, 'data-aha-owned': 'scene' });
      }
      function Wordmark() {
        return React.createElement('img', { className: 'aha-wordmark', src: WORDMARK_DATA, alt: '星神·阿哈', draggable: false });
      }
      function Star() { return React.createElement('span', { className: 'aha-brand-star', 'aria-hidden': true }, '✦'); }
      function SettingsButton() {
        return React.createElement('button', { type: 'button', className: 'aha-open-settings', onClick: () => events.emit('settings') },
          React.createElement('span', { 'aria-hidden': true }, '✧'), React.createElement('span', null, '阿哈主题'));
      }
      for (const [name, id, Component] of [
        ['shell.overlay', 'aha.scene', Scene],
        ['sidebar.brand.name', 'aha.wordmark', Wordmark],
        ['sidebar.brand.mark', 'aha.star', Star],
        ['conversation.hero.brand.mark', 'aha.hero', WelcomeHero],
        ['conversation.input.overlay', 'aha.console', ComposerStage],
        ['conversation.composer.dock', 'aha.task-stage', StageBadge],
        ['sidebar.footer.action', 'aha.settings', SettingsButton],
      ]) {
        const off = ctx.slots.inject(name, () => ctx.slots.register({ name, id, priority: -100 }, Component));
        if (typeof off === 'function') disposers.push(off);
      }
      return cleanup;
    } catch (error) {
      cleanup();
      throw error;
    }
  }, 'aha-dsh: light theater theme');
}
