'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sanitizeInteractiveRects,
  isPointInsideInteractiveRects,
  shouldIgnoreOverlayMouse
} = require('../electron/automation/overlayHitTest.cjs');

test('empty interactive rects make entire overlay click-through', () => {
  const bounds = { x: 1152, y: 512, width: 360, height: 440 };
  assert.equal(
    shouldIgnoreOverlayMouse({
      cursor: { x: 1300, y: 800 },
      bounds,
      rects: [],
      dragging: false
    }),
    true
  );
});

test('cursor inside character, bubble, or input rect keeps overlay interactive while invisible top-left stays click-through', () => {
  const bounds = { x: 1152, y: 512, width: 360, height: 440 };
  const rects = sanitizeInteractiveRects([
    { x: 185, y: 245, width: 140, height: 150 }, // character sprite region
    { x: 24, y: 120, width: 312, height: 92 },   // speech bubble
    { x: 16, y: 392, width: 328, height: 44 }    // input bar
  ]);

  // Empty transparent top-left zone (previously swallowed desktop clicks)
  assert.equal(isPointInsideInteractiveRects({ x: 1200, y: 560 }, bounds, rects), false);
  assert.equal(
    shouldIgnoreOverlayMouse({ cursor: { x: 1200, y: 560 }, bounds, rects, dragging: false }),
    true
  );

  // Inside character hit rect (inclusive boundary check too)
  assert.equal(
    shouldIgnoreOverlayMouse({ cursor: { x: 1152 + 185, y: 512 + 245 }, bounds, rects, dragging: false }),
    false
  );
  // Inside speech bubble
  assert.equal(
    shouldIgnoreOverlayMouse({ cursor: { x: 1152 + 100, y: 512 + 160 }, bounds, rects, dragging: false }),
    false
  );
  // Inside input bar
  assert.equal(
    shouldIgnoreOverlayMouse({ cursor: { x: 1152 + 80, y: 512 + 410 }, bounds, rects, dragging: false }),
    false
  );

  // After closing chat UI (only character rect left), former input area is click-through immediately
  const idleRects = [rects[0]];
  assert.equal(
    shouldIgnoreOverlayMouse({ cursor: { x: 1152 + 80, y: 512 + 410 }, bounds, rects: idleRects, dragging: false }),
    true
  );
});

test('dragging state overrides hit-testing to capture drag motion continuously', () => {
  const bounds = { x: 1152, y: 512, width: 360, height: 440 };
  assert.equal(
    shouldIgnoreOverlayMouse({
      cursor: { x: 400, y: 200 },
      bounds,
      rects: [],
      dragging: true
    }),
    false
  );
});

test('supports multi-monitor negative DIP coordinates accurately', () => {
  const secondaryBounds = { x: -1200, y: -300, width: 360, height: 440 };
  const rects = sanitizeInteractiveRects([{ x: 200, y: 260, width: 120, height: 120 }]);

  assert.equal(
    shouldIgnoreOverlayMouse({
      cursor: { x: -950, y: 10 },
      bounds: secondaryBounds,
      rects,
      dragging: false
    }),
    false
  );
  assert.equal(
    shouldIgnoreOverlayMouse({
      cursor: { x: -1150, y: -250 },
      bounds: secondaryBounds,
      rects,
      dragging: false
    }),
    true
  );
});

test('sanitizeInteractiveRects filters malformed entries, floors/ceils DIP boxes, and enforces maxRects cap', () => {
  const raw = [
    null,
    'bad',
    { x: NaN, y: 10, width: 50, height: 50 },
    { x: 10, y: 10, width: 0, height: 20 },
    { x: 10, y: 10, width: 20, height: -5 },
    { x: 12.8, y: 19.9, width: 100.1, height: 40.2 },
    { x: 50, y: 60, width: 20, height: 20 },
    { x: 90, y: 100, width: 20, height: 20 }
  ];

  const capped = sanitizeInteractiveRects(raw, 2);
  assert.equal(capped.length, 2);
  assert.deepEqual(capped[0], { x: 12, y: 19, width: 101, height: 41 });
  assert.deepEqual(capped[1], { x: 50, y: 60, width: 20, height: 20 });
  assert.deepEqual(sanitizeInteractiveRects('not-an-array'), []);
});
