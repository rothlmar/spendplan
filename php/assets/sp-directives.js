'use strict';

angular.module('spDirectives', ['dropstore-ng', 'ui.bootstrap'])
    .directive(
	'fileChooser', function($timeout) {
	    return {
		template: '<span class="btn btn-default btn-file btn-xs">Upload File<input type="file" /></span>',
		replace: true,
		link: function(scope, element, attrs) {
		    element.on('change', function(event) {
			var file = event.target.files[0];
			var reader = new FileReader();
			reader.onload = (function() {
			    return function(e) {
				var temp_data = angular.element.csv.toArrays(e.target.result);
				var max_num_cols = 0;
				angular.forEach(temp_data, function(val) {
				    if (val.length > max_num_cols) {
					max_num_cols = val.length;
				    };
				});
				scope.newTransactions.data = temp_data;
				scope.newTransactions.cols = [];
				for (var ndx = 0; ndx < max_num_cols; ndx++) {
				    // scope.newTransactions.cols.push(ndx);
				    scope.newTransactions.cols.push('None');
				};
				// don't know why this works, something about making it async.
				$timeout(function () {
				    angular.element('#importModal').modal('show');
				}, 10);
			    }
			})();
			reader.readAsText(file);
		    })
		}
	    }
	})
    .directive(
	'dbChooser', function($http) {
	    return {
		template: '<button class="btn btn-default btn-xs">Upload from Dropbox</button>',
		replace: true,
		link: function(scope, element, attrs) {
		    // console.log(element);
		    element.on('click', function() {
			Dropbox.choose({
			    success: function(files) {
				$http.get(files[0].link)
				    .success(function(data, status, headers, config) {
					var temp_data = angular.element.csv.toArrays(data);
					var max_num_cols = 0;
					angular.forEach(temp_data, function(val) {
					    if (val.length > max_num_cols) {
						max_num_cols = val.length;
					    };
					});
					scope.newTransactions.data = temp_data;
					scope.newTransactions.cols = [];
					for (var ndx = 0; ndx < max_num_cols; ndx++) {
					    scope.newTransactions.cols.push('None');
					};
					angular.element('#importModal').modal('show');
				    });
			    },
			    linkType: "direct"
			});
		    });
		}
		
	    };
	})
    .directive(
	'splitPopover', function() {
	    return {
		scope: true,
		link: function(scope, element, attrs) {
		    var trans=scope.transaction;
		    console.log(trans);
		    var content = '<table class="table table-condensed"><tr><td>' 
			+trans.category + "</td><td>" + trans.amount
			+ '</td></tr>'
			+'<tr><td><input type="text"></td><td><input type="text"> +</td></tr>'
			+ '</table>';
		    // console.log(scope, attrs);
		    element.popover({html: true,
				     content: content});
		}
	    }
	})
