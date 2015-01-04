'trause strict';

angular.module('spDirectives', [])
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
    }).directive(
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
	}).directive(
	    'catSplits',
	    function() {
		var strHash = function(colStr) {
		    var r = 0,  g = 0, b = 0;
		    // console.log(r,g,b);
		    for (var idx = 0; idx < colStr.length; idx += 3) {
			r = (r + colStr.charCodeAt(idx)) % 60;
			if (!isNaN(colStr.charCodeAt(idx + 1))) {
			    g = (g + colStr.charCodeAt(idx + 1)) % 60;
			}
			if (!isNaN(colStr.charCodeAt(idx + 2))) {
			    b = (b + colStr.charCodeAt(idx + 2)) % 60;
			}
		    };
		    r = Math.ceil(r*3) + 30;
		    g = Math.ceil(g*3) + 30;
		    b = Math.ceil(b*3) + 30;
		    return '#' + r.toString(16) + g.toString(16) + b.toString(16);
		};

		return {
		    scope: {
			monthInfo: '=info',
			reduceTo: '=reduceto',
			plusminus: '@plusminus'
		    },
		    link: function(scope, element, attrs) {
			var takeAction = function(reduceCats) {
			    var total = 0;
			    var subtotal = 0;
			    var progressCats = [];
			    var reducedCats = [];
			    angular.forEach(scope.monthInfo, function(val, cat) {
				if (scope.plusminus == '+') {
				    if (val.plus && cat.toLowerCase() !== 'transfer') {
					progressCats.push([val.plus, cat]);
					total += val.plus;
				    };
				} else {
				    if (val.minus  && cat.toLowerCase() !== 'transfer') {
					progressCats.push([val.minus, cat]);
					total += val.minus;
				    };
				}
			    });
			    progressCats.sort(function(a,b) {
				return b[0] - a[0];
			    });
			    if (reduceCats && reduceCats.length > 0) {
				// console.log("REDUCE CATS: " + JSON.stringify(reduceCats));
			    	angular.forEach(progressCats, function(val, idx) {
			    	    if (reduceCats.indexOf(val[1]) > -1) {
			    		reducedCats.push(val);
					subtotal += val[0];
			    	    };
			    	});
				// console.log("REDUCTIFIED: " + JSON.stringify(reducedCats));
				// console.log("SUBTOTAL: " + subtotal);
			    } else {
			    	reducedCats = progressCats;
			    };
			    var progress = ''
			    angular.forEach(reducedCats, function(cat) {
				var color = strHash(cat[1]);
				var width = ((cat[0]*100)/total).toFixed(4);
				var titleText = cat[1] + ' ($' + Math.round(cat[0]*100)/100 + ')';
				progress += '<div class="progress-bar" style="width: ' + 
				    width + '%; background-color:' + color + '"' + 
				    'data-toggle="tooltip"' +
				    'title="' + titleText + '"' +
				    '></div>';
				// cat[2] = width;
			    });
			    // console.log("TOTAL IS: " + total);
			    if (subtotal) {
				progress += '<div>$' + subtotal.toFixed(2) + '</div>';
			    };
			    element.html(progress);
			    element.children().tooltip();
			};
			takeAction();
			scope.$watchCollection('reduceTo', function() {
			    // console.log("reduce categories: " + JSON.stringify(scope.reduceTo));
			    takeAction(scope.reduceTo);
			});
		    }
		}
	    });
