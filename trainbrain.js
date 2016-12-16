
function guessImageDatas(imgDatas){
  var outp = [];
  for (var i = 0; i < imgDatas.length; ++i) {
    var guess = anonymous(imgDatas[i]);
    
    //find most likely guess
    var max = {txt: "", val: 0};
    for (var k in guess) {
      if (guess[k] > max.val) {
        max = {txt: k, val: guess[k]};
      }
    }
    
    outp.push(max.txt);
    console.log("most confident: ", max.txt, max.val);
  }
  
  return outp;
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

  var blurred = StackBlur.imageDataRGB(this.ctx.getImageData(0,0,this.c.width,this.c.height), 0, 0, this.c.width, this.c.height, 5);

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

// INIT

// add test images 0_4, 2_3
// trained with
$('body').append('<img src="imgs/1_1.jpg" width="50"/>');

// not trained with
// $('body').append('<img src="imgs/0_testi1.jpg" width="50"/>');
// $('body').append('<img src="imgs/1_testi1.jpg" width="50"/>');
// $('body').append('<img src="imgs/2_testi1.jpg" width="50"/>');
// $('body').append('<img src="imgs/3_testi1.jpg" width="50"/>');
// $('body').append('<img src="imgs/4_testi1.jpg" width="50"/>');
// $('body').append('<img src="imgs/5_testi1.jpg" width="50"/>');
// $('body').append('<img src="imgs/7_testi1.jpg" width="50"/>');
// $('body').append('<img src="imgs/8_testi1.jpg" width="50"/>');
// $('body').append('<img src="imgs/10_testi1.jpg" width="50"/>');
// $('body').append('<img src="imgs/9_testi1.jpg" width="50"/>');

// $('body').append('<img src="imgs/0_testi2.jpg" width="50"/>');
// $('body').append('<img src="imgs/1_testi2.jpg" width="50"/>');
// $('body').append('<img src="imgs/2_testi2.jpg" width="50"/>');
// $('body').append('<img src="imgs/3_testi2.jpg" width="50"/>');
// $('body').append('<img src="imgs/4_testi2.jpg" width="50"/>');
// $('body').append('<img src="imgs/5_testi2.jpg" width="50"/>');
// $('body').append('<img src="imgs/7_testi2.jpg" width="50"/>');
// $('body').append('<img src="imgs/8_testi2.jpg" width="50"/>');
// $('body').append('<img src="imgs/10_testi2.jpg" width="50"/>');
// $('body').append('<img src="imgs/9_testi2.jpg" width="50"/>');

// $('body').append('<img src="imgs/1_testi3.jpg" width="50"/>');
// $('body').append('<img src="imgs/1_testi4.jpg" width="50"/>');

// $('body').append('<img src="imgs/9_7.jpg" width="50"/>');
// $('body').append('<img src="imgs/1_14.jpg" width="50"/>');
// $('body').append('<img src="imgs/0_7.jpg" width="50"/>');

// $('body').append('<img src="imgs/t_testi1.jpg" width="50"/>');
// $('body').append('<img src="imgs/r_testi1.jpg" width="50"/>');
// $('body').append('<img src="imgs/7_testi7.jpg" width="50"/>');
// $('body').append('<img src="imgs/+_testi1.jpg" width="50"/>');
// $('body').append('<img src="imgs/ö_testi1.jpg" width="50"/>');
// $('body').append('<img src="imgs/b_testi1.jpg" width="50"/>');
// $('body').append('<img src="imgs/a_testi1.jpg" width="50"/>');
// $('body').append('<img src="imgs/b_testi2.jpg" width="50"/>');
// $('body').append('<img src="imgs/b_testi3.jpg" width="50"/>');

// $('body').append('<img src="imgs/8_testi3.jpg" width="50"/>');
// $('body').append('<img src="imgs/8_testi4.jpg" width="50"/>');
// $('body').append('<img src="imgs/8_testi5.jpg" width="50"/>');

// $('body').append('<img src="imgs/10_4.jpg" width="50"/>');
// $('body').append('<img src="imgs/9_4.jpg" width="50"/>');
// $('body').append('<img src="imgs/7_4.jpg" width="50"/>');
// $('body').append('<img src="imgs/6_3.jpg" width="50"/>');
// $('body').append('<img src="imgs/5_4.jpg" width="50"/>');
// $('body').append('<img src="imgs/0_4.jpg" width="50"/>');
// $('body').append('<img src="imgs/0_3.jpg" width="50"/>');
// $('body').append('<img src="imgs/0_5.jpg" width="50"/>');
// $('body').append('<img src="imgs/2_3.jpg" width="50"/>');
// $('body').append('<img src="imgs/3_4.jpg" width="50"/>');
// $('body').append('<img src="imgs/5_4.jpg" width="50"/>');
// $('body').append('<img src="imgs/4_3.jpg" width="50"/>');

$('body').append('<img src="imgs/discarded/2_3.jpg" width="50"/>');
$('body').append('<img src="imgs/1_font2.jpg" width="50"/>');

$('body').append('<img src="imgs/not_trained/ABCDEFGHIJKLMN_not_tested2.jpg" width="50"/>');
$('body').append('<img src="imgs/not_trained/ABCDEFGHIJKLMN_not_tested3.jpg" width="150"/>');
$('body').append('<img src="imgs/not_trained/ABCDEFGHIJKLMN_not_tested4.jpg" width="150"/>');
$('body').append('<img src="imgs/not_trained/ABCDEFGHIJKLMN_not_tested5.jpg" width="150"/>');


$('body').append('<img src="imgs/not_trained/OPQRSTUVWXYZÖÄÅ_not_tested2.jpg" width="150"/>');
$('body').append('<img src="imgs/not_trained/OPQRSTUVWXYZÖÄÅ_not_tested3.jpg" width="150"/>');
$('body').append('<img src="imgs/not_trained/OPQRSTUVWXYZÖÄÅ_not_tested4.jpg" width="150"/>');
$('body').append('<img src="imgs/not_trained/OPQRSTUVWXYZÖÄÅ_not_tested5.jpg" width="150"/>');


$('body').append('<img src="imgs/not_trained/123456789+-_not_tested3.jpg" width="50"/>');
$('body').append('<img src="imgs/not_trained/123456789+-_not_tested4.jpg" width="50"/>');
$('body').append('<img src="imgs/not_trained/123456789+-_not_tested5.jpg" width="50"/>');

$('body').append('<img src="imgs/not_trained/10_not_tested2.jpg" width="50"/>');
$('body').append('<img src="imgs/not_trained/8_not_tested2.jpg" width="50"/>');




$(document).ready(function(e) {
  var imgs = document.getElementsByTagName("img");
  for (var i = 0; i < imgs.length; ++i) {
    imgs[i].addEventListener("click", function(){
      // console.log(this);

        var data = new ImageParser(this, {debug: false});
        console.log(guessImageDatas(data));

    });
  }


});


  