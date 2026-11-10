'use strict';

// Coalesce bursts of native movement events into one non-blocking persistence
// operation. Flush on window close; cancel on destruction.
function createDebouncedWork(work, delayMs = 180, timers = { setTimeout, clearTimeout }) {
  if (typeof work !== 'function' ||
      !Number.isInteger(delayMs) || delayMs < 0 || delayMs > 2000 ||
      !timers || typeof timers.setTimeout !== 'function' ||
      typeof timers.clearTimeout !== 'function') {
    throw Error('Invalid debounced work configuration.');
  }
  let timer = null;
  const cancel = () => {
    if (timer !== null) timers.clearTimeout(timer);
    timer = null;
  };
  const schedule = () => {
    cancel();
    timer = timers.setTimeout(() => {
      timer = null;
      work();
    }, delayMs);
  };
  const flush = () => {
    cancel();
    work();
  };
  return { schedule, flush, cancel };
}
module.exports = { createDebouncedWork };
