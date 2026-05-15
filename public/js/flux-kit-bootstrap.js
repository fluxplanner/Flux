import * as storage from './core/storage.js';
import * as tasks from './features/tasks.js';
import * as calendar from './features/calendar.js';
import * as ai from './features/ai.js';
import * as notes from './features/notes.js';
import * as animations from './ui/animations.js';
import * as sidebar from './ui/sidebar.js';
import * as components from './ui/components.js';
import * as modals from './ui/modals.js';
import * as state from './core/state.js';
import * as events from './core/events.js';
import * as behavior from './core/behavior-engine.js';
import * as helpers from './utils/helpers.js';
import * as dom from './utils/dom.js';

function initFluxKit() {
  try {
    sidebar.initSidebar();
  } catch (e) {
    console.warn('[FluxKit] sidebar', e);
  }
  try {
    notes.attachNotesEditorIfPresent();
  } catch (e) {
    console.warn('[FluxKit] notes', e);
  }
  try {
    modals.initModals();
  } catch (e) {
    console.warn('[FluxKit] modals', e);
  }
}

window.FluxKit = {
  storage,
  tasks,
  calendar,
  ai,
  notes,
  ui: {
    animations,
    components,
    sidebar,
    modals,
  },
  core: { state, events, behavior },
  behavior,
  utils: { helpers, dom },
  animateIn: animations.animateIn,
  magneticEffect: animations.magneticEffect,
  getAIContext: ai.getAIContext,
  version: 2,
  init: initFluxKit,
};

window.FluxBehavior = behavior;
window.FluxEvents = events;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFluxKit);
} else {
  initFluxKit();
}
