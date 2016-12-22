var Image = Canvas.Image;
var fs = require('fs');
var ImageParser = require('./imageparser.js');
console.log("parser", ImageParser);

function parseFileName(file) {
	var dash = file.indexOf('_'); 
	return file.substring(0, dash); 
}

function test(allowed) {
	// const testFolder = './imgs/not_trained/'; 
	const testFolder = './imgs/';
	var testedCharacters = 0; 
	var errors = 0; 
	var corrects = 0; 
	var fileCount = 0;; 

	fs.readdir(testFolder, (err, files) => {
		if(err) throw err; 

		// count jpgs 
		for(var i=0; i<files.length; i++) {
			if(files[i].indexOf('.jpg') !== -1 || files[i].indexOf('.png') !== -1) {
				fileCount++;
			}
		}

		files.forEach(file => {
			// if training has restrictions
			if(allowed) {
				var ans = parseFileName(file).split(""); 
				var isAllowed = true;
				for(var i=0;i<ans.length;i++) {
					if(allowed.indexOf(ans[i]) === -1) {
						isAllowed = false; 
						fileCount--;
						break; 
					}
				}
				if(!isAllowed) {
					return;
				}
			}

			fs.readFile(testFolder + file, function(err, data) {
				if(file.indexOf('.jpg') === -1 && file.indexOf('.png') === -1) return; 

				console.log("Testing with...", file);
				if(err) throw err;

				var img = new Image(); 
				img.src = data; 

				// var answer = parseFileName(file).split("");
				var answer = parseFileName(file);

				var d = new ImageParser(img, {debug: true, name: file, downscaledSize: 16, blur: 2, chars: 1});
				// console.log(d);
				var tested = guessImageDatas(d);
				testedCharacters += tested.length; 



				if(answer != tested[0]) {
					errors++;
					console.log("Guess:", tested[0], "\t\t correct: ", answer[0]);
				}
				else {
					corrects++;
				}

				// for(var i=0; i<answer.length; i++) {
				// 	if(answer[i] != tested[i]) {
				// 		errors++;
				// 		console.log("Guess:", tested[i], "\t\t correct: ", answer[i]);
				// 	}
				// 	else {
				// 		corrects++; 
				// 	}
				// }

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

function train(allowed) {
	const inputFolder = './imgs/';
	var fileCount = 0; 
	var trainingData = [];
	var testedChars = {}
	fs.readdir(inputFolder, (err, files) => {
		if(err) throw err; 

		// count jpgs 
		for(var i=0; i<files.length; i++) {
			if(files[i].indexOf('.jpg') !== -1 || files[i].indexOf('.png') !== -1) {
				fileCount++;
			}
		}
	

		files.forEach(file => {
			// if training has restrictions
			if(allowed) {
				var ans = parseFileName(file).split(""); 
				var isAllowed = true;
				for(var i=0;i<ans.length;i++) {
					if(allowed.indexOf(ans[i]) === -1) {
						isAllowed = false; 
						fileCount--;
						break; 
					}
				}
				if(!isAllowed) {
					return;
				}
			}


			// console.log(file);
			fs.readFile(inputFolder + file, function(err, data) {
				if(file.indexOf('.jpg') === -1 && file.indexOf('.png') === -1) return; 

				console.log("loading...", file);
				if(err) throw err;

				var img = new Image(); 
				img.src = data; 

				var d = new ImageParser(img, {debug: false, name: file, downscaledSize: 24, blur: 2, chars: 1});
				var answer = parseFileName(file);

				var onlyOneChar = true; 

				// split into array of letterImg/letterString objects
				var outp = d.map(function(imgData,index){

				    // `output` property must be an object
				    var outputObj = {};

				    if(onlyOneChar) {
				    	outputObj[answer] = 1;				    	
				    }
				    else {
				    	outputObj[answer.substring(index, index+1)] = 1;				    	
				    }

				    console.log(outputObj);

				    if(!testedChars[answer]){
				    	testedChars[answer] = 1; 
				    }
				 
				    testedChars[answer]++;
				    

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
					      errorThresh: 0.000001,  // error threshold to reach 0.0001
					      iterations: 25000,
					      learningRate: 0.02,   // maximum training iterations
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
	if(process.argv[3]) {
		var allowed = process.argv[3]; 
		train(allowed);
	} 
	else {
		train(); 
	}
}

if(process.argv[2] == 'test') {
	if(process.argv[3]) {
		var allowed = process.argv[3]; 
		test(allowed);
	} 
	else {
		test(); 
	}
}

if(process.argv[2] == 'help' || process.argv[2] == '-h' || process.argv[2] == '--help') {
	console.log("For training: \t node index.js train");
	console.log("-------------------------------------");
	console.log("For testing: \t node index.js test <filename>" );
	console.log("File name should be a file in ./imgs/");
	console.log("-------------------------------------");

} 