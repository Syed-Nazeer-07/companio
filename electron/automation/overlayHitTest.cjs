'use strict';

/**
 * Pure DIP interactive-rect sanitization and mouse passthrough hit-testing
 * helpers shared by Electron main process and unit tests.
 */

function sanitizeInteractiveRects(rawRects, maxRects = 24) {
  if (!Array.isArray(rawRects)) return [];
  const cap = Number.isInteger(maxRects) && maxRects > 0 ? maxRects : 24;
  const cleaned = [];
  for (const rect of rawRects) {
    if (cleaned.length >= cap) break;
    if (
      !rect ||
      typeof rect !== 'object' ||
      !Number.isFinite(rect.x) ||
      !Number.isFinite(rect.y) ||
      !Number.isFinite(rect.width) ||
      !Number.isFinite(rect.height) ||
      rect.width <= 0 ||
      rect.height <= 0
    ) {
      continue;
    }
    cleaned.push({
      x: Math.floor(rect.x),
      y: Math.floor(rect.y),
      width: Math.ceil(rect.width),
      height: Math.ceil(rect.height)
    });
  }
  return cleaned;
}

function isPointInsideInteractiveRects(cursor, bounds, rects) {
  if (
    !cursor ||
    !bounds ||
    !Number.isFinite(cursor.x) ||
    !Number.isFinite(cursor.y) ||
    !Number.isFinite(bounds.x) ||
    !Number.isFinite(bounds.y) ||
    !Array.isArray(rects) ||
    rects.length === 0
  ) {
    return false;
  }

  const localX = cursor.x - bounds.x;
  const localY = cursor.y - bounds.y;
  for (const rect of rects) {
    if (
      !rect ||
      !Number.isFinite(rect.x) ||
      !Number.isFinite(rect.y) ||
      !Number.isFinite(rect.width) ||
      !Number.isFinite(rect.height) ||
      rect.width <= 0 ||
      rect.height <= 0
    ) {
      continue;
    }
    if (
      localX >= rect.x &&
      localX <= rect.x + rect.width &&
      localY >= rect.y &&
      localY <= rect.y + rect.height
    ) {
      return true;
    }
  }
  return false;
}

function shouldIgnoreOverlayMouse({ cursor, bounds, rects, dragging = false }) {
  if (dragging === true) return false;
  return !isPointInsideInteractiveRects(cursor, bounds, rects);
}

module.exports = {
  sanitizeInteractiveRects,
  isPointInsideInteractiveRects,
  shouldIgnoreOverlayMouse
};
