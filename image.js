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
	
	// line spacing 24
	this.append(this.config.LS_SET); 
	this.append('\x18');
		
  switch (options.size) {
		case ImageSize.DOUBLE_WIDTH:
			this.append(this.config.S_RASTER_2W);
			break;
			
		case ImageSize.DOUBLE_HEIGHT:
			this.append(this.config.S_RASTER_2H);
			break;
		
		case ImageSize.QUADRUPLE:
			this.append(this.config.S_RASTER_Q);
			break;
		
		default: // ImageSize.NORMAL
			this.append(this.config.S_RASTER_N);
			break;
	}
	
	var widthLo = String.fromCharCode(this.dots.width & 0xff);
	var widthHi = String.fromCharCode((this.dots.width >> 8) & 0xff);
	
	var offset = 0;
	
	while (offset < this.dots.height) {
		this.append(this.config.BIT_IMAGE_33);
		this.append(widthLo);
		this.append(widthHi);
		
		for (var x = 0; x < this.dots.width; ++x) {
			for (var k = 0; k < 3; ++k) {
				var slice = 0;
				
				for (var b = 0; b < 8; ++b) {
					var y = ((((offset / 8) | 0) + k) * 8) + b
					var i = (y * this.dots.width) + x;
					
					var v = false;
					if (i < this.dots.length) {
						var bit = i - Math.floor(i / 32) * 32;
						v = !!(this.dots.data[i] & (1 << bit));
					}
					
					slice |= (v ? 1 : 0) << (7 - b);
				}
				
				this.append(slice);
			}
		}
		
		offset += 24;
		this.append(this.config.CTL_LF);
	}
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
	
	var length = bitmap.width * bitmap.height;
	var dots = new ArrayBuffer(Math.ceil(length / 32) * 4);
	
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
		length: length,
		width: bitmap.width,
		height: bitmap.height
	};
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
