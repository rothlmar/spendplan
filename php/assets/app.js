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

		    $scope.addAccount = function() {
			console.log(JSON.stringify($scope.newAcct));
			_accountTable.insert({
			    acctname: $scope.newAcct.name,
			    currency: $scope.newAcct.curr
			});
		    };

		});