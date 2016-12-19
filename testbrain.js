

// INIT

// add test images 0_4, 2_3
// trained with
// $('body').append('<img src="imgs/1_1.jpg" width="50"/>');

// not trained with
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
$('body').append('<img src="imgs/not_trained/1_rotated1.jpg" width="50"/>');

$('body').append('<img src="imgs/not_trained/123456789+-_not_tested10a.jpg" width="50"/>');
$('body').append('<img src="imgs/not_trained/123456789+-_not_tested10b.jpg" width="50"/>');
$('body').append('<img src="imgs/not_trained/123456789+-_not_tested10f.jpg" width="50"/>');
$('body').append('<img src="imgs/1_new2.jpg" width="50"/>');
$('body').append('<img src="imgs/raw/testi1.jpg" width="50"/>');
$('body').append('<img src="imgs/raw/testi2.jpg" width="50"/>');




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


  