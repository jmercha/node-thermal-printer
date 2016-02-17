var fs = require('fs');
var bmp = require('bmp-js');

var ImageSize = {
	NORMAL: 0,
	DOUBLE_WIDTH: 1,
	DOUBLE_HEIGHT: 2,
	QUADRUPLE: 3
};

/**
 * Represents a thermal printer image
 * @constructor
 */
var Image = function(dots, config, append) { 
	this.dots = dots; 
	this.config = config;
	this.append = append;
};

/**
 * Append the image to the output
 */
Image.prototype.print = function(options) {
	
	this.appendLineSpacing();
	this.appendSize(options.size);
	
	var offset = 0;
	
	var cmd = this.dots.height <= 8 ? this.config.BIT_IMAGE_1 : this.config.BIT_IMAGE_33;
	var widthLo = String.fromCharCode(this.dots.width & 0xff);
	var widthHi = String.fromCharCode((this.dots.width >> 8) & 0xff);
	
	while (offset < this.dots.height) {
		this.append(cmd);
		this.append(widthLo);
		this.append(widthHi);
	}
};

Image.prototype.appendLineSpacing = function() {
	this.append(this.config.LS_SET);
	this.append('\x18'); // 24
};

/**
 * Append image size to the output
 */
Image.prototype.appendSize = function(size) {
	switch (size) {
		case ImageSize.DOUBLE_WIDTH:
			this.append(this.config.S_RASTER_2W);
			break;
			
		case ImageSize.DOUBLE_HEIGHT:
			this.append(this.config.S_RASTER_2H);
			break;
		
		case ImageSize.QUADRUPLE:
			this.append(this.config.S_RASTER_Q);
			break;
		
		default: // normal
			this.append(this.config.S_RASTER_N);
			break;
	}
}

/**
 * Convert bmp-js bitmap to dot matrix
 */
function getDots(bitmap, threshold) {
	threshold = threshold || 127;
	
	var dots = new ArrayBuffer(Math.ceil((bitmap.width * bitmap.height) / 32) * 4);
	
	var i = 0;
	for (var iy = 0; iy < bitmap.height; ++iy) {
		for (var ix = 0; ix < bitmap.width; ++ix) {
				var pixel = bitmap.data[(bitmap.width * iy + ix) << 2];
				var r = pixel >> 16 & 0xff;
				var g = pixel >> 8 & 0xff;
				var b = pixel & 0xff;
				var lumi = (r * 0.3 + g * 0.59 + b * 0.11) | 0;
				
				if (lumi > threshold) {
					var offset = Math.floor(i / 32);
					var bit = i - offset * 32;
					dots[offset] |= (1 << bit);
				}
				++i;
			}
   }
	
	return { 
		data: new Uint32Array(dots), 
		width: bitmap.width,
		height: bitmap.height
	};
}

function getDot(i, data) {
	var offset = Math.floor(i / 32);
	var bit = i - offset * 32;
	return !!(data[i] & (1 << bit));
}

function loadBitmap(file, cb) {
	fs.readFile(file, function(err, buffer) {
		if (err) {
			cb(err);
			return;
		}
		try {
			cb(null, bmp.decode(buffer));	
		} catch (err) {
			cb(err);
		}
	});
}

function load(options, cb) {
	loadBitmap(options.image, function(err, bitmap) {
		if (err) {
			cb(err);
			return;
		}
		cb(null, new Image(getDots(bitmap, options.threshold), options.config, options.append));
	});
}

module.exports = {
		load: load,
		ImageSize: ImageSize
};
