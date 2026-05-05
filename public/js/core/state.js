/**
 * Tiny synchronous store for future UI / feature coordination (optional).
 */
export function createStore(initial) {
  let state = { ...initial };
  const listeners = new Set();
  return {
    getState: () => ({ ...state }),
    setState(partial) {
      state = { ...state, ...partial };
      listeners.forEach((fn) => {
        try {
          fn(state);
        } catch {
          /* ignore listener errors */
        }
      });
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
