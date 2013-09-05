/**
 * Namespace for the Camera app.
 */
var camera = camera || {};

/**
 * Namespace for effects.
 */
camera.effects = camera.effects || {};

/**
 * @private {camera.effects.Andy} tracker
 * @constructor
 * @extend {camera.Effect}
 */
camera.effects.Pinch = function(tracker) {
  camera.Effect.call(this, tracker);
};

camera.effects.Pinch.prototype = {
  __proto__: camera.Effect.prototype
};

camera.effects.Pinch.prototype.filterFrame = function(canvas) {
  canvas.bulgePinch(canvas.width / 2, canvas.height / 2, canvas.width / 2, 1);
};

camera.effects.Pinch.prototype.getTitle = function() {
  return 'Pinch';
};

