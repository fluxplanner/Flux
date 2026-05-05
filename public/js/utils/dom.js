export function $(sel, root = document) {
  return root.querySelector(sel);
}

export function $$(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

export function on(parent, event, selector, handler) {
  if (!parent) return () => {};
  const fn = (e) => {
    const el = e.target.closest?.(selector);
    if (el && parent.contains(el)) handler.call(el, e, el);
  };
  parent.addEventListener(event, fn);
  return () => parent.removeEventListener(event, fn);
}
