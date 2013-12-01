'use strict';

var app = angular.module('spendPlan',['dropstore-ng']);

app.controller('SpendPlanCtrl', 
	       // ['$scope', 'dropstoreClient',
		function SpendPlanCtrl($scope, dropstoreClient) {
		    var _datastore = null;
		    var _accountTable = null;
		    $scope.newAcct = {name:'', curr:'USD'};
		    $scope.accounts = [];
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

			    $scope.accounts = _accountTable.query();
			});
		    
		    $scope.addAccount = function() {
			console.log(JSON.stringify($scope.newAcct));
			_accountTable.insert({
			    acctname: $scope.newAcct.name,
			    currency: $scope.newAcct.curr
			});
		    };

		});