/**
 * Namespace for the Camera app.
 */
var camera = camera || {};

/**
 * Creates the Camera App main object.
 * @constructor
 */
camera.Camera = function() {
  /**
   * Video element to catch the stream and plot it later onto a canvas.
   * @type {Video}
   * @private
   */
  this.video_ = document.createElement('video');

  /**
   * Shutter sound player.
   * @type {Audio}
   * @private
   */
  this.shutterSound_ = document.createElement('audio');

  /**
   * Canvas element with the current frame downsampled to small resolution, to
   * be used in effect preview windows.
   *
   * @type {Canvas}
   * @private
   */
  this.previewInputCanvas_ = document.createElement('canvas');

  /**
   * @type {boolean}
   * @private
   */
  this.running_ = false;

  /**
   * The main (full screen) canvas.
   * @type {fx.Canvas}
   * @private
   */
  this.mainCanvas_ = fx.canvas();

  /**
   * The main (full screen) processor.
   * @type {camera.Processor}
   * @private
   */
  this.mainProcessor_ = new camera.Processor(this.video_, this.mainCanvas_);

  /**
   * Processors for effect previews.
   * @type {Array.<camera.Processor>}
   * @private
   */
  this.previewProcessors_ = [];

  /**
   * Selected effect or null if no effect.
   * @type {number}
   */
  this.currentEffectIndex_ = 0;

  /**
   * Current frame.
   * @type {number}
   * @private
   */
  this.frame_ = 0;

  this.expanded_ = false;
  this.expandingOrCollapsing_ = false;
  this.taking_ = false;

  this.collapseTimer_ = null;
  this.collapsingTimer_ = null;
  this.expandingTimer_ = null;

  // Insert the main canvas to its container.
  this.mainCanvas_.id = 'canvas';
  document.querySelector('#canvas-wrapper').appendChild(this.mainCanvas_);

  // Set the default effect.
  this.mainProcessor_.effect = new camera.effects.Swirl();

  // Synchronize bounds of the video now, when window is resized or if the
  // video dimensions are loaded.
  window.addEventListener('resize', this.synchronizeBounds_.bind(this));
  this.video_.addEventListener('loadedmetadata',
      this.synchronizeBounds_.bind(this));
  this.synchronizeBounds_();

  // Prepare effect previews.
  this.addEffect_(new camera.effects.Normal());
  this.addEffect_(new camera.effects.Andy());
  this.addEffect_(new camera.effects.Swirl());
  this.addEffect_(new camera.effects.Pinch());
  this.addEffect_(new camera.effects.Grayscale());
  this.addEffect_(new camera.effects.Sepia());
  this.addEffect_(new camera.effects.Colorize());
  this.addEffect_(new camera.effects.Newspaper());
  this.addEffect_(new camera.effects.TiltShift());
  this.addEffect_(new camera.effects.Vintage());

  // Select the default effect.
  this.setCurrentEffect_(0);

  // Handle key presses to make the Camera app accessible via the keyboard.
  document.body.addEventListener('keydown', this.onKeyPressed_.bind(this));
  document.body.addEventListener(
      'mousemove', this.setExpanded_.bind(this, true));
  document.body.addEventListener(
      'click', this.setExpanded_.bind(this, true));

  // Make the preview ribbon possible to scroll by dragging with mouse.
  document.querySelector('#effects').addEventListener(
      'mousemove', this.onRibbonMouseMove_.bind(this));

  // Handle window decoration buttons.
  document.querySelector('#maximize').addEventListener('click',
      this.onMaximizeClicked_.bind(this));
  document.querySelector('#close').addEventListener('click',
      this.onCloseClicked_.bind(this));

  // Load the shutter sound.
  this.shutterSound_.src = '../sounds/shutter.wav';
};

camera.Camera.prototype.addEffect_ = function(effect) {
  // Create the preview on the ribbon.
  var list = document.querySelector('#effects');
  var wrapper = document.createElement('div');
  wrapper.className = 'preview-canvas-wrapper';
  var canvas = fx.canvas();
  var padder = document.createElement('div');
  padder.className = 'preview-canvas-padder';
  padder.appendChild(canvas);
  wrapper.appendChild(padder);
  var item = document.createElement('li');
  item.appendChild(wrapper);
  list.appendChild(item);
  var label = document.createElement('span');
  label.textContent = effect.getTitle();
  item.appendChild(label);

  // Calculate the effect index.
  var effectIndex = this.previewProcessors_.length;
  item.id = 'effect-' + effectIndex;

  // Assign events.
  item.addEventListener('click',
      this.setCurrentEffect_.bind(this, effectIndex));
  document.querySelector('#take-picture').addEventListener(
      'click', this.takePicture_.bind(this));

  // Create the preview processor.
  var processor = new camera.Processor(
      this.previewInputCanvas_, canvas);
  processor.effect = effect;
  this.previewProcessors_.push(processor);
};

