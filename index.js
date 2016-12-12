var brain = require('brain');
var Canvas = require('canvas');
var Image = Canvas.Image;
var ImageData = Canvas.ImageData;
var fs = require('fs');

function ImageParser(img, options) {
	// merge defaults into options
	for (var k in this.defaults) {
	  options[k] = options[k] || this.defaults[k];
	}
	this.opts = options;
	// create canvas for processing
	this.c = new Canvas(img.width, img.height);
	this.ctx = this.c.getContext("2d");
	this.ctx.drawImage(img, 0, 0);
	// this.c.width = img.naturalWidth;
	// this.c.height= img.naturalHeight;

	this.tempCanvas = new Canvas(img.width, img.height);
	this.tempCtx = this.tempCanvas.getContext('2d'); 

	var out;
	var stream;

	var threshold = this.thresholder(this.ctx.getImageData(0,0,this.c.width,this.c.height));	

	if(this.opts.debug) {
		this.tempCtx.putImageData(threshold, 0,0);
	}

	// console.log("treshold", threshold);
	var extract = this.extract(threshold);

	if(this.opts.debug) {
		this.tempCtx.putImageData(extract[0], 0,0);
	}

	// console.log("extract", extract);
	var downscale = this.downscale(extract); 

	if(this.opts.debug) {
		this.tempCtx.putImageData(downscale[0], 0,0);

		out = fs.createWriteStream(__dirname + '/output/output.png');

		stream = this.tempCanvas.pngStream();
		stream.on('data', function(chunk){
			out.write(chunk);
		});
	}

	// console.log("downscale", downscale);
	var forBrain = this.formatForBrain(downscale);
	// console.log("forBrain", forBrain);
}

ImageParser.prototype.defaults = {
  threshold: 60,
  downscaledSize: 16,
  debug: false,
};

// Image functions
ImageParser.prototype.thresholder = function Threshold(imgData){
  // for every pixels red channel value
  for (var i = 0, j = imgData.data.length; i<j; i+=4) {
    // threshold it
    if (imgData.data[i] > this.opts.threshold) {
      imgData.data[i] = 0;
    } else {
      imgData.data[i] = 255;
    }
  }

  return imgData;
};

ImageParser.prototype.extract = function ExtractLetters(imgData){
  this.ctx.putImageData(imgData,0,0); // for easy cropping
  var letters = [];
  
  var currentLetter = {};
  var foundLetter = false;
  var notLetter =0; 
  for (var x = 0, j = imgData.width; x < j; ++x) { // for every column
    var foundLetterInColumn = false;
    
    for (var y = 0, k = imgData.height; y < k; ++y) { // for every pixel
      var pixIndex = (y*imgData.width+x)*4;
      if (imgData.data[pixIndex] === 255) { // if we're dealing with a letter pixel
        foundLetterInColumn = foundLetter = true;
        // set data for this letter
        currentLetter.minX = Math.min(x, currentLetter.minX || Infinity);
        currentLetter.maxX = Math.max(x, currentLetter.maxX || -1);
        currentLetter.minY = Math.min(y, currentLetter.minY || Infinity);
        currentLetter.maxY = Math.max(y, currentLetter.maxY || -1);
      }

    }

    // if we've reached the end of this letter, push it to letters array
    if (!foundLetterInColumn && foundLetter) {
      // get letter pixels
      letters.push(this.ctx.getImageData(
        currentLetter.minX,
        currentLetter.minY,
        currentLetter.maxX - currentLetter.minX,
        currentLetter.maxY - currentLetter.minY
      ));
      
      // reset
      foundLetter = foundLetterInColumn = false;
      currentLetter = {};
    }
    else {
      console.log("letter not found");
    }
  }
  
  return letters;
};

ImageParser.prototype.downscale = function Downscale(imgDatas){
  if(Array.isArray(imgDatas) && imgDatas.length === 0) {
    return [];
  }
  if(!imgDatas.length) {
    imgDatas = [imgDatas];
  }
  var letters = [];
  for (var i = 0, j = imgDatas.length; i < j; ++i) {
    var s = this.opts.downscaledSize,
        imgData = imgDatas[i],
        square = new ImageData(s,s);
    // loop through every pixel in our small square
    for (var x = 0; x < s; ++x) {
      for (var y = 0; y < s; ++y) {
        // find index in large imgData
        var bigX = Math.floor(x/s * imgData.width),
            bigY = Math.floor(y/s * imgData.height),
            bigIndex = (bigY*imgData.width+bigX)*4,
            index = (y*s+x)*4;
        // set pixel in square to pixel in image data
        square.data[index] = imgData.data[bigIndex];
        // set alpha too, for display purposes
        square.data[index+3] = 255;
      }
    }
    
    letters.push(square);
  }
  
  return letters;
};

ImageParser.prototype.formatForBrain = function FormatForBrain(imgData){
	// console.log("format", imgData);
	var imgData = imgData[0];
  var outp = [];
  for (var i = 0, j = imgData.data.length; i < j; i+=4) {
    outp[i/4] = imgData.data[i] / 255;
  }
  return outp;
}

fs.readFile(__dirname+'/imgs/2.jpg', function(err, data) {
	if(err) throw err; 
	var img = new Image(); 
	img.src = data; 

	var d = new ImageParser(img, {debug: true});
});