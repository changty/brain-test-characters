function guessImageDatas(imgDatas){
  var outp = [];
  var minConfidence = 2; 
  for (var i = 0; i < imgDatas.length; ++i) {
    var guess = anonymous(imgDatas[i]);
    
    //find most likely guess
    var max = {txt: "", val: 0};
    for (var k in guess) {
      if (guess[k] > max.val) {
        max = {txt: k, val: guess[k]};
      }
      if(guess[k]<minConfidence) {
        minConfidence = guess[k];
      }
    }
    
    outp.push(max.txt);
    // console.log("most confident: ", max.txt, max.val);
  }
}

function ImageParser(img, options) {
  var self = this;

  $('.temp').remove();
  // merge defaults into options
  for (var k in this.defaults) {
    options[k] = options[k] || this.defaults[k];
  }
  this.opts = options;
  // create canvas for processing
  this.c = document.createElement("canvas");
  this.ctx = this.c.getContext("2d");
  this.c.width = img.naturalWidth;
  this.c.height= img.naturalHeight;
  this.ctx.drawImage(img, 0,0);

  this.tempCanvas = $('<canvas class="temp"></canvas>');
  this.tempCanvas[0].width = img.naturalWidth; 
  this.tempCanvas[0].height = img.naturalHeight
  this.tempCtx = this.tempCanvas[0].getContext('2d'); 
  this.tempCtx.drawImage(img, 0,0);

  $('body').append(this.tempCanvas);

  this.calculateThreshold(this.ctx.getImageData(0,0,this.c.width,this.c.height));

  var blurred = StackBlur.imageDataRGB(this.ctx.getImageData(0,0,this.c.width,this.c.height), 0, 0, this.c.width, this.c.height, this.opts.blur);

  var threshold = this.thresholder(blurred);  
  this.tempCtx.putImageData(threshold, 0,0);

  // console.log("treshold", threshold);
  var extract = this.extract(threshold);
  for(var i=0; i<extract.length; i++) {
    this.tempCtx.putImageData(extract[0], 0,0);
  }

  // console.log("extract", extract);
  var downscale = this.downscale(extract); 
  for(var i=0; i<downscale.length; i++) {
    this.tempCtx.putImageData(downscale[i], i*24,0);
  }


  // console.log("downscale", downscale);
  var forBrain = downscale.map(function(imgData){ return self.formatForBrain(imgData) });

  return forBrain; 
  // console.log("forBrain", forBrain);
}

ImageParser.prototype.defaults = {
  threshold: 60,
  downscaledSize: 24,
  debug: false,
  blur: 2,
};

ImageParser.prototype.calculateThreshold = function CalculateThreshold(imgData) {
  var self = this; 

  var data = imgData.data;
  var r,g,b,avg;
  var colorSum = 0;

  for(var x = 0, len = data.length; x < len; x+=4) {
      r = data[x];
      g = data[x+1];
      b = data[x+2];

      avg = Math.floor((r+g+b)/3);
      colorSum += avg;
  }

  var brightness = Math.floor(colorSum / (self.c.width*self.c.height));
  console.log("Brightness", brightness);
  if(brightness > 150) {
    brightness = brightness/1.2;
  }
  if(brightness < 105) {
    brightness = brightness/1.5; 
  }
  if(brightness < 70) {
    birghtness = brightness/2;
  }
  this.opts.threshold = brightness; 
  console.log("threshold: ", this.opts.threshold);

}


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
  var pixelsInLetter = 0; 

  for (var x = 0, j = imgData.width; x < j; ++x) { // for every column
    var foundLetterInColumn = false;
    
    for (var y = 0, k = imgData.height; y < k; ++y) { // for every pixel
      var pixIndex = (y*imgData.width+x)*4;
      if (imgData.data[pixIndex] === 255) { // if we're dealing with a letter pixel
        foundLetterInColumn = foundLetter = true;
      pixelsInLetter++; 
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
      // if(currentLetter.maxX-currentLetter.minX > 0 && currentLetter.maxY-currentLetter.minY > 0) {
        // console.log("pixels in letter", pixelsInLetter);
        if (pixelsInLetter > 70) {
        letters.push(this.ctx.getImageData(
          currentLetter.minX,
          currentLetter.minY,
          currentLetter.maxX - currentLetter.minX,
          currentLetter.maxY - currentLetter.minY
        ));
      }      

      
      // reset
      foundLetter = foundLetterInColumn = false;
      currentLetter = {};
      pixelsInLetter = 0; 
    }
    else {

    }
  }
  
  return letters;
};

ImageParser.prototype.formatForBrain = function FormatForBrain(imgData){
  var outp = [];
  for (var i = 0, j = imgData.data.length; i < j; i+=4) {
    outp[i/4] = imgData.data[i] / 255;
  }
  return outp;
}

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