camera.Camera.prototype.setCurrentEffect_ = function(effectIndex) {
  document.querySelector('#effects #effect-' + this.currentEffectIndex_).
      removeAttribute('selected');
  document.querySelector('#effects #effect-' + effectIndex).setAttribute(
      'selected', '');
  if (this.currentEffectIndex_ == effectIndex)
    this.previewProcessors_[effectIndex].effect.randomize();
  this.mainProcessor_.effect = this.previewProcessors_[effectIndex].effect;
  this.currentEffectIndex_ = effectIndex;
};

camera.Camera.prototype.onKeyPressed_ = function(event) {
  switch (event.keyIdentifier) {
    case 'Left':
      this.setCurrentEffect_(
          (this.currentEffectIndex_ + this.previewProcessors_.length - 1) %
              this.previewProcessors_.length);
      break;
    case 'Right':
      this.setCurrentEffect_(
          (this.currentEffectIndex_ + 1) % this.previewProcessors_.length);
      break;
    case 'Home':
      this.setCurrentEffect_(0);
      break;
    case 'End':
      this.setCurrentEffect_(this.previewProcessors_.length - 1);
      break;
    case 'Enter':
    case 'U+0020':
      this.takePicture_();
      break;
  }
};

camera.Camera.prototype.onRibbonMouseMove_ = function(event) {
  if (event.which != 1)
    return;
  var ribbon = document.querySelector('#effects');
  ribbon.scrollLeft = parseInt(ribbon.scrollLeft) - event.webkitMovementX;
};

camera.Camera.prototype.onMaximizeClicked_ = function(event) {
  if (chrome.app.window.current().isMaximized())
    chrome.app.window.current().restore();
  else
    chrome.app.window.current().maximize();
};

camera.Camera.prototype.onCloseClicked_ = function(event) {
  chrome.app.window.current().close();
};

camera.Camera.prototype.setExpanded_ = function(expanded) {
  if (this.collapseTimer_) {
    clearTimeout(this.collapseTimer_);
    this.collapseTimer_ = null;
  }
  if (this.collapsingTimer_) {
    clearTimeout(this.collapsingTimer_);
    this.collapsingTimer_ = null;
  }
  if (this.expandingTimer_) {
    clearTimeout(this.expandingTimer_);
    this.expandingTimer_ = null;
  }
  if (expanded) {
    document.body.classList.add('expanded');
    this.collapseTimer_ = setTimeout(this.setExpanded_.bind(this, false), 2000);
    this.expandingOrCollapsing_ = true;
    this.expandingTimer_ = setTimeout(function() {
      this.expanded_ = true;
      this.expandingOrCollapsing_ = false;
    }.bind(this), 250);
  } else {
    document.body.classList.remove('expanded');
    this.expanded_ = false;
    this.expandingOrCollapsing_ = true;
    this.collapsingTimer_ = setTimeout(function() {
      this.expandingOrCollapsing_ = false;
    }.bind(this), 250);
   }
};

camera.Camera.prototype.takePicture_ = function() {
  // Lock refreshing for smoother experience.
  this.taking_ = true;

  // Take the picture and save to disk.
  // TODO(mtomasz): To be implemented.

  // Show flashing animation with the shutter sound.
  document.body.classList.add('show-shutter');
  setTimeout(function() {
    document.body.classList.remove('show-shutter');
    this.taking_ = false;
  }.bind(this), 200);

  this.shutterSound_.currentTime = 0;
  this.shutterSound_.play();

  setTimeout(function() {
    this.mainProcessor_.processFrame();
    var dataURL = this.mainCanvas_.toDataURL('image/jpeg');

    // Create a picture preview animation.
    var picturePreview = document.querySelector('#picture-preview');
    picturePreview.textContent = '';
    var img = document.createElement('img');
    img.src = dataURL;
    img.style.webkitTransform = 'rotate(' + (Math.random() * 60 - 30) + 'deg)';
    picturePreview.appendChild(img);
  }.bind(this), 0);
};

/**
 * Resolutions to be probed on the camera. Format: [[width, height], ...].
 * @type {Array.<Array>}
 * @const
 */
camera.Camera.RESOLUTIONS = [[1280, 720], [800, 600], [640, 480]];

/**
 * @type {camera.Camera} Singleton of the Camera object.
 * @private
 */
camera.Camera.instance_ = null;

/**
 * Returns the singleton instance of the Camera class.
 * @return {camera.Camera}
 */
