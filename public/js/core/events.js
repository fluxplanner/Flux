/** Lightweight app-wide event bus (CustomEvent). */
export const fluxEvents = new EventTarget();

export function emit(name, detail) {
  fluxEvents.dispatchEvent(new CustomEvent(name, { detail }));
}

export function on(name, handler) {
  fluxEvents.addEventListener(name, handler);
  return () => fluxEvents.removeEventListener(name, handler);
}
