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
    }).filter('spHighest', function() {
	return function(input) {
	    var ret_obj = {};
	    angular.forEach(input, function(val,key) {
		if (val > 500) {
		    ret_obj[key] = val;
		}
	    });
	    return ret_obj;
	}
    });
