jQuery( function($){


    $.each([1,2,3], function(i, v){
        var $$ = $('.settings-banner img.layer-' + v);
        var opacity = $$.css('opacity');

        setTimeout( function(){
            $$.show()
                .css({'margin-top' : -5, 'opacity': 0})
                .animate({'margin-top' : 0, 'opacity': opacity}, 280 + 40*(4 - v) );
        }, 150 + 225 * (4 - v) );
    });

} );