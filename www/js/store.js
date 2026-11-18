// Tiny pub/sub state container.
export function createStore(initial = {}) {
  let state = { ...initial };
  const subs = new Set();
  return {
    get: (k) => (k ? state[k] : state),
    set(patch) {
      state = { ...state, ...patch };
      subs.forEach((fn) => fn(state));
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

// App-wide state
export const appStore = createStore({ settings: {}, timeZone: 'UTC' });
