'use strict';

var app = angular.module('spendPlan',['dropstore-ng']);

app.controller('SpendPlanCtrl', 
	       // ['$scope', 'dropstoreClient',
		function SpendPlanCtrl($scope, dropstoreClient) {
		    var _datastore = null;
		    var _accountTable = null;
		    var _transactionTable = null;
		    $scope.newAcct = {name:'', curr:'USD'};
		    $scope.accounts = [];
		    $scope.transactions = [];
		    $scope.trans_filter = {date_min:'',
					   date_max:'',
					   amount_min:'',
					   amount_max:'',
					   category:'',
					   note:'',
					   account:''
					  };
		    dropstoreClient.create({key: "i86ppgkz7etf1vk"})
			.authenticate({interactive: true})
			.then(function(datastoreManager) {
			    console.log('completed authentication');
			    return datastoreManager.openDefaultDatastore();
			})
			.then(function(datastore) {
			    _datastore = datastore;
			    _accountTable = _datastore.getTable('accounts');

			    _datastore.SubscribeRecordsChanged(function(records) {
				for (var ndx in records ){
				    $scope.accounts.push(records[ndx]);
				}
			    }, 'accounts');

			    $scope.acctTable = _accountTable;
			    $scope.accounts = _accountTable.query();

			    _transactionTable = _datastore.getTable('transactions');
			    $scope.transactions = _transactionTable.query();
			    
			    var categories = {};
			    for (var ndx in $scope.transactions) {
				var category = $scope.transactions[ndx];
				var cat_name = category.get('Category');
				if (!(cat_name in categories)) {
				    categories[cat_name] = 0;
				};
				categories[cat_name] += category.get('Amount');
			    };
			    $scope.categories = categories;
			});
		    
		    $scope.getDate = function(transaction) {
			return transaction.get('Date')
		    };

		    $scope.getColor = function(transaction) {
			if (transaction.get('Amount') >= 0) {
			    return 'success';
			} else {
			    return 'danger';
			}
		    };

		    $scope.getBalance = function(account) {
			// console.log(account.getId());
			var acct_trans = _transactionTable.query({"Account": account.getId()});
			// console.log(acct_trans.length);
			var total = 0.0
			for ( var ndx in acct_trans) {
			    total += acct_trans[ndx].get('Amount');
			    // total += 1;
			}
			return total;
		    };
		    
		    $scope.currSymbol = function(account) {
			if (account.get('currency') == 'USD') {
			    return '$';
			} else if (account.get('currency') == 'GBP') {
			    return '£';
			} else {
			    return "ERR";
			}
		    };

		    $scope.catFilter = function(transaction) {
			var cat_pat = new RegExp($scope.trans_filter.category,'gi');
			var note_pat = new RegExp($scope.trans_filter.note,'gi');
			var min_test = true;
			var max_test = true;
			if ($scope.trans_filter.amount_min != '') {
			    min_test = (transaction.get('Amount') >= Number($scope.trans_filter.amount_min));
			};
			if ($scope.trans_filter.amount_max != '') {
			    max_test = (transaction.get('Amount') <= Number($scope.trans_filter.amount_max));
			};

			var date_min = true;
			var date_max = true;
			if ($scope.trans_filter.date_min != '') {
			    var date_arr = $scope.trans_filter.date_min.split('/');
			    var date = new Date(date_arr[2],
						    date_arr[0]-1,
						    date_arr[1]);
			    console.log(date);
			    date_min = (transaction.get('Date') >= date);
			};
			if ($scope.trans_filter.date_max != '') {
			    var date_arr = $scope.trans_filter.date_max.split('/');
			    var date = new Date(date_arr[2],
						    date_arr[0]-1,
						    date_arr[1]);
			    console.log(date);
			    date_max = (transaction.get('Date') <= date);
			};
			
			return cat_pat.test(transaction.get('Category')) & 
			    note_pat.test(transaction.get('Note')) &
			    min_test & max_test &
			    date_min & date_max;
		};
		    
		    $scope.addAccount = function() {
			console.log(JSON.stringify($scope.newAcct));
			_accountTable.insert({
			    acctname: $scope.newAcct.name,
			    currency: $scope.newAcct.curr
			});
		    };

		});