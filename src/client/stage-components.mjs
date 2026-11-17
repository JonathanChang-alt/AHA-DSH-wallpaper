import React from 'react';

export function ComposerStage() {
  return React.createElement('div', { className: 'aha-composer-stage', 'aria-hidden': true },
    React.createElement('span', { className: 'aha-console-rail' }),
    React.createElement('span', { className: 'aha-console-corner aha-console-corner-left' }, '◆'),
    React.createElement('span', { className: 'aha-console-corner aha-console-corner-right' }, '◆'),
    ...['left', 'center', 'right'].map(position => React.createElement('span', { key: position, className: `aha-console-spark aha-console-spark-${position}` }, '✦')));
}

export function createStageBadge(controller) {
  return function StageBadge() {
    const state = React.useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
    return React.createElement('span', { className: 'aha-stage-badge', 'data-aha-stage-phase': state.phase, 'aria-hidden': true },
      React.createElement('span', { className: 'aha-stage-emblem' },
        React.createElement('span', { className: 'aha-stage-mask' }),
        React.createElement('span', { className: 'aha-stage-card aha-stage-card-back' }, '♦'),
        React.createElement('span', { className: 'aha-stage-card aha-stage-card-front' }, '♠')),
      React.createElement('span', { className: 'aha-stage-label' }, state.label));
  };
}
