const ROOT_MARGIN = "140px";

let observer = null;
/** @type {Map<Element, () => void>} */
const callbacks = new Map();

function ensureObserver() {
  if (observer) return observer;
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const fn = callbacks.get(entry.target);
        if (!fn) continue;
        callbacks.delete(entry.target);
        observer?.unobserve(entry.target);
        fn();
      }
    },
    { root: null, rootMargin: ROOT_MARGIN, threshold: 0.01 },
  );
  return observer;
}

/**
 * @param {Element} el
 * @param {() => void} onVisible
 * @returns {() => void} cleanup
 */
export function observeWhenNearViewport(el, onVisible) {
  const obs = ensureObserver();
  callbacks.set(el, onVisible);
  obs.observe(el);
  return () => {
    callbacks.delete(el);
    obs.unobserve(el);
  };
}
