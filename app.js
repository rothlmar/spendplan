var angular = require('angular');
var firebase = require('firebase');
var angularfire = require('angularfire');
var _ = require('lodash');
var moment = require('moment');

angular.module('spendPlan',
	       ['firebase',
		require('angular-material'),
		require('angular-material-data-table')])
  .controller(
    'MainCtrl',
    ['$scope','$firebaseObject','$firebaseAuth','$firebaseArray','$timeout','$mdEditDialog',
     function($scope, $firebaseObject, $firebaseAuth, $firebaseArray, $timeout,$mdEditDialog) {
       var baseurl = 'https://spendplan.firebaseio.com';
       var ref = new Firebase(baseurl);
       var acctRef = new Firebase(baseurl + '/accounts');
       var rateRef = new Firebase(baseurl + '/rates');
       var txRef = new Firebase(baseurl + '/tx');
       
       $scope.creds = {
       	 email: '',
       	 password: ''
       };

       $scope.txSelected = [];

       $scope.txPage = {
	 num: 1,
	 limit: 50
       };

       $scope.acctDate = new Date();

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
       
       $scope.authData = null;
       var auth = $firebaseAuth(ref);
       $scope.authData = auth.$getAuth();
       auth.$onAuth(function(authData) {
	 $scope.authData = authData;
	 $scope.acctsf = {};
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

	 $scope.balance = function(tx, maxdate) {
	   var txFiltered = tx;
	   if (maxdate) {
	     var maxdatestr = moment(maxdate).format('YYYY-MM-DD');
	     txFiltered = _.filter(tx,function(val) {
	       return val.Date <= maxdatestr;
	     })
	   }
	   return _.sumBy(txFiltered, 'Amount');
	 };

	 $scope.lastdate = function(tx) {
	   var last = _.maxBy(tx, 'Date');
	   if (last) {
	     return last.Date;
	   } else {
	     return 0;
	   }
	 }
	 
	 $scope.rates = $firebaseObject(rateRef);
	 $scope.categories = [];
	 $scope.tx = $firebaseArray(txRef);
	 $scope.txf = [];
	 $scope.tx.$loaded().then(function(data) {
	   var tempCategories = [];
	   angular.forEach(data, function(val) {
	     var acct = $scope.accts[val.Account];
	     var rate = $scope.rates[val.Date];
	     var newrec = {
	       fire: val,
	       acct: acct
	     };
	     tempCategories.push(val.Category);
	     var sup = $scope.acctsf[val.Account];
	     sup.tx.push(val);
	     if (acct.currency === 'GBP') {
	       newrec.AmountUSD = val.Amount/rate;
	       newrec.curSym = '£'
	     } else {
	       newrec.AmountUSD = val.Amount;
	       newrec.curSym = '$';
	     }
	     $scope.txf.push(newrec);
	   });
	   $scope.categories = _.uniq(tempCategories);
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
