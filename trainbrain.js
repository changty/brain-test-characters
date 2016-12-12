
function guessImageDatas(imgDatas){
  var outp = [];
  for (var i = 0; i < imgDatas.length; ++i) {
    var guess = run(formatForBrain(imgDatas[i]));
    
    //find most likely guess
    var max = {txt: "", val: 0};
    for (var k in guess) {
      if (guess[k] > max.val) {
        max = {txt: k, val: guess[k]};
      }
    }
    
    outp.push(max.txt);
  }
  
  return outp;
}

function formatForBrain(imgData){
  var outp = [];
  for (var i = 0, j = imgData.data.length; i < j; i+=4) {
    outp[i/4] = imgData.data[i] / 255;
  }
  return outp;
}



// IMAGE PARSER
function ImageParser(img, cb, options){

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
  
  $('body').append(this.c);

  // draw image to canvas
  this.ctx.drawImage(img, 0, 0);
  console.log(this.ctx.getImageData(0,0,this.c.width, this.c.height));

  if(options.callbackEveryStep) { // and show it, if appropriate
    cb({
      title: "Base image",
      data: this.ctx.getImageData(0,0,this.c.width,this.c.height)
    });
  }
  
  // then run it through processing
  var process = [this.thresholder, this.extract, this.downscale];
  // var process = [this.thresholder, this.downscale];
  if (options.callbackEveryStep){ // show after every process, if we should
    process = process.map(function(process){
      // replace process list with proxy functions, that call cb
      return function(data){
        var outp = process.call(this,data),
            obj = {};
        
        // format the data
        if (outp instanceof Array && outp[0] instanceof ImageData) {
          obj.datas = outp;
        }
        if (outp instanceof ImageData) {
          obj.data = outp;
        }
        if (typeof outp === "string") {
          obj.text = outp;
        }
        // extract function name
        obj.title = (process+"").substr("function ".length);
        obj.title = obj.title.substr(0, obj.title.indexOf("("));
        obj.title = obj.title.replace(/([a-z])([A-Z])/g, "$1 $2");
        
        // show
        cb(obj);
        
        return outp;
      };
    });
  }
  
  // actually do the processing
  var that = this;
  var outp = process.reduce(function(prev,process){
    return process.call(that,prev);
  }, this.ctx.getImageData(0,0,this.c.width,this.c.height));
  
  // END ImageParser constructor
  console.log("outp", outp);
  return outp;
}



ImageParser.prototype.defaults = {
  callbackEveryStep: false,
  threshold: 60,
  downscaledSize: 16
};



// Image functions
ImageParser.prototype.thresholder = function Threshold(imgData){
  console.log("threshold", imgData);
  // for every pixels red channel value
  for (var i = 0, j = imgData.data.length; i<j; i+=4) {
    // threshold it
    if (imgData.data[i] > this.opts.threshold) {
      imgData.data[i] = 0;
    } else {
      imgData.data[i] = 255;
    }
  }

  var c = document.createElement("canvas");
  $('body').append(c);
  var ctx = this.c.getContext("2d");
  c.width = imgData.width;
  c.height= imgData.height;
  // draw image to canvas
  ctx.putImageData(imgData, 0, 0);

  return imgData;
};

ImageParser.prototype.extract = function ExtractLetters(imgData){
  console.log("extract", imgData, imgData.height, imgData.width);
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
  
  console.log("letters", letters);
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
    console.log("square", square);
  }
  console.log("downscale:", letters);
  
  return letters;
};

// INIT

// add test images
for(var i=0; i<11; ++i) {
  $('body').append('<img src="imgs/' + i +'.jpg" width="50"/>');
  console.log("Added img "+ i + ".jpg");
}

var imgs = document.getElementsByTagName("img");
for (var i = 0; i < imgs.length; ++i) {
  imgs[i].addEventListener("click", function(){
    // on image click, parse it
    previewer.innerHTML = ""; // but first, empty previewer

    var data = new ImageParser(this, appendToPreviewer,
                                {callbackEveryStep: true});
    
    appendToPreviewer({
      title: "Guess",
      text: "test"
      // text: guessImageDatas(data).join(" ")
    });
  });
}



// UTILS
var previewer = document.getElementsByClassName("previewer")[0];

function appendToPreviewer(obj){
  var preview = document.createElement("div");
  preview.classList.add("preview");
  if (obj.title) {
    var p = document.createElement("p");
    p.textContent = obj.title;
    p.classList.add("title");
    preview.appendChild(p);
  }
  
  // convert image data(s) to base64 URL
  if (obj.data) { obj.datas = [obj.data] }
  if (obj.datas) {
    var c = document.createElement("canvas"),
        ctx = c.getContext("2d");
    
    for (var i = 0; i < obj.datas.length; ++i) {
      c.width = obj.datas[i].width;
      c.height = obj.datas[i].height;
      ctx.putImageData(obj.datas[i], 0, 0);

      var img = document.createElement("img");
      img.src = c.toDataURL("image/png");

      // and show it
      preview.appendChild(img);
    }
  }
  
  if (obj.text) {
    var p = document.createElement("p");
    p.textContent = obj.text;
    preview.appendChild(p);
  }
  
  // finally show the preview
  previewer.appendChild(preview);
}

$(document).ready(function(e){
  var imgs = document.getElementsByTagName("img");

  var trainingData = [];
  for (var i = 1; i < 4; ++i) {
    console.log("img", i, imgs[i]);
      var data = new ImageParser(imgs[i], null, {}); // extract letter images
      var answer = i + ""; // manually entered

      console.log("data", data);
    // format image data
    var formattedData = data.map(function(imgData){ return formatForBrain(imgData) });

    // split into array of letterImg/letterString objects
    var outp = data.map(function(imgData,index){
          // `output` property must be an object
        var outputObj = {};
        outputObj[answer[index]] = 1;

          return {
              input: data[index],
            output: outputObj
        }
    });

    // add image+answer to training data
    trainingData = trainingData.concat(outp);
  }

  console.log("Training data", trainingData);
  // var net = new brain.NeuralNetwork({hiddenLayers: [128,128]});
  // net.train(trainingData, {
  //     errorThresh: 0.02,  // error threshold to reach
  //     iterations: 200,   // maximum training iterations
  //     log: true,           // console.log() progress periodically
  //     logPeriod: 10       // number of iterations between logging
  // });

});

