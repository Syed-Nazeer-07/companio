'use strict';

// Electron document loading and React history hydration finish at different
// times. Coalesce wake requests until the overlay explicitly reports ready.
function createActivationGate(deliver) {
  if (typeof deliver !== 'function') throw Error('Activation delivery callback required.');
  let ready = false;
  let pending = false;
  return {
    reset() { ready = false; pending = false; },
    isReady() { return ready; },
    activate() {
      if (ready) deliver();
      else pending = true;
    },
    markReady() {
      ready = true;
      if (pending) { pending = false; deliver(); }
    }
  };
}
module.exports = { createActivationGate };
