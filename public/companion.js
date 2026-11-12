import { animateGrim } from './grim-sprites.mjs';
const sprite = animateGrim(document.getElementById('grim'), 'sleeping');
const pose = { idle: 'sleeping', paused: 'sleeping', waking: 'waking', listening: 'listening', thinking: 'thinking', working: 'working', speaking: 'speaking', success: 'success', returning: 'returning', error: 'error', waiting: 'waiting' };
window.grimDesktop?.onCompanionState(state => {
  document.body.dataset.phase = state.phase; sprite.setPose(pose[state.phase] || 'idle');
  document.getElementById('speech').textContent = state.message || '';
  document.getElementById('task-label').textContent = state.label || state.phase.toUpperCase();
  document.documentElement.style.setProperty('--origin-x', `${(state.origin?.x || 100) - 180}px`);
  document.documentElement.style.setProperty('--origin-y', `${(state.origin?.y || 260) - 250}px`);
});
window.addEventListener('beforeunload', () => sprite.stop());
