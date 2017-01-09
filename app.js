var angular = require('angular');
firebase = require('firebase');
var angularfire = require('angularfire');
var _ = require('lodash');
var moment = require('moment');
var Papa = require('papaparse');


angular.module('spendPlan',
	       ['firebase',
		require('angular-material'),
		require('angular-material-data-table')])
  .config(function() {
    var config = {
      apiKey: 'AIzaSyCEbjBn1SapwDrseuleRd7seaWR8ph0_yc',
      authDomain: 'spendplan.firebaseapp.com',
      databaseURL: 'https://spendplan.firebaseio.com',
      storageBucket: 'project-5474304953684604346.appspot.com'
    };
    firebase.initializeApp(config);
  })
  .controller(
    'MainCtrl',
    ['$scope',
     '$firebaseObject',
     '$firebaseAuth',
     '$firebaseArray',
     '$timeout',
     function($scope,
	      $firebaseObject,
	      $firebaseAuth,
	      $firebaseArray,
	      $timeout) {
       
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
	 {title: 'Upload', content: 'partials/upload.html'},
	 // {title: 'Text', content: 'partials/text.html'}
       ];

       $scope.authData = null;
       var auth = $firebaseAuth();
       $scope.authData = auth.$getAuth();
       auth.$onAuthStateChanged(function(authData) {
	 $scope.authData = authData;
	 var ref = firebase.database().ref();
	 var acctRef = firebase.database().ref('accounts');
	 var rateRef = firebase.database().ref('rates');
	 var txRef = firebase.database().ref('tx');
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
	       return val.Date <= maxdatestr;
	     });
	   }
	   if (mindate) {
	     var mindatestr = moment(mindate).format('YYYY-MM-DD');
	     txFiltered = _.filter(txFiltered, function(val) {
	       return val.Date >= mindatestr;
	     });
	   }
	   var whichAmount = inDollars?'_amountUSD':'Amount';
	   return _.sumBy(txFiltered, whichAmount);
	 };
	 
	 $scope.lastdate = function(tx) {
	   var last = _.maxBy(tx, 'Date');
	   if (last) {
	     return last.Date;
	   } else {
	     return 0;
	   }
	 }
	 
	 $scope.firstdate = function(tx) {
	   var first = _.minBy(tx, 'Date');
	   if (first) {
	     return last.Date;
	   } else {
	     return 0;
	   }
	 }

	 $scope.showIt = function(l) {
	   console.log(JSON.stringify(l));
	 };

	 // huge hack, need to fix this
	 $scope.enrichTx = function(val) {
	   var acct = $scope.accts[val.Account];
	   var rate = $scope.rates[val.Date];

	   val._acct = acct;
	   if (acct.currency === 'GBP') {
	       val._amountUSD = val.Amount/rate;
	       val._curSym = '£'
	   } else {
	     val._amountUSD = val.Amount;
	     val._curSym = '$';
	   }
	 };

	 $scope.attachTx = function(val) {
	   var sup = $scope.acctsf[val.Account];
	   sup.tx.push(val);
	   var curcat = $scope.catf[val.Category] = ($scope.catf[val.Category] || []);
	   curcat.push(val)
	   angular.forEach(val.Tags, function(v) {
	     var curtag = $scope.tagf[v] = $scope.tagf[v] || [];
	     curtag.push(val);
	   });
	 };
	 
	 $scope.rates = $firebaseObject(rateRef);
	 $scope.categories = [];
	 $scope.tx = $firebaseArray(txRef);
	 $scope.tx.$loaded().then(function(data) {
	   angular.forEach(data, function(val) {
	     $scope.enrichTx(val);
	     $scope.attachTx(val);
	   });
	   $scope.categories = Object.keys($scope.catf);
	   $scope.tx.$watch(function(event) {
	     t = $scope.tx.$getRecord(event.key);
	     if (t && !t.hasOwnProperty('_acct')) {
	       $scope.enrichTx(t);
	       $scope.attachTx(t);
	     }
	   });
	 });
       });
       
       $scope.login = function() {
	 auth.$signInWithEmailAndPassword($scope.creds.email,$scope.creds.password)
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
    ['$scope', '$filter', '$mdEditDialog',
     function($scope, $filter, $mdEditDialog) {
       $scope.txPage = {
	 num: 1,
	 limit: 100
       };
       $scope.txSelected = [];

       $scope.getCats = function(srch) {
	 return $filter('filter')($scope.categories.sort(), srch);
       };

       $scope.killTx = function(t) {
	 $scope.tx.$remove(t);
       };

       $scope.editCat = function(t) {
	 // console.log("CATEGORY IS: " + t.Category);
	 $scope.tx.$save(t);
       };
       
       $scope.editNote = function(event, t) {
	 var editDialog = {
	   modelValue: t.Note,
	   placeholder: 'Add a note',
	   save: function(input) {
	     t.Note = input.$modelValue;
	     $scope.tx.$save(t);
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
  // .controller(
  //   'textCtrl',
  //   ['$scope','$http','$httpParamSerializerJQLike',
  //    function($scope, $http, $httpParamSerializerJQLike) {
  //      $scope.item = {msgs: []};
  //      var acctSid = 'AC12413265d6f17562b32fd3231ff4240e';
  //      var authTkn = '14865107f40af6b3629641cd87fda1a2';
  //      $scope.mynum = '+447481340534';

  //      var getMsgs = function() {
  // 	 $http({
  // 	   url: 'https://api.twilio.com/2010-04-01/Accounts/AC12413265d6f17562b32fd3231ff4240e/Messages.json',
  // 	   method: 'GET',
  // 	   params: {PageSize: 100},
  // 	   headers: {
  // 	     'Content-Type': 'application/x-www-form-urlencoded',
  // 	     'Authorization': 'Basic ' + btoa(acctSid + ':' + authTkn)
  // 	   }
  // 	 }).then(function(rsp) {
  // 	   $scope.item.msgs = rsp.data.messages;
  // 	   angular.forEach(rsp.data.messages, function(val) {
  // 	     val.timestamp = moment(new Date(val.date_sent));
  // 	   });
  // 	 });
  //      }
       
  //      getMsgs();

  //      $scope.transmit = function(m) {
  // 	 var data = {
  // 	   'To': '+447456963812',
  // 	   'From': '+447481340534',
  // 	   'Body': m
  // 	 }
  // 	 $http({
  // 	   url: 'https://api.twilio.com/2010-04-01/Accounts/AC12413265d6f17562b32fd3231ff4240e/Messages.json',
  // 	   method: 'POST',
  // 	   data: $httpParamSerializerJQLike(data),
  // 	   headers: {
  // 	     'Content-Type': 'application/x-www-form-urlencoded',
  // 	     'Authorization': 'Basic ' + btoa(acctSid + ':' + authTkn)
  // 	   }
  // 	 }).then(function(rsp) {
  // 	   getMsgs()
  // 	 });
  //      };
  //    }])
  .controller(
    'upCtrl',
    ['$scope', function($scope) {
      $scope.tempTrans = {rows: []};
      // $scope.headerSelections = ['Date', 'Amount', 'Note', 'None'];
      $scope.headerSelections = [];
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

      $scope.kill = function(row, idx) {
	$scope.tempTrans.rows.splice(idx, 1);
      };

      var process = function(item, acctId, acct, headers) {
	var output = {
	  Account: acctId,
	  Note: '',
	  Category: '',
	  Amount: 0
	};
	angular.forEach(headers, function(header, idx) {
	  var val = item[idx]
	  if (header == 'Note') {
	    output['Note'] += ' ' + val;
	  } else if (header == 'Date') {
	    output['Date'] = moment(val, acct.dldateformat).format('YYYY-MM-DD');
	  } else if (['Amount', 'Credit', 'Debit'].indexOf(header) > -1) {
	    val = val.replace(/[^\d.-]/g,'');
	    output['Amount'] += (Number.parseFloat(val) || 0)
	  } else if (['-Amount', '-Credit', '-Debit'].indexOf(header) > -1) {
	    val = val.replace(/[^\d.-]/g,'');
	    output['Amount'] -= (Number.parseFloat(val) || 0)
	  }
	});
	output['Note'] = output['Note'].trim();
	return output
      };

      $scope.addTxs = function(rows, acctId, headers) {
	var acct = $scope.acctsf[acctId].fire;
	angular.forEach(rows, function(item, idx) {
	  $scope.tx.$add(process(item, acctId, acct, headers));
	});
	$scope.tempTrans.rows = [];
      };
    }])
  .directive(
    'fileChooser',
    function() {
      var link = function(scope, element, attrs) {
	element.on('change', function(evt) {
	  Papa.parse(evt.target.files[0], {
	    complete: function(results) {
	      scope.tempTrans.rows = results.data;
	      scope.headerSelections = scope.acctsf[scope.uploadAcct].fire.dlheaders;
	      element.val(null);
	      scope.$digest();
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
