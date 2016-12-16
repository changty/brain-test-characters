var brain = require('brain');
var Canvas = require('canvas');
var Image = Canvas.Image;
var ImageData = Canvas.ImageData;

var StackBlur = require('stackblur-canvas');

var fs = require('fs');

function ImageParser(img, options) {
	var self = this;

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

	this.calculateThreshold(this.ctx.getImageData(0,0,this.c.width,this.c.height));

	var blurred = StackBlur.imageDataRGB(this.ctx.getImageData(0,0,this.c.width,this.c.height), 0, 0, img.width, img.height, 2);
	blurred = this.ctx.getImageData(0,0,this.c.width,this.c.height);
	var threshold = this.thresholder(blurred);	

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
		for(var i=0; i<downscale.length; i++) {
			this.tempCtx.putImageData(downscale[i], i*24,0);
		}

		out = fs.createWriteStream(__dirname + '/output/' + this.opts.name + '.png');

		stream = this.tempCanvas.pngStream();
		stream.on('data', function(chunk){
			out.write(chunk);
		});
	}

	// console.log("downscale", downscale);
	var forBrain = downscale.map(function(imgData){ return self.formatForBrain(imgData) });
	return forBrain; 
	// console.log("forBrain", forBrain);
}

ImageParser.prototype.defaults = {
  threshold: 150,
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

ImageParser.prototype.formatForBrain = function FormatForBrain(imgData) {
	var outp = [];
	for (var i = 0, j = imgData.data.length; i < j; i+=4) {
		outp[i/4] = imgData.data[i] / 255;
	}
	return outp;
}



function parseFileName(file) {
	var dash = file.indexOf('_'); 
	return file.substring(0, dash); 
}

function test() {
	const testFolder = './imgs/not_trained/'; 
	var testedCharacters = 0; 
	var errors = 0; 
	var corrects = 0; 
	var fileCount = 0;; 

	fs.readdir(testFolder, (err, files) => {
		if(err) throw err; 

		// count jpgs 
		for(var i=0; i<files.length; i++) {
			if(files[i].indexOf('.jpg') !== -1) {
				fileCount++;
			}
		}

		files.forEach(file => {
			fs.readFile(testFolder + file, function(err, data) {
				if(file.indexOf('.jpg') === -1) return; 

				console.log("Testing with...", file);
				if(err) throw err;

				var img = new Image(); 
				img.src = data; 

				var answer = parseFileName(file).split("");

				var d = new ImageParser(img, {debug: true});
				// console.log(d);
				var tested = guessImageDatas(d);
				testedCharacters += tested.length; 

				for(var i=0; i<answer.length; i++) {
					if(answer[i] != tested[i]) {
						errors++;
					}
					else {
						corrects++; 
					}
				}

				fileCount--; 

				if(fileCount === 0) {
					console.log("\n=========================");
					console.log("Testing done!");
					console.log("=========================\n");
					console.log("Characters:\t", testedCharacters);
					console.log("Correct:\t", corrects);
					console.log("Errors:\t\t", errors);
					console.log("Error rate:\t", (errors/testedCharacters), "\n");
					console.log("=========================\n");
				}
			});


		});
	});


}

function train() {
	const inputFolder = './imgs/';
	var fileCount = 0; 
	var trainingData = [];
	var testedChars = {}
	fs.readdir(inputFolder, (err, files) => {
		if(err) throw err; 

		// count jpgs 
		for(var i=0; i<files.length; i++) {
			if(files[i].indexOf('.jpg') !== -1) {
				fileCount++;
			}
		}
		
		files.forEach(file => {
			// console.log(file);
			fs.readFile(inputFolder + file, function(err, data) {
				if(file.indexOf('.jpg') === -1) return; 

				console.log("loading...", file);
				if(err) throw err;

				var img = new Image(); 
				img.src = data; 

				var d = new ImageParser(img, {debug: false, name: file});

				var answer = parseFileName(file);

				// split into array of letterImg/letterString objects
				var outp = d.map(function(imgData,index){

				    // `output` property must be an object
				    var outputObj = {};

					outputObj[answer.substring(index, index+1)] = 1;				    	
				    
				    console.log(outputObj);

				    if(!testedChars[answer.substring(index, index+1)]){
				    	testedChars[answer.substring(index, index+1)] = 1; 
				    }
				 
				    testedChars[answer.substring(index, index+1)]++;
				    

			      return {
				          input: d[index],
				        output: outputObj
				    }
				});

				// console.log(outp);

				// add image+answer to training data
				trainingData = trainingData.concat(outp);
				
				// if(fileCount > 25) {
				// 	console.log(trainingData);
				// }
				fileCount--; 

				// All files handled
				if(fileCount === 0) {
					console.log("\n=========================================");
					console.log("Files loaded, starting training!");
					console.log("=========================================\n");
					console.log("Characters:\n", testedChars);
					console.log("=========================================\n");


					var net = new brain.NeuralNetwork({hiddenLayers: [128, 128]});
					  net.train(trainingData, {
					      errorThresh: 0.0005,  // error threshold to reach 0.0001
					      iterations: 2000,
					      learningRate: 0.3,   // maximum training iterations
					      log: true,           // console.log() progress periodically
					      logPeriod: 10       // number of iterations between logging
					  });

					var run = net.toFunction(); 

					fs.writeFile('./output/trained_network_json', JSON.stringify(net.toJSON()), function(err){
						if(err) {
							return console.log(err); 
						}

						console.log("trained network saved");
					});
					fs.writeFile('./output/trained_network_function', run.toString(), function(err){
						if(err) {
							return console.log(err); 
						}

						console.log("trained network saved");
					});
				}
			});
		
		});
	});
}


function guessImageDatas(imgDatas){

	var json = fs.readFileSync('./output/trained_network_json').toString();
	json = JSON.parse(json); 

	var net = new brain.NeuralNetwork();
	// load brain
	net.fromJSON(json);

  var outp = [];
  for (var i = 0; i < imgDatas.length; ++i) {
    var guess = net.run(imgDatas[i]);
    
    //find most likely guess
    var max = {txt: "", val: 0};
    for (var k in guess) {
      if (guess[k] > max.val) {
        max = {txt: k, val: guess[k]};
      }
    }
    
    outp.push(max.txt);
  	console.log(max.txt, max.val);
  }
  
  return outp;
}


if(process.argv[2] == 'train') {
	console.log("Training brains from imgs-folder"); 
	train(); 
}

if(process.argv[2] == 'test') {
	// if(!process.argv[3]) {
	// 	console.log("File name missing. Give me a file name from ./imgs/");
	// }
	// else {
	// 	test(process.argv[3]); 
	// }

	test();
}

if(process.argv[2] == 'help' || process.argv[2] == '-h' || process.argv[2] == '--help') {
	console.log("For training: \t node index.js train");
	console.log("-------------------------------------");
	console.log("For testing: \t node index.js test <filename>" );
	console.log("File name should be a file in ./imgs/");
	console.log("-------------------------------------");

} 