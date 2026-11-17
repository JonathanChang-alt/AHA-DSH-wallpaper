import React from 'react';
import { WELCOME_ART, WELCOME_MOTION } from './assets.generated.mjs';
import { mountWelcomeSurface } from './welcome-surface.mjs';

const COPY = {
  wink: { title: '眨眼开场', kicker: '✦ 欢 愉，准 备 就 绪 ✦', headline: '好戏，从这里开始。', caption: '今天想为哪个灵感，拉开帷幕？', alt: '眨眼举起猫爪的小阿哈' },
  heart: { title: '捧心好戏', kicker: 'THE NEXT ACT', headline: '把灵感，变成一场好戏。', caption: '这一次，让想象先出牌。', alt: '双手捧着红心的小阿哈' },
  shy: { title: '害羞探头', kicker: '✦ 幕 后 的 小 小 期 待', headline: '下一个惊喜，\n就从这一句开始。', caption: '阿哈已经就位，轮到你啦。', alt: '害羞捧脸的小阿哈从输入框上沿探头' },
};
const h = React.createElement;

export function createWelcomeHero(controller, { store, activity, events }) {
  function WelcomeMedia({ variant, sessionId, alt }) {
    const ref = React.useRef(null), surface = React.useRef(null);
    React.useEffect(() => {
      surface.current = mountWelcomeSurface(ref.current, { motion: WELCOME_MOTION[variant], store, activity, events });
      return () => { surface.current?.dispose(); surface.current = null; };
    }, [variant]);
    React.useEffect(() => { surface.current?.activateSession(sessionId); }, [variant, sessionId]);
    return h('span', { ref, className: 'aha-welcome-media', role: 'img', 'aria-label': alt },
      h('img', { className: 'aha-welcome-character', src: WELCOME_ART[variant], alt: '', draggable: false }));
  }
  return function WelcomeHero() {
    const { variant, sessionId } = React.useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
    const copy = COPY[variant];
    return h('div', {
      className: 'aha-welcome',
      'data-aha-welcome-variant': variant,
      'data-aha-welcome-session': sessionId ?? '',
      'aria-label': `${copy.title}欢迎区`,
    },
    h('div', { className: 'aha-welcome-art' },
      variant === 'heart' && h('div', { className: 'aha-welcome-poker-fan', 'aria-hidden': true },
        h('span', { className: 'aha-welcome-poker aha-poker-left' }, 'A', h('em', null, '♦')),
        h('span', { className: 'aha-welcome-poker aha-poker-right' }, 'A', h('em', null, '♠')),
        h('span', { className: 'aha-welcome-spark aha-spark-left' }, '✦'),
        h('span', { className: 'aha-welcome-spark aha-spark-right' }, '✧')),
      h(WelcomeMedia, { variant, sessionId, alt: copy.alt })),
    h('div', { className: 'aha-welcome-copy' },
      h('span', { className: 'aha-welcome-kicker' }, copy.kicker),
      h('h2', null, copy.headline),
      h('p', null, copy.caption)));
  };
}

/** Observe the native current-binding source without changing navigation. */
export function observeWelcomeSession(ctx, controller) {
  const source = ctx.uiSession.adapter.current;
  const sync = () => controller.activateSession(source.getSnapshot().key);
  const off = source.subscribe(sync);
  try { sync(); } catch (error) { off(); throw error; }
  return off;
}
