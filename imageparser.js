(function(exports) {

    var Canvas = require('canvas-browserify');
    var Image = Canvas.Image;
    var ImageData = Canvas.ImageData;

    var StackBlur = require('stackblur-canvas');

    exports.parse = function(image, opts) {
        var defaults = {
            downscaledSize: 24,
            // a canvas element
            debug: false,
            blur: 2,
            brightness: 45,
            contrast: 85,
            chars: 0, 
        }

        var options = {};

        // merge defaults into options
        for (var k in defaults) {
            options[k] = opts[k] || defaults[k];
        }

        // if((image instanceof Image) || (image instanceof HTMLImageElement)) {
        //     var img = image; 
        // }
        // else {
            var img = new Image(); 
            img.src = image; 
        // } 

        // Get imageData
        c = new Canvas(img.width, img.height);
        ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0);
        var imageData = ctx.getImageData(0,0, c.width,c.height);

        // blur, greyscale, brightness/contrast, getTreshold, treshold, extract, downscale, forBrain
        imageData =  StackBlur.imageDataRGB(imageData, 0, 0, c.width, c.height, options.blur);
        imageData = greyscale(imageData);
        imageData = brightnessContrast(imageData, options.brightness, options.contrast);
       
        options.threshold = calculateThreshold(imageData); 

        imageData = thresholder(imageData, options.threshold);
        imageData = extract(imageData, options.chars); // returns an array; 

        if(options.debug) {
            updateDebugCanvas(imageData); 
        }

        imageData = downscale(imageData, options.downscaledSize); // returns an array

        var forBrain = imageData.map(function(imgData) {
            return formatForBrain(imgData) 
        });

        return forBrain; 


        // Image processing functions
        // greyscale
        function greyscale(imageData)  {
          var px = imageData.data;

          var len = px.length;

          for (var i = 0; i < len; i+=4) {
              var redPx = px[i];
              var greenPx = px[i+1];
              var bluePx = px[i+2];
              var alphaPx = px[i+3];

              var greyScale = redPx * .3 + greenPx * .59 + bluePx * .11;

              px[i] = greyScale;
              px[i+1] = greyScale;
              px[i+2] = greyScale;
          }

          return imageData;
        }

        // calculate threshold
        function calculateThreshold(imgData) {
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

          var brightness = Math.floor(colorSum / (imgData.width*imgData.height));
          console.log("Brightness", brightness);
          if(brightness > 105) { // was 150
            brightness = brightness/1.2;
          }
          if(brightness <= 105) {
            brightness = brightness/1.5; 
          }
          if(brightness < 70) {
            birghtness = brightness/2;
          }

          return brightness;
        }

        //brightness effect
        // imageData, brightness [0-100], contrast [0-100]
        function brightnessContrast(imageData, b, c) {
            var data = imageData;//get pixel data
            var pixels = data.data;
            for(var i = 0; i < pixels.length; i+=4){//loop through all data
                /*
                pixels[i] is the red component
                pixels[i+1] is the green component
                pixels[i+2] is the blue component
                pixels[i+3] is the alpha component
                */
                pixels[i] += b;
                pixels[i+1] += b;
                pixels[i+2] += b;

                var brightness = (pixels[i]+pixels[i+1]+pixels[i+2])/3; //get the brightness

                pixels[i] += brightness > 127 ? c : -c;
                pixels[i+1] += brightness > 127 ? c : -c;
                pixels[i+2] += brightness > 127 ? c : -c;
             }
            data.data = pixels;

            return data; 
        }

        // Image reading
        function thresholder(imgData, threshold) {
            // for every pixels red channel value
            for (var i = 0, j = imgData.data.length; i<j; i+=4) {
                // threshold it
                if (imgData.data[i] > threshold) {
                    imgData.data[i] = 0;
                } else {
                    imgData.data[i] = 255;
                }
            }

            return imgData;
        }

       function extract(imgData, chars) {

            // For easy cropping
            var c = new Canvas(img.width, img.height);
            var ctx = this.c.getContext("2d");
            ctx.putImageData(imgData, 0, 0);
            var letters = [];

            var letterRaw = []; 
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
                    if (pixelsInLetter > 200) {
                            letters.push(ctx.getImageData(
                            currentLetter.minX,
                            currentLetter.minY,
                            currentLetter.maxX - currentLetter.minX,
                            currentLetter.maxY - currentLetter.minY
                         ));

                        letterRaw.push(currentLetter);
                    }      

                    // reset
                    foundLetter = foundLetterInColumn = false;
                    currentLetter = {};
                    pixelsInLetter = 0; 

                }

            }

            if(letters.length > 0) {
                if(chars && chars === 1) {
                    var maxX = -1; 
                    var maxY = -1; 
                    var minX = Infinity; 
                    var minY = Infinity; 

                    for(var i=0; i<letterRaw.length; i++) {
                        var l = letterRaw[i]; 

                        if(l.minX < minX) {
                            minX = l.minX; 
                        }

                        if(l.minY < minY) {
                            minY = l.minY; 
                        }

                        if(l.maxX > maxX) {
                            maxX = l.maxX; 
                        }

                        if(l.maxY > maxY) {
                            maxY = l.maxY; 
                        }
                    }

                    letters = []; 
                    letters.push(ctx.getImageData(minX, minY, maxX-minX, maxY-minY));
                }
            }

            return letters;
        }


       function downscale(imgDatas, size){
            if(Array.isArray(imgDatas) && imgDatas.length === 0) {
                return [];
            }
            
            if(!imgDatas.length) {
                imgDatas = [imgDatas];
            }
            
            var letters = [];
            for (var i = 0, j = imgDatas.length; i < j; ++i) {
                var s = size,
                imgData = imgDatas[i],
                square = ctx.createImageData(s,s);
                // square = new ImöageData(s, s);

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
        }


        function formatForBrain(imgData) {
            var outp = [];
            for (var i = 0, j = imgData.data.length; i < j; i+=4) {
                outp[i/4] = imgData.data[i] / 255;
            }
            return outp;
        }

        function updateDebugCanvas(imageData) {
            var canvas = document.getElementById(options.debug); 
            var context = canvas.getContext('2d'); 

            var maxW = -1;
            var maxH = -1 ;
            for(var i=0; i<imageData.length; i++) {
                maxW += imageData[i].width;
        
                if(imageData[i].height > maxH) {
                    maxH = imageData[i].height;
                }
            }
            if(maxW > 0 && maxH > 0) {
                canvas.width = maxW 
                canvas.height = maxH;
                for(var i=0; i<imageData.length; i++) {
                    context.putImageData(imageData[i], 0,0);
                }
            }

        }


    }

}(typeof exports === 'undefined' ? this.parseImage = {} : exports));