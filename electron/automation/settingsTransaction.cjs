'use strict';

// Treat native settings plus their disk representation as one user-visible
// operation. An unsuccessful disk write must never be presented as success.
function updateShortcutWithRollback(requested, previous, registerShortcut, saveShortcut) {
  const applied = registerShortcut(requested);
  if (!applied || applied.success !== true) {
    return applied || { success: false, error: 'Shortcut could not be registered.' };
  }

  if (saveShortcut(applied.shortcut) === true) {
    return { success: true, shortcut: applied.shortcut };
  }

  if (applied.shortcut === previous) {
    return { success: false, shortcut: previous, error: 'Could not save the shortcut; the existing shortcut is unchanged.' };
  }

  const restored = registerShortcut(previous);
  if (restored?.success === true) {
    return { success: false, shortcut: previous, error: 'Could not save the shortcut; the previous shortcut has been restored.' };
  }

  return {
    success: false,
    shortcut: applied.shortcut,
    error: 'Could not save the shortcut or restore the previous shortcut. The new shortcut may still be active; please retry.'
  };
}

function updateOverlayWithRollback(requested, previous, persist, apply) {
  if (persist(requested) !== true) {
    return { success: false, verified: false, error: 'Could not save overlay preferences; no changes were applied.' };
  }

  try {
    apply(requested);
    return { success: true, verified: true };
  } catch (error) {
    const diskRestored = persist(previous) === true;
    let windowRestored = true;
    try {
      apply(previous);
    } catch {
      windowRestored = false;
    }
    return {
      success: false,
      verified: false,
      error: 'Could not apply overlay preferences.' +
        (diskRestored && windowRestored
          ? ' Previous preferences have been restored.'
          : ' Automatic rollback was incomplete; restart Companio to reconcile settings.')
    };
  }
}

module.exports = { updateShortcutWithRollback, updateOverlayWithRollback };
