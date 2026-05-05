/**
 * Shared DOM helpers for feature modules (expand as patterns stabilize).
 */
import { animateIn } from './animations.js';

export function flareCard(el) {
  animateIn(el);
}
