'use strict';

var app = angular.module(
    'spendPlan',
    ['dropstore-ng','ui.bootstrap','spDirectives', 'spFilters','spHelpers'])
    .config(function (datepickerConfig) {
	datepickerConfig.showWeeks = false;
    });

app.controller(
    'SpendPlanCtrl', 
    function SpendPlanCtrl($scope, $timeout, $http, 
			   dropstoreClient, dictValFilter, orderByFilter, 
			   transLimiter, updateExchangeRates, extractData) {
	
	var _datastore = null;
	var _accountTable = null;
	var _transactionTable = null;
	var _exchangeTable = null;
	var latest_date = new Date(0);

	// for adding stuff
	$scope.newAcct = {name:'', curr:'USD'};
	$scope.newTrans = 
	    {date: '', amount: '', category: '', note: '', account: '', tags: ''};
	$scope.column_headers = 
	    ['None', 'Date', 'Amount', 'Credit', 'Debit', 'Category', 'Note', 'Tags'];
	$scope.newTransactions = {
	    data: [],
	    account: null,
	    date_fmt: 'mm/dd/yy',
	    debits_negative: "1",
	    //credits negative/invert amounts?  (Citi card)
	    cols: []
	};
	// data holders
	$scope.accounts = [];
	$scope.transactions = {};
	$scope.filteredTransactions = [];
	$scope.categories = {};
	$scope.plan_categories = {}; // not used yet
	$scope.tags = {};
	$scope.exchangeRates = {};
	// filters
	$scope.acctDate = {date:''};
	$scope.catDate = {start: '', end: ''};
	$scope.tagDate = {start: '', end: ''};
	$scope.trans_filter = 
	    {date_min:'', 
	     date_max:'', 
	     amount_min:'', 
	     amount_max:'', 
	     category:'', 
	     note:'', 
	     account:'', 
	     tags: ''};

	$scope.how_many = {count: 100 }

	// editing which
	$scope.edit_category = {tran: null, repl: ""};
	$scope.edit_note = {tran: null, repl: ""};
	$scope.edit_tags = {tran: null, repl: ""};
	
	$scope.$watchCollection('transactions', function() { 
	    $scope.filteredTransactions = 
		orderByFilter(
		    dictValFilter($scope.transactions,transLimiter,$scope.trans_filter),
		    'date',true)
		.slice(0, $scope.how_many.count);
	});

	$scope.show_more = function() {
	    $scope.how_many.count += 100;
	    $scope.filteredTransactions = 
		orderByFilter(
		    dictValFilter($scope.transactions,transLimiter,$scope.trans_filter),
		    'date',true)
		.slice(0, $scope.how_many.count);
	};

	$scope.$watchCollection('catDate', function(newvals, oldvals) {
	    $scope.categories = getCatBalances();
	});

	$scope.$watchCollection('acctDate', function(newvals, oldvals) {
	    angular.forEach($scope.accounts, function(acct) {
		acct.balance = getBalance(acct.acct);
	    });
	});

	$scope.$watchCollection('tagDate', function(newvals, oldvals) {
	    $scope.tags = getTagBalances();
	});

	var filterTimeout;
	$scope.$watchCollection('trans_filter', function(newvals, oldvals) {
	    if (filterTimeout) {
		$timeout.cancel(filterTimeout);
	    };
	    filterTimeout = $timeout(function() {
		console.log(newvals, oldvals);
		$scope.how_many.count = 100;
		$scope.FilteredTransactions = orderByFilter(
		    dictValFilter($scope.transactions,transLimiter,newvals),
		    'date',true).slice(0, $scope.how_many.count);
	    },500);
	});
	
	$scope.open = function($event, dateOpts, opener) {
	    $event.preventDefault();
	    $event.stopPropagation();
	    console.log(opener);
	    if (!opener) {
		opener = 'opened';
	    };
	    dateOpts[opener] = true;
	};

	// var dropox_owner_name = '';
	dropstoreClient.create({key: "i86ppgkz7etf1vk"})
	    .authenticate({interactive: true})
	    .then(function(datastoreManager) {
		// console.log('completed authentication');
		// dropstoreClient.getAccountInfo({}, function(error, acctinfo, acct_json) {
		//     dropbox_owner_name = acctinfo.name;
		//     console.log(dropbox_owner_name);
		// });
		return datastoreManager.openDefaultDatastore();
	    })
	    .then(function(datastore) {
		var extractAcct = function(account) {
		    return {
			acct: account,
			name: account.get('acctname'),
			currency: account.get('currency'),
			currency_symbol: currSymbol(account.get('currency')),
			balance: getBalance(account)
		    };
		};
		
		_datastore = datastore;
		
		_transactionTable = _datastore.getTable('transactions');
		_accountTable = _datastore.getTable('accounts');

		$scope.acctTable = _accountTable;
		var temp_accounts = _accountTable.query();
		for (var ndx in temp_accounts) {
		    $scope.accounts.push(extractAcct(temp_accounts[ndx]));
		};
		$scope.newTrans.account = $scope.accounts[0];
		
		_datastore.SubscribeRecordsChanged(function(records) {
		    for (var ndx in records ){
			$scope.accounts.push(extractAcct(records[ndx]));
		    }
		}, 'accounts');
		
		_exchangeTable = _datastore.getTable('exchange_rates')
		var temp_rates = _exchangeTable.query();
		for (var ndx in temp_rates) {
		    var rate_date = temp_rates[ndx].get('date');
		    // rate_date.setHours(0,0,0,0);
		    // console.log(JSON.stringify(rate_date));
		    if (rate_date > latest_date) {
			latest_date = rate_date;
		    };
		    $scope.exchangeRates[rate_date] = temp_rates[ndx].get('rate');
		};
		_datastore.SubscribeRecordsChanged(function(records) {
		    for (var ndx in records ){
			var rate_date = records[ndx].get('date');
			// rate_date.setHours(0,0,0,0);
			if (rate_date > latest_date) {
			    latest_date = rate_date;
			};
			$scope.exchangeRates[rate_date] = records[ndx].get('rate');
		    }
		}, 'exchange_rates');
		
		// console.log(JSON.stringify(latest_date));
		// first time: grab exchange rates previously stored
		$http({method: 'GET', url: '/rates.json'}).
		    success(function(data, status, headers, config) {
			var last_date = latest_date;
			angular.forEach(data, function(value,ndx) { 
			    var val_date = new Date(value['date']);
			    val_date = new Date(Date.UTC(val_date.getFullYear(),
						     val_date.getMonth(),
						     val_date.getDate()));
			    if (val_date.getTime() > last_date.getTime()) {
				// console.log("found date: ", JSON.stringify(val_date));
    				_exchangeTable.insert({
    				    date: val_date,
    				    rate: value['rate']
    				});
				if (val_date.getTime() > latest_date.getTime()) {
				    latest_date = val_date;
				};
			    } else {
				// console.log(JSON.stringify(val_date),
				// 	       JSON.stringify(last_date),
				// 	       JSON.stringify(latest_date))
			    };
			});
			console.log("Latest date with known exchange rate: " + JSON.stringify(latest_date));
			updateExchangeRates(latest_date,_exchangeTable);
		    });
		
	
		angular.forEach(_transactionTable.query(), function(record) {
		    $scope.transactions[record.getId()] = 
			extractData(record,
				    $scope.acctTable.get(record.get('Account')),
				    $scope.exchangeRates[record.get('Date')]);
		});
		
		$scope.categories = getCatBalances();
		$scope.tags = getTagBalances();

		_datastore.SubscribeRecordsChanged(function(records) {
		    angular.forEach(records, function(record) {
			if (record.isDeleted()) {
			    delete $scope.transactions[record.getId()];
			} else {
			    $scope.transactions[record.getId()] = extractData(record,
				    $scope.acctTable.get(record.get('Account')),
				    $scope.exchangeRates[record.get('Date')]);
			};
		    });
		    angular.forEach($scope.accounts, function(acct) {
			acct.balance = getBalance(acct.acct);
		    });
		    $scope.categories = getCatBalances();
		    $scope.tags = getTagBalances();
		}, 'transactions');
	    });
	
	var getBalance = function(account) {
	    var acct_date = new Date();
	    if ($scope.acctDate.date != '') {
		acct_date = new Date($scope.acctDate.date);
	    }
	    var acct_trans = _transactionTable.query({"Account": account.getId()});
	    var total = 0.0;
	    for (var ndx in acct_trans) {
		var trans = acct_trans[ndx];
		if (trans.get('Date') <= acct_date) {
		    total += trans.get('Amount');
		};
	    }
	    return total;
	};
	
	var getCatBalances = function() {
	    var start_date = new Date(0);
	    var end_date = new Date();
	    var categories = {};
	    if ($scope.catDate.start != '') {
		start_date = new Date($scope.catDate.start);
	    };
	    if ($scope.catDate.end != '') {
		end_date = new Date($scope.catDate.end);
	    };
	    angular.forEach($scope.transactions, function(trans, ndx) {
		if (trans.date >= start_date && trans.date <= end_date) {
		    categories[trans.category] = (categories[trans.category] || 0) + trans.dollar_amount;
		};
	    });
	    return categories;
	};

	var getTagBalances = function() {
	    var tags = {};
	    var start_date = new Date(0);
	    var end_date = new Date();
	    if ($scope.tagDate.start != '') {
		start_date = new Date($scope.tagDate.start);
	    };
	    if ($scope.tagDate.end != '') {
		end_date = new Date($scope.tagDate.end);
	    };
	    angular.forEach($scope.transactions, function(trans, ndx) {
		if (trans.date >= start_date && trans.date <= end_date) {
		    angular.forEach(trans.tags, function(value) {
			tags[value] = (tags[value] || 0) + trans.dollar_amount;
		    });
		};
	    });
	    delete tags['None'];
	    return tags;
	}
	
	var currSymbol = function(trigraph) {
	    if (trigraph == 'USD') {
		return '$';
	    } else if (trigraph == 'GBP') {
		return '£';
	    } else {
		return "ERR";
	    }
	};
	
	$scope.addAccount = function() {
	    _accountTable.insert({
		acctname: $scope.newAcct.name,
		currency: $scope.newAcct.curr
	    });
	};
	
	$scope.addTransaction = function() {
	    var date = new Date($scope.newTrans.date);
	    date = new Date(Date.UTC(date.getFullYear(),
				     date.getMonth(),
				     date.getDate()));	    
	    var tag_arr = $scope.newTrans.tags.split(',');
	    for (var ndx in tag_arr) {
		tag_arr[ndx] = tag_arr[ndx].trim();
	    };
	    _transactionTable.insert({
		Date: date,
		Amount: Number($scope.newTrans.amount),
		Category: $scope.newTrans.category,
		Note: $scope.newTrans.note,
		Account: $scope.newTrans.account.acct.getId(),
		Tags: tag_arr
	    });
	};
	
	$scope.startEdit = function(transaction,scope_elt) {
	    if (scope_elt == 'edit_tags' ) {
		$scope[scope_elt].repl = transaction.tags;
	    } else if (scope_elt == 'edit_note') {
		$scope[scope_elt].repl = transaction.note;
	    } else if (scope_elt == 'edit_category') {
		$scope[scope_elt].repl = transaction.category;
	    };
	    $scope[scope_elt].tran = transaction;
	};
	
	$scope.editCategory = function(transaction) {
	    if ($scope.edit_category.repl != '') {
		transaction.trans.set('Category', $scope.edit_category.repl);
	    };
	    $scope.edit_category.tran = null;
	    $scope.edit_category.repl = "";
	};
	
	$scope.editNote = function(transaction) {
	    if ($scope.edit_note.repl != '') {
		transaction.trans.set('Note', $scope.edit_note.repl);
	    };
	    $scope.edit_note.tran = null;
	    $scope.edit_note.repl = "";
	};
	
	$scope.editTags = function(transaction) {
	    var trans_tags = transaction.trans.getOrCreateList('Tags');
	    var tag_arr = trans_tags.toArray();
	    var cur_num_tags = trans_tags.length();
	    for (var ndx = 0; ndx < cur_num_tags; ndx++ ) {
		trans_tags.pop();
		// console.log(trans_tags);
	    };
	    console.log(JSON.stringify($scope.edit_tags.repl));
	    if ($scope.edit_tags.repl.trim() != '')
	    {
		var all_tags = $scope.edit_tags.repl.split(',');
		for (var ndx in all_tags) {
		    var cur_tag = all_tags[ndx].trim();
		    trans_tags.push(cur_tag);
		};
	    };
	    $scope.edit_tags.tran = null;
	    $scope.edit_tags.tags = "";
	};
	
	$scope.thisIsIt = function(transaction,scope_elt) {
	    return transaction == $scope[scope_elt].tran;
	};
	
	$scope.saveIt = function() {
	    var new_transactions = [];
	    angular.forEach($scope.newTransactions.data, function(record,indx) {
		var new_trans = {Date:'', Amount:0.0, Category:'',Note:'',Account:'', Tags:''};
		angular.forEach($scope.newTransactions.cols, function(val, ndx) {
		    if ($scope.column_headers.indexOf(val) > 0 ){
			if (val == 'Note') {
			    new_trans[val] += ' ' + record[ndx];
			} else {
			    new_trans[val] = record[ndx];
			};
		    }
		});
		var tmp_date = angular.element.datepicker.parseDate($scope.newTransactions.date_fmt,
									 new_trans['Date']);
		new_trans['Date'] = new Date(Date.UTC(tmp_date.getFullYear(),
						      tmp_date.getMonth(),
						      tmp_date.getDate()));
		new_trans['Account'] = $scope.newTransactions.account.acct.getId();
		// sometimes there's a $ at the front (Citi card)
		if (new_trans.hasOwnProperty('Credit') && (new_trans['Credit'].trim() != '')) {
		    new_trans['Amount'] = Number(new_trans['Credit'].replace(/\$/,''));
		    delete new_trans['Credit'];
		} else if (new_trans.hasOwnProperty('Debit') && (new_trans['Debit'].trim() != '')) {
		    new_trans['Amount'] = Number(new_trans['Debit'].replace(/\$/,''));
		    delete new_trans['Credit'];
		} else if (new_trans.hasOwnProperty('Amount') && (new_trans['Amount'].trim() != '')) {
		    new_trans['Amount'] = Number(new_trans['Amount'].replace(/\$/,''));
		};
		new_trans['Amount'] = new_trans['Amount']*Number($scope.newTransactions['debits_negative']);
		new_trans['Tags'] = new_trans['Tags'].split(',');
		for (var ndx in new_trans['Tags']) {
		    new_trans['Tags'][ndx] = new_trans['Tags'][ndx].trim();
		};
		_transactionTable.insert(new_trans);
	    });
	    angular.element('#importModal').modal('hide');
	};
    });