camera.Camera.getInstance = function() {
  if (!camera.Camera.instance_)
    camera.Camera.instance_ = new camera.Camera();
  return camera.Camera.instance_;
};

/**
 * Synchronizes video size with the window's current size.
 * @private
 */
camera.Camera.prototype.synchronizeBounds_ = function() {
  if (!this.video_.videoWidth)
    return;

  var width = document.body.offsetWidth;
  var height = document.body.offsetHeight;
  var windowRatio = width / height;
  var videoRatio = this.video_.videoWidth / this.video_.videoHeight;

  this.video_.width = this.video_.videoWidth;
  this.video_.height = this.video_.videoHeight;

  // Add 1 pixel to avoid artifacts.
  var zoom = (width + 1) / this.video_.videoWidth;

  // Set resolution of the low-resolution preview input canvas.
  if (videoRatio < 1.5) {
    // For resolutions: 800x600.
    this.previewInputCanvas_.width = 120;
    this.previewInputCanvas_.height = 90;
  } else {
    // For wide resolutions (any other).
    this.previewInputCanvas_.width = 192;
    this.previewInputCanvas_.height = 108;
  }
};

/**
 * Starts capturing with the specified resolution.
 *
 * @param {Array} resolution Width and height of the capturing mode, eg.
 *     [800, 600].
 * @param {function(number, number)} onSuccess Success callback with the set
 *                                   resolution.
 * @param {function()} onFailure Failure callback, eg. the resolution is
 *                     not supported.
 * @private
 */
 camera.Camera.prototype.startWithResolution_ =
     function(resolution, onSuccess, onFailure) {
  if (this.running_)
    this.stop();

  navigator.webkitGetUserMedia({
    video: {
      mandatory: {
        minWidth: resolution[0],
        minHeight: resolution[1]
      }
    }
  }, function(stream) {
    this.running_ = true;
    this.video_.src = window.URL.createObjectURL(stream);
    this.video_.play();
    var onAnimationFrame = function() {
      this.drawFrame_();
      requestAnimationFrame(onAnimationFrame);
    }.bind(this);
    onAnimationFrame();
    onSuccess(resolution[0], resolution[1]);
  }.bind(this), function(error) {
    onFailure();
  });
};

/**
 * Starts capturing the screen with the highest possible resolution.
 */
camera.Camera.prototype.start = function() {
  var index = 0;
  
  var onSuccess = function(width, height) {
    // If the window dimensions are default (set to HD), and the established
    // camera resolution is different (not HD), then adjust the window size
    // to the camera resolution.
    var windowWidth = document.body.offsetWidth;
    var windowHeight = document.body.offsetHeight;
    if (windowWidth == 1024 && windowHeigth == 768 &&
        width * windowHeight !=  height * windowWidth) {
      chrome.app.window.current().resizeTo(width, height);
    }
    chrome.app.window.current().show();
    // Show tools after some small delay to make it more visible.
    setTimeout(this.setExpanded_.bind(this, true), 500);
  }.bind(this);

  var onFailure = function() {
    chrome.app.window.current().show();
    // TODO(mtomasz): Show an error message.
  };

  var tryNextResolution = function() {
    this.startWithResolution_(camera.Camera.RESOLUTIONS[index],
                              onSuccess,
                              function() {
                                index++;
                                if (index < camera.Camera.RESOLUTIONS.length)
                                  tryNextResolution();
                                else
                                  onFailure();
                              });
  }.bind(this);

  tryNextResolution();
};

camera.Camera.prototype.drawFrame_ = function() {
  if (this.taking_)
    return;

  // Copy the video frame to the back buffer. The back buffer is low resolution,
  // since it is only used by preview windows.
  var context = this.previewInputCanvas_.getContext('2d');
  // context.save();
  // context.scale(-1, 1);
  // context.translate(-this.previewInputCanvas_.width, 0);
  context.drawImage(this.video_,
                    0,
                    0,
                    this.previewInputCanvas_.width,
                    this.previewInputCanvas_.height); 
  // context.restore();

  // Process effect preview canvases.
  if (this.frame_ % 3 == 0 && this.expanded_) {
    for (var index = 0; index < this.previewProcessors_.length; index++) {
      this.previewProcessors_[index].processFrame();
    }
  }
  this.frame_++;

  // Process the full resolution frame. Decrease FPS when expanding for smooth
  // animations.
  if (this.frame_ % 3 == 0 || !this.expandingOrCollapsing_) {
    var mainContext = this.mainCanvas_.getContext('2d');
    this.mainProcessor_.processFrame();
  }
};

/**
 * Creates the Camera object and starts screen capturing.
 */
document.addEventListener('DOMContentLoaded', function() {
  camera.Camera.getInstance().start();
});
