/**
 * Namespace for the Camera app.
 */
var camera = camera || {};

/**
 * Creates a processor object, which takes the camera stream and processes it.
 * Flushes the result to a canvas.
 *
 * @param {Canvas|Video} input Canvas or Video with the input frame.
 * @param {fx.Canvas} output Canvas with the output frame.
 * @constructor
 */
camera.Processor = function(input, output) {
  /**
   * @type {Canvas|Video}
   * @private
   */
  this.input_ = input;

  /**
   * @type {fx.Canvas}
   * @private
   */
  this.output_ = output;

  /**
   * @type {fx.Texture}
   * @private
   */
  this.texture_ = this.output_.texture(this.input_);

  /**
   * @type {camera.Effect}
   */
  this.effect_ = null;
};

camera.Processor.prototype = {
  set effect(inEffect) {
    this.effect_ = inEffect;
  },
  get effect() {
    return this.effect_;
  }
};

camera.Processor.prototype.processFrame = function(texture) {
  try {
    this.texture_.loadContentsOf(this.input_);
    this.output_.draw(this.texture_);
    if (this.effect_)
      this.effect_.filterFrame(this.output_);
    this.output_.update();
  } catch (e) {}
};
