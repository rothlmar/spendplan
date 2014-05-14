'use strict';

angular.module('spFilters', [])
    .filter('empty', function() {
	return function(input) {
	    if (input != '') {
		return input;
	    } else {
		return "Uncategorized";
	    }
	};
    })
    .filter('dictVal', function() {
	return function(input, compareFunc, compareObj) {
	    var ret_arr = new Array;
	    for (var i in input) {
		if (compareFunc(input[i],compareObj)) {
		    ret_arr.push(input[i]);
		}
	    };
	    return ret_arr;
	}
    });
