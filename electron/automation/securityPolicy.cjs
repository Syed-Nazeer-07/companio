'use strict';

// Narrow, pure security rules so they can be independently regression-tested.
function allowPermissionRequest(permission, details, trustedMainFrame) {
  if (!trustedMainFrame) return false;
  if (permission === 'notifications') return true;
  return permission === 'media' && Array.isArray(details?.mediaTypes)
    && details.mediaTypes.length === 1 && details.mediaTypes[0] === 'audio';
}

function allowPermissionCheck(permission, details, trustedMainFrame) {
  if (!trustedMainFrame || details?.isMainFrame !== true) return false;
  if (permission === 'notifications') return true;
  return permission === 'media' && details?.mediaType === 'audio';
}

function validVolume(level) {
  return typeof level === 'number' && Number.isFinite(level) && level >= 0 && level <= 100;
}

function validPosition(position) {
  return !!position && typeof position === 'object'
    && Number.isSafeInteger(position.x) && Number.isSafeInteger(position.y)
    && Math.abs(position.x) < 100000 && Math.abs(position.y) < 100000;
}

module.exports = { allowPermissionRequest, allowPermissionCheck, validVolume, validPosition };
