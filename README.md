# brain-test-characters
Thanks for [http://codepen.io/birjolaxew/post/cracking-captchas-with-neural-networks](http://codepen.io/birjolaxew/post/cracking-captchas-with-neural-networks)

# Installing

Make sure you have node, npm and bower installed 

```
git clone https://github.com/changty/brain-test-characters  
cd brain-test-characters   
npm install 
bower install 
```

# Usage

## Train using node 

Include images to be used in **imgs/** folder. You can have one image for each character or have multiple characters in one image, as long as they are in one row.   

Images should be named with following convention:  

```
<character>_running-number.jpg
```

The first character should represent the image. If you have multiple characters in the image, list then all from left to right. For example 

```
ABCDEFGHIJKLMN_series1.jpg
```

Anything after underscore will be completely ignored. The node script searches only for jpg-files, but that can be easily changed. 

Once you have prepared the sample images, you can train the neural network (Brain JS) with following command: 
```
node index.js train
```
Trained network can be found from **output/** as **trained_network_function** and **trained_network_json**

The trained_network_function can be included to any site and run independently. See **trainbrain.js** for example.

If you want to see, what the computer sees with out training, you can run: 
```
node index.js test A_testimage.jpg
```
Test script will save the filtered image to **output/**. 

## Seeing results
You can use the **index.html** and **trainbrain.js** for testing, how ever, you need to have a HTTP-server to serve needed fiels. 

```
npm install -g http-server 
http-server -S -c-1		// start secure server with cache time 1s
```

###Generating the SSL-key
```
openssl req -newkey rsa:2048 -new -nodes -x509 -days 3650 -keyout key.pem -out cert.pem

```
Command above will generate a key that is valid for 10 years. I've included my key/sertificate in the repo.

