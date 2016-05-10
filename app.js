var angular = require('angular');
var firebase = require('firebase');
var angularfire = require('angularfire');
var _ = require('lodash');
var moment = require('moment');
var Papa = require('papaparse');


angular.module('spendPlan',
	       ['firebase',
		require('angular-material'),
		require('angular-material-data-table')])
  .controller(
    'MainCtrl',
    ['$scope','$firebaseObject','$firebaseAuth','$firebaseArray','$timeout',
     function($scope, $firebaseObject, $firebaseAuth, $firebaseArray, $timeout) {
       var baseurl = 'https://spendplan.firebaseio.com';
       var ref = new Firebase(baseurl);
       var acctRef = new Firebase(baseurl + '/accounts');
       var rateRef = new Firebase(baseurl + '/rates');
       var txRef = new Firebase(baseurl + '/tx');
       
       $scope.creds = {
       	 email: '',
       	 password: ''
       };

       $scope.tabs = [
	 {title: 'Overview', content: 'partials/overview.html'},
	 {title: 'Transactions', content: 'partials/tx.html'},
	 {title: 'Accounts', content: 'partials/accts.html'},
	 {title: 'Categories', content: 'partials/cats.html'},
	 {title: 'Tags', content: 'partials/tgs.html'},
	 {title: 'Upload', content: 'partials/upload.html'}
       ];
       
       $scope.authData = null;
       var auth = $firebaseAuth(ref);
       $scope.authData = auth.$getAuth();
       auth.$onAuth(function(authData) {
	 $scope.authData = authData;
	 $scope.acctsf = {};
	 $scope.catf = {};
	 $scope.tagf = {};
	 $scope.accts = $firebaseObject(acctRef);
	 $scope.accts.$loaded().then(function(data) {
	   for (key in data) {
	     if (data[key] && data[key].hasOwnProperty('currency')) {
	       $scope.acctsf[key] = {
		 fire: data[key],
		 tx: [],
		 sym: (data[key].currency==='USD')?'$':'£'
	       };
	     }
	   }
	 });

	 $scope.balance = function(tx, maxdate, mindate, inDollars) {
	   var txFiltered = tx;
	   if (maxdate) {
	     var maxdatestr = moment(maxdate).format('YYYY-MM-DD');
	     txFiltered = _.filter(txFiltered,function(val) {
	       return val.fire.Date <= maxdatestr;
	     });
	   }
	   if (mindate) {
	     var mindatestr = moment(mindate).format('YYYY-MM-DD');
	     txFiltered = _.filter(txFiltered, function(val) {
	       return val.fire.Date >= mindatestr;
	     });
	   }
	   var whichAmount = inDollars?'AmountUSD':'fire.Amount';
	   return _.sumBy(txFiltered, whichAmount);
	 };
	 
	 $scope.lastdate = function(tx) {
	   var last = _.maxBy(tx, 'fire.Date');
	   if (last) {
	     return last.fire.Date;
	   } else {
	     return 0;
	   }
	 }
	 
	 $scope.firstdate = function(tx) {
	   var first = _.minBy(tx, 'fire.Date');
	   if (first) {
	     return last.fire.Date;
	   } else {
	     return 0;
	   }
	 }

	 $scope.rates = $firebaseObject(rateRef);
	 $scope.categories = [];
	 $scope.tx = $firebaseArray(txRef);
	 $scope.txf = [];
	 $scope.tx.$loaded().then(function(data) {
	   angular.forEach(data, function(val) {
	     var acct = $scope.accts[val.Account];
	     var rate = $scope.rates[val.Date];
	     var newrec = {
	       fire: val,
	       acct: acct
	     };
	     if (acct.currency === 'GBP') {
	       newrec.AmountUSD = val.Amount/rate;
	       newrec.curSym = '£'
	     } else {
	       newrec.AmountUSD = val.Amount;
	       newrec.curSym = '$';
	     }
	     var sup = $scope.acctsf[val.Account];
	     sup.tx.push(newrec);
	     var curcat = $scope.catf[val.Category] = $scope.catf[val.Category] || [];
	     curcat.push(newrec);
	     angular.forEach(val.Tags, function(val) {
	       var curtag = $scope.tagf[val] = $scope.tagf[val] || [];
	       curtag.push(newrec);
	     });
	     $scope.txf.push(newrec);
	   });
	   $scope.categories = Object.keys($scope.catf);
	 });
       });
       
       $scope.login = function() {
	 auth.$authWithPassword($scope.creds)
	   .then(function(authData) {
	     console.log('LOGIN SUCCESS');
	   }).catch(function(error) {
	     console.log('LOGIN FAIL');
	   });
       }
     }])
  .controller(
    'ovCtrl',
    ['$scope',
     function($scope) {
     }])
  .controller(
    'txCtrl',
    ['$scope','$mdEditDialog',
     function($scope, $mdEditDialog) {
       $scope.txPage = {
	 num: 1,
	 limit: 50
       };
       $scope.txSelected = [];

       $scope.editNote = function(event, t) {
	 var editDialog = {
	   modelValue: t.fire.Note,
	   placeholder: 'Add a note',
	   save: function(input) {
	     t.fire.Note = input.$modelValue;
	     $scope.tx.$save(t.fire);
	   },
	   targetEvent: event,
	   title: 'Add a note',
	   validators: {
	     'md-maxlength': 200
	   }
	 };

	 var promise;

	 promise = $mdEditDialog.small(editDialog);
	 promise.then(function(ctrl) {
	   var input = ctrl.getInput();
	   console.log("INPUT IS: " + input);
	   
	 });
       };
       
     }])
  .controller(
    'acCtrl',
    ['$scope',
     function($scope) {
       $scope.acctDate = new Date();
     }])
  .controller(
    'ctCtrl',
    ['$scope',
     function($scope) {
       $scope.startDate = moment().subtract(1, 'months').toDate();
       $scope.endDate = new Date();
     }])
  .controller(
    'tgCtrl',
    ['$scope',
     function($scope) {
     }])
  .controller(
    'upCtrl',
    ['$scope', function($scope) {
      $scope.tempTrans = {rows: []};
      $scope.headerSelections = ['Date', 'Amount', 'Note', 'None'];
      $scope.headerOptions = ['Amount',
			      '-Amount',
			      'Credit',
			      '-Credit',
			      'Debit',
			      '-Debit',
			      'Category',
			      'Date',
			      'Note',
			      'None'];
      $scope.checkIt = function() {
	console.log(JSON.stringify($scope.tempTrans));
      };

    }])
  .directive(
    'fileChooser',
    function() {
      var link = function(scope, element, attrs) {
	element.on('change', function(evt) {
	  Papa.parse(evt.target.files[0], {
	    complete: function(results) {
	      // angular.forEach(results.data, function(val) {
	      // 	scope.tempTrans.push(val);
	      // })
	      scope.tempTrans.rows = results.data;
	      scope.$digest();
	      // console.log('GOT ' + scope.tempTrans.length + ' ROWS');
	      // scope.headerSelections = [];
	      // var longest = _.maxBy(results.data, function(val) { return val.length});
	      // for (var ctr = 0; ctr < longest; ctr++) {
	      // 	scope.headerSelections.push('None');
	      // }
	      // console.log(JSON.stringify(scope.headerSelections));
	      // console.log(scope.uploadAcct);
	    }
	  });
	});
      }

      return {
	template: '<input type="file">',
	replace: true,
	link: link
      }
    });
