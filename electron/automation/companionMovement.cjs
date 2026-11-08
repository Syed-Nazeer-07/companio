'use strict';

// Compute a small, bounded move without touching the mouse or other windows.
const DIRECTIONS = Object.freeze(['left', 'right', 'up', 'down']);
function planCompanionMove(bounds, workArea, direction, distance = 64) {
  if (!DIRECTIONS.includes(direction) ||
      !Number.isInteger(distance) || distance < 1 || distance > 160 ||
      !bounds || !workArea ||
      ![bounds.x,bounds.y,bounds.width,bounds.height,workArea.x,workArea.y,workArea.width,workArea.height]
        .every(n => Number.isFinite(n))) {
    return null;
  }
  const minX = workArea.x, minY = workArea.y;
  const maxX = Math.max(minX, workArea.x + workArea.width - bounds.width);
  const maxY = Math.max(minY, workArea.y + workArea.height - bounds.height);
  let x = bounds.x, y = bounds.y;
  if (direction === 'left') x -= distance;
  if (direction === 'right') x += distance;
  if (direction === 'up') y -= distance;
  if (direction === 'down') y += distance;
  x = Math.min(maxX,Math.max(minX,x));
  y = Math.min(maxY,Math.max(minY,y));
  return { x: Math.round(x), y: Math.round(y), moved: Math.round(x) !== bounds.x || Math.round(y) !== bounds.y };
}
module.exports = { planCompanionMove, DIRECTIONS };